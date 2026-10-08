import { authClient } from "../apiClients/authClient";
import { REMEMBER_ME_DURATION_MS } from "../utils/authConstants";
import { tokenService } from "../utils/tokenService";
import { UserDto, UserUpdateDto } from "../types/dtos/auth/UserDtos";
import {
  LoginRequestDto,
  RegisterRequestDto,
  AuthLoginResponseDto,
  AuthUpdateResponseDto,
  ForgotPasswordResponseDto,
  ResetPasswordResponseDto,
} from "../types/dtos/auth/AuthDtos";
import { refreshAccessToken } from "./sessionRefresh";

class AuthService {
  /**
   * Stores the access token of a login-shaped response. The refresh token isn't in the body: the
   * API keeps it in an HttpOnly cookie. Without remember-me the token lives in sessionStorage.
   */
  private startSession(res: AuthLoginResponseDto, rememberMe: boolean) {
    tokenService.setAccessToken(res.accessToken, rememberMe);
    if (rememberMe) {
      tokenService.setRememberMe(true, Date.now() + REMEMBER_ME_DURATION_MS);
    } else {
      tokenService.clearRememberMe();
    }
  }

  async login(req: LoginRequestDto): Promise<UserDto> {
    const rememberMe = req.rememberMe ?? false;
    const res = await authClient.login({ ...req, rememberMe });
    this.startSession(res, rememberMe);
    return res.user;
  }

  /** Registers with a link code. The API answers like login, so the player is logged in (no remember-me). */
  async register(data: RegisterRequestDto): Promise<UserDto> {
    const res = await authClient.register(data);
    this.startSession(res, false);
    return res.user;
  }

  /** Ends this session. Local state is cleared even when the API call fails. */
  async logout(): Promise<void> {
    try {
      await authClient.logout();
    } finally {
      tokenService.clearAll();
    }
  }

  /** Ends every session of this user, on every device. Local state is cleared even when the call fails. */
  async logoutAll(): Promise<void> {
    try {
      await authClient.logoutAll();
    } finally {
      tokenService.clearAll();
    }
  }

  async getCurrentUser(): Promise<UserDto | null> {
    try {
      const user = await authClient.me();
      return user ?? null;
    } catch (e) {
       // Return null on any error (unauthorized, network, etc.)
      return null;
    }
  }

  /**
   * Gets a new access token with the refresh cookie. Shares the single in-flight refresh with
   * serviceCall's retry: the API rotates the refresh token on every use, so two parallel refreshes
   * would look like a stolen token and end the session.
   */
  async refreshSession(): Promise<boolean> {
    return refreshAccessToken();
  }

  /**
   * Updates the email and/or password. An email change ends every session and the API answers
   * with a fresh access token, which is stored so this tab stays logged in.
   */
  async updateUser(data: UserUpdateDto): Promise<AuthUpdateResponseDto> {
    const res = await authClient.updateUser(data);
    if (res?.accessToken) {
      tokenService.setAccessToken(res.accessToken, tokenService.isRemembered());
    }
    return res;
  }

  async requestPasswordReset(email: string): Promise<ForgotPasswordResponseDto> {
    return await authClient.forgotPassword({ email });
  }

  async resetPassword(token: string, newPassword: string, passwordConfirmation: string): Promise<ResetPasswordResponseDto> {
    return await authClient.resetPassword({ token, newPassword, passwordConfirmation });
  }

  /**
   * Restores a session on page load. When there's a sign of an earlier session (a stored access
   * token or remember-me), an expired access token is renewed with the refresh cookie once.
   * Anonymous visitors don't call refresh: it shares the API's per-IP rate limit with login.
   */
  async autoLogin(): Promise<UserDto | null> {
    const hadSession = tokenService.hasAccessToken() || tokenService.isRemembered();
    if (!hadSession) {
      return null;
    }
    let user = await this.getCurrentUser();
    if (!user) {
      const refreshed = await this.refreshSession();
      if (refreshed) {
        user = await this.getCurrentUser();
      }
    }
    if (!user) {
      tokenService.clearAll();
    }
    return user;
  }
}

export const authService = new AuthService();
