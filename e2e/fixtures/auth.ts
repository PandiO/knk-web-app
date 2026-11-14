import { AccountCreationMethod, type UserDto } from '../../src/types/dtos/auth/UserDtos';
import type {
  AuthLoginResponseDto,
  AuthRefreshResponseDto,
  OnboardingInfoDto,
  ValidateLinkCodeResponseDto,
} from '../../src/types/dtos/auth/AuthDtos';
import { STORAGE_KEYS } from '../../src/utils/authConstants';
import type { MockApi } from '../support/mockApi';

/**
 * Users and auth responses for the e2e specs, typed with the app's DTOs so a DTO change breaks
 * `npm run typecheck:e2e` instead of a mock silently drifting from the API.
 */

export const password = 'Kn1ghts&Kings!';

/** A player who registered with a link code from the game server. */
export const steve: UserDto = {
  id: 42,
  uuid: '00000000-0000-0000-0000-000000000042',
  username: 'Steve',
  email: 'steve@example.com',
  emailVerified: false,
  minecraftLinked: true,
  accountCreatedVia: AccountCreationMethod.MinecraftServer,
  isActive: true,
  coins: 0,
  gems: 0,
  experiencePoints: 0,
  createdAt: new Date('2026-11-01T12:00:00Z'),
};

/** A content admin (allowed `knk.content.*`): logs in to the dashboard. */
export const alex: UserDto = {
  ...steve,
  id: 7,
  uuid: '00000000-0000-0000-0000-000000000007',
  username: 'Alex',
  email: 'alex@example.com',
  emailVerified: true,
};

export function loginResponse(user: UserDto, accessToken: string): AuthLoginResponseDto {
  return { accessToken, refreshToken: null, expiresIn: 1800, user };
}

export function refreshResponse(accessToken: string): AuthRefreshResponseDto {
  return { accessToken, expiresIn: 1800 };
}

export const linkCodeValid: ValidateLinkCodeResponseDto = { isValid: true, username: 'Steve' };
export const linkCodeInvalid: ValidateLinkCodeResponseDto = { isValid: false, error: 'Invalid or expired link code' };

export const onboardingLinkCode: OnboardingInfoDto = {
  registrationMode: 'LinkCode',
  accessGate: false,
  publicBaseUrl: 'http://127.0.0.1:4173',
};

/** The permission check answer: `allowed` for every node in `allowed`, denied otherwise. */
export function mockPermissions(api: MockApi, user: UserDto, allowed: (node: string) => boolean): void {
  api.on<{ allowed: boolean; matchedNode?: string | null }>('GET', `Users/${user.id}/permissions/check`, ({ query }) => {
    const node = query.get('node') ?? '';
    return { body: allowed(node) ? { allowed: true, matchedNode: node } : { allowed: false, matchedNode: null } };
  });
}

/** Mocks the endpoints every page of a logged-in user calls: who am I, permissions, realtime (offline). */
export function mockSession(api: MockApi, user: UserDto, allowed: (node: string) => boolean = () => false): void {
  api.json<UserDto>('GET', 'Auth/me', user);
  mockPermissions(api, user, allowed);
}

/**
 * Starts the page logged in: the access token in sessionStorage, as a login without remember-me
 * leaves it. Call before the first `page.goto`.
 */
export async function startLoggedIn(page: import('@playwright/test').Page, accessToken: string): Promise<void> {
  await page.addInitScript(([key, token]) => {
    window.sessionStorage.setItem(key, token);
  }, [STORAGE_KEYS.AccessToken, accessToken] as const);
}
