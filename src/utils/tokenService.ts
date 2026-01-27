import { STORAGE_KEYS } from "./authConstants";

class TokenService {
  /**
   * Store access token in memory or persistent storage based on rememberMe flag.
   * - rememberMe=true: stored in localStorage with expiresAt timestamp
   * - rememberMe=false: stored in sessionStorage (session-only)
   */
  setAccessToken(token: string, rememberMe: boolean) {
    if (rememberMe) {
      localStorage.setItem(STORAGE_KEYS.AccessToken, token);
      sessionStorage.removeItem(STORAGE_KEYS.AccessToken);
    } else {
      sessionStorage.setItem(STORAGE_KEYS.AccessToken, token);
      localStorage.removeItem(STORAGE_KEYS.AccessToken);
    }
  }

  /**
   * Check if access token exists (in either storage)
   */
  hasAccessToken(): boolean {
    return this.getAccessToken() !== null;
  }

  /**
   * Clear all auth-related storage (tokens and remember-me flag)
   */
  clearAll(): void {
    this.clearAccessToken();
    this.clearRememberMe();
  }

  getAccessToken(): string | null {
    return (
      localStorage.getItem(STORAGE_KEYS.AccessToken) ||
      sessionStorage.getItem(STORAGE_KEYS.AccessToken)
    );
  }

  clearAccessToken() {
    localStorage.removeItem(STORAGE_KEYS.AccessToken);
    sessionStorage.removeItem(STORAGE_KEYS.AccessToken);
  }

  setRememberMe(remember: boolean, expiresAt?: number) {
    if (!remember) {
      this.clearRememberMe();
      return;
    }
    localStorage.setItem(STORAGE_KEYS.RememberMe, "true");
    if (expiresAt) {
      localStorage.setItem(STORAGE_KEYS.RememberMeExpiresAt, String(expiresAt));
    }
  }

  isRemembered(): boolean {
    const flag = localStorage.getItem(STORAGE_KEYS.RememberMe) === "true";
    if (!flag) return false;
    const exp = Number(localStorage.getItem(STORAGE_KEYS.RememberMeExpiresAt) || 0);
    if (!exp) return flag;
    return Date.now() < exp;
  }

  clearRememberMe() {
    localStorage.removeItem(STORAGE_KEYS.RememberMe);
    localStorage.removeItem(STORAGE_KEYS.RememberMeExpiresAt);
  }
}

export const tokenService = new TokenService();