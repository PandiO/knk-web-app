import { authClient } from "../apiClients/authClient";
import { STORAGE_KEYS, REMEMBER_ME_DURATION_MS } from "../utils/authConstants";
import { tokenService } from "../utils/tokenService";
import { UserDto, UserUpdateDto, UserCreateDto } from "../types/dtos/auth/UserDtos";
import { LoginRequestDto, RegisterRequestDto, AuthRefreshResponseDto } from "../types/dtos/auth/AuthDtos";

class AuthService {
  async login(req: LoginRequestDto): Promise<UserDto> {
    const res = await authClient.login(req);
   // Store access token in memory/storage based on rememberMe flag
   tokenService.setAccessToken(res.accessToken, req.rememberMe ?? false);
   
   // Track remember-me duration if enabled
   if (req.rememberMe) {
     const expiresAt = Date.now() + REMEMBER_ME_DURATION_MS;
     tokenService.setRememberMe(true, expiresAt);
   }
   
   return res.user;
  }

  async register(data: RegisterRequestDto): Promise<UserDto> {
    const user = await authClient.register(data);
    
    // After successful registration, automatically log the user in
    // This ensures they have a valid auth token and don't need to manually log in
    await this.login({
      email: data.email,
      password: data.password,
      rememberMe: true // Default to remember the user after registration
    });
    
    return user;
  }

  async logout(): Promise<void> {
    await authClient.logout();
     // Clear all authentication data (tokens and remember-me)
     tokenService.clearAll();
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

  async refreshSession(): Promise<boolean> {
    try {
      const res: AuthRefreshResponseDto = await authClient.refresh();
      
      // Update access token with new one from refresh response
      if (res && res.accessToken) {
        const rememberMe = tokenService.isRemembered();
        tokenService.setAccessToken(res.accessToken, rememberMe);
        return true;
      }
      return false;
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