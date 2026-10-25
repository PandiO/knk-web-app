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
  /** Register only (KNG-216): the API's Cloudflare Access sync is on, so Cloudflare emails the new
   *  player a one-time PIN before the site opens. Absent otherwise. */
  accessGate?: boolean;
}

/** What a registration gives the page that asked for it. */
export interface RegisterResult {
  user: UserDto;
  /** Show the "Cloudflare emails you a PIN" step (KNG-216). */
  accessGate: boolean;
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
  /** The /account link code (today's flow). Leave out when signing up with an invitation. */
  linkCode?: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  /** A personal invite's token from /invite/:token (KNG-212; the API's Registration:Mode=Invite). */
  inviteToken?: string;
  /** A shared code, KNK-XXXXX-XXXXX, from /join (KNG-212). */
  inviteCode?: string;
  /** The claim code from the server's disconnect screen (KNG-214, game-first): only together with an
   *  invite; the new account is linked to that Minecraft account in the same step. */
  claimCode?: string;
}

/** POST Admission/claim/check (KNG-214): is this claim code active, and for which Minecraft name? */
/** Security:Registration:Mode as the API reports it (GET Auth/registration-info). */
export type RegistrationMode = 'LinkCode' | 'Invite' | 'Open';

/** GET Auth/registration-info (anonymous): only the mode, so the sign-up and login pages can route a newcomer. */
export interface RegistrationInfoDto {
  mode: RegistrationMode | string;
}

export interface ClaimCheckResponseDto {
  valid: boolean;
  minecraftName?: string | null;
  expiresAt?: string | null;
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

/**
 * POST Users/link-minecraft-account. `user` is the surviving account. When the web account was
 * folded into an existing Minecraft account (KNG-207, invitations DESIGN § 5.4 case B), `merged`
 * is true, `user` is that account and `accessToken` logs this browser into it, because the
 * caller's own account is now gone; otherwise `accessToken` is absent.
 */
export interface LinkMinecraftAccountResponseDto {
  user: UserDto;
  merged?: boolean;
  accessToken?: string;
  expiresIn?: number;
  message?: string;
}

export interface PasswordStrengthDto {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  feedback: string[];
}