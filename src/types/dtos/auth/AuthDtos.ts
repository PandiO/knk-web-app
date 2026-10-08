import { UserDto } from "./UserDtos";

/** POST Auth/login. `login` is an email address or a Minecraft username (case-insensitive). */
export interface LoginRequestDto {
  login: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Login and register response. The refresh token is never in the body: the API sets it as an
 * HttpOnly cookie scoped to /api/Auth (the body's refreshToken is null).
 */
export interface AuthLoginResponseDto {
  accessToken: string;
  refreshToken?: null;
  expiresIn: number;
  user: UserDto;
}

/** POST Auth/refresh (the cookie carries the refresh token). */
export interface AuthRefreshResponseDto {
  accessToken: string;
  expiresIn: number;
}

/** PUT Auth/update. Changing the email ends every session, so the API returns a fresh access token. */
export interface AuthUpdateResponseDto {
  user?: UserDto;
  message?: string;
  accessToken?: string | null;
  expiresIn?: number;
}

/** The `{ error, message }` body the API answers a refused auth request with. */
export interface AuthErrorDto {
  error?: string;
  message?: string;
}

export interface ForgotPasswordRequestDto {
  email: string;
}

export interface ForgotPasswordResponseDto {
  message: string;
  debugResetToken?: string;
  debugResetUrl?: string;
}

export interface ResetPasswordRequestDto {
  token: string;
  newPassword: string;
  passwordConfirmation: string;
}

export interface ResetPasswordResponseDto {
  message: string;
}

export interface AuthValidateTokenRequestDto {
  token: string;
}

export interface AuthValidateTokenResponseDto {
  valid: boolean;
  expiresAt?: Date;
}

/**
 * POST Auth/register. The link code comes from `/account link` in game and decides the Minecraft
 * account (and so the username); the player only adds an email and a password.
 */
export interface RegisterRequestDto {
  linkCode: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}

/** POST Users/validate-link-code/{code}: read-only, it doesn't use up the code. */
export interface ValidateLinkCodeResponseDto {
  isValid: boolean;
  username?: string | null;
  error?: string | null;
}

export interface PasswordChangeDto {
  currentPassword: string;
  newPassword: string;
}

export interface AccountMergeDto {
  primaryUserId: number;
  secondaryUserId: number;
}

export interface LinkMinecraftAccountDto {
  linkCode: string;
}

export interface PasswordStrengthDto {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  feedback: string[];
}