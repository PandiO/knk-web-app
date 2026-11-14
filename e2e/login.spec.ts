import { test, expect } from './support/mockApi';
import { alex, loginResponse, mockSession, password, refreshResponse, startLoggedIn, steve } from './fixtures/auth';
import type { AuthErrorDto, AuthLoginResponseDto, AuthRefreshResponseDto, LoginRequestDto } from '../src/types/dtos/auth/AuthDtos';
import { ERROR_MESSAGES } from '../src/utils/authConstants';

/**
 * Login, and the expired-token path of src/services/serviceCall.ts: a request that gets a 401 with
 * a token refreshes the session once (POST Auth/refresh, single-flight) and is retried with the new
 * token; when the refresh is refused too, the app ends the session and sends the player to the
 * login page with the "session expired" banner.
 */

const isContentNode = (node: string) => node.startsWith('knk.admin.');

async function fillLogin(page: import('@playwright/test').Page, login: string, secret: string) {
  await page.getByRole('textbox', { name: 'Email or Minecraft name' }).fill(login);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Log In' }).click();
}

test('a player logs in and lands on the account page', async ({ page, api }) => {
  api.json<AuthLoginResponseDto>('POST', 'Auth/login', loginResponse(steve, 'access-1'));
  mockSession(api, steve);

  await page.goto('/auth/login');
  await fillLogin(page, 'Steve', password);

  await expect(page).toHaveURL(/\/account$/);
  const expected: LoginRequestDto = { login: 'Steve', password, rememberMe: false };
  expect(api.calls('POST', 'Auth/login').map(r => r.body)).toEqual([expected]);
});

test('a wrong password shows the generic error', async ({ page, api }) => {
  api.on<AuthErrorDto>('POST', 'Auth/login', {
    status: 401,
    body: { error: 'InvalidCredentials', message: 'Invalid credentials.' },
  });

  await page.goto('/auth/login');
  await fillLogin(page, 'Steve', 'not-the-password');

  await expect(page.getByRole('alert').filter({ hasText: ERROR_MESSAGES.InvalidCredentials }).first()).toBeAttached();
  await expect(page.getByText(ERROR_MESSAGES.InvalidCredentials).first()).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login$/);
  expect(api.calls('POST', 'Auth/refresh')).toHaveLength(0);
});

test('an expired access token is refreshed once and the request retried', async ({ page, api }) => {
  // Login hands out a token the API already considers expired: every permission check with it
  // gets a 401. The refresh cookie still works, so the app renews the token and retries.
  api.json<AuthLoginResponseDto>('POST', 'Auth/login', loginResponse(alex, 'expired-token'));
  mockSession(api, alex, isContentNode);
  api.on<{ allowed: boolean; matchedNode?: string | null } | AuthErrorDto>(
    'GET',
    `Users/${alex.id}/permissions/check`,
    ({ bearer, query }) => bearer === 'fresh-token'
      ? { body: { allowed: isContentNode(query.get('node') ?? ''), matchedNode: query.get('node') } }
      : { status: 401, body: { error: 'Unauthorized' } },
  );
  api.json<AuthRefreshResponseDto>('POST', 'Auth/refresh', refreshResponse('fresh-token'));

  await page.goto('/auth/login');
  await fillLogin(page, 'Alex', password);

  // Content staff land on the dashboard, which they only reach when the retried check said "allowed".
  await expect(page).toHaveURL(/\/dashboard(\/[a-z]+)?$/);
  expect(api.calls('POST', 'Auth/refresh')).toHaveLength(1);
  const checks = api.calls('GET', `Users/${alex.id}/permissions/check`);
  expect(checks.filter(c => c.bearer === 'expired-token').length).toBeGreaterThan(0);
  expect(checks.filter(c => c.bearer === 'fresh-token').length).toBeGreaterThan(0);
});

test('a refused refresh ends the session and asks to log in again', async ({ page, api }) => {
  await startLoggedIn(page, 'expired-token');
  mockSession(api, steve);
  api.on<AuthErrorDto>('GET', `Users/${steve.id}/permissions/check`, { status: 401, body: { error: 'Unauthorized' } });
  api.on<AuthErrorDto>('POST', 'Auth/refresh', { status: 401, body: { error: 'InvalidRefreshToken' } });

  await page.goto('/account');

  await expect(page).toHaveURL(/\/auth\/login\?returnTo=%2Faccount&reason=expired$/);
  await expect(page.getByText('Your session expired.')).toBeVisible();
  // At least one refresh; requests already in flight may each try again after the refusal
  // (follow-up issue in the #423 report), so the count is not pinned here.
  expect(api.calls('POST', 'Auth/refresh').length).toBeGreaterThan(0);
});
