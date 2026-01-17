import { authClient } from "../apiClients/authClient";
import { STORAGE_KEYS, REMEMBER_ME_DURATION_MS } from "../utils/authConstants";
import { tokenService } from "../utils/tokenService";
import { UserDto, UserUpdateDto, UserCreateDto } from "../types/dtos/auth/UserDtos";
import { LoginRequestDto, RegisterRequestDto } from "../types/dtos/auth/AuthDtos";

class AuthService {
  async login(req: LoginRequestDto): Promise<UserDto> {
    const res = await authClient.login(req);
    // Server should set httpOnly cookie for tokens; we only track remember-me
    tokenService.setRememberMe(req.rememberMe, Date.now() + REMEMBER_ME_DURATION_MS);
    return res.user;
  }

  async register(data: RegisterRequestDto): Promise<UserDto> {
    const user = await authClient.register(data);
    return user;
  }

  async logout(): Promise<void> {
    await authClient.logout();
    tokenService.clearAccessToken();
    tokenService.clearRememberMe();
  }

  async getCurrentUser(): Promise<UserDto | null> {
    try {
      const user = await authClient.me();
      return user ?? null;
    } catch (e) {
      return null;
    }
  }

  async refreshSession(): Promise<boolean> {
    try {
      await authClient.refresh();
      return true;
    } catch (e) {
      return false;
    }
  }

  async updateUser(data: UserUpdateDto): Promise<UserDto> {
    const user = await authClient.updateUser(data);
    return user;
  }

  // Auto-login logic
  async autoLogin(): Promise<UserDto | null> {
    const remembered = tokenService.isRemembered();
    // Try to fetch current user; if unauthorized and remembered, try refresh then retry
    let user = await this.getCurrentUser();
    if (!user && remembered) {
      const refreshed = await this.refreshSession();
      if (refreshed) {
        user = await this.getCurrentUser();
      }
    }
    return user;
  }
}

export const authService = new AuthService();