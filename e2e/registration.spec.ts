import { test, expect } from './support/mockApi';
import { linkCodeInvalid, linkCodeValid, loginResponse, onboardingLinkCode, password, steve } from './fixtures/auth';
import type { AuthErrorDto, OnboardingInfoDto, RegisterRequestDto, ValidateLinkCodeResponseDto } from '../src/types/dtos/auth/AuthDtos';
import type { UserDto } from '../src/types/dtos/auth/UserDtos';

/**
 * Registration with a link code from the game server (alpha hardening WP9.4, decision D1); ported
 * from the Cypress spec `cypress/e2e/registration.cy.ts` (PandiO/knk-workspace#423).
 *
 * 1. The player enters the code from `/account link`; the app shows whose Minecraft account it is.
 * 2. They pick an email and a password.
 * 3. The API logs them in (login-shaped response) and the app lands on /account.
 */

test.beforeEach(async ({ page, api }) => {
  api.json<OnboardingInfoDto>('GET', 'Auth/onboarding-info', onboardingLinkCode);
  api.json<ValidateLinkCodeResponseDto>('POST', 'Users/validate-link-code/ABCD1234', linkCodeValid);
  api.json<ValidateLinkCodeResponseDto>('POST', 'Users/validate-link-code/BADC0DE1', linkCodeInvalid);
  await page.goto('/auth/register');
});

test('rejects an invalid code', async ({ page }) => {
  await page.getByTestId('link-code').fill('badc-0de1');
  await page.getByRole('button', { name: 'Check code' }).click();
  await expect(page.getByText('This code is invalid or has expired')).toBeVisible();
});

test('registers and lands on the account page', async ({ page, api }) => {
  api.on('POST', 'Auth/register', { status: 201, body: loginResponse(steve, 'access-token') });
  api.json<UserDto>('GET', 'Auth/me', steve);
  api.on<AuthErrorDto>('GET', `Users/${steve.id}/permissions/check`, { status: 403, body: { error: 'Forbidden' } });

  await page.getByTestId('link-code').fill('abcd1234');
  await page.getByRole('button', { name: 'Check code' }).click();
  await expect(page.getByText('This code belongs to Steve')).toBeVisible();

  await page.getByTestId('email').fill(steve.email!);
  await page.getByTestId('password').fill(password);
  await page.getByTestId('confirm-password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText('Your web account is ready')).toBeVisible();
  const expected: RegisterRequestDto = {
    linkCode: 'ABCD1234',
    email: steve.email!,
    password,
    passwordConfirmation: password,
  };
  expect(api.calls('POST', 'Auth/register').map(r => r.body)).toEqual([expected]);
  await expect(page).toHaveURL(/\/account$/, { timeout: 8_000 });
});

test('shows a duplicate email on the email field', async ({ page, api }) => {
  api.on<AuthErrorDto>('POST', 'Auth/register', {
    status: 409,
    body: { error: 'DuplicateEmail', message: 'Email is already in use.' },
  });

  await page.getByTestId('link-code').fill('ABCD1234');
  await page.getByRole('button', { name: 'Check code' }).click();
  await page.getByTestId('email').fill(steve.email!);
  await page.getByTestId('password').fill(password);
  await page.getByTestId('confirm-password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.locator('#email-error')).toContainText('already used by another account');
});
