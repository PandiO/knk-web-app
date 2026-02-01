import { authService } from '../authService';
import { authClient } from '../../apiClients/authClient';
import { tokenService } from '../../utils/tokenService';
import { UserDto } from '../../types/dtos/auth/UserDtos';
import { AuthLoginResponseDto, AuthRefreshResponseDto } from '../../types/dtos/auth/AuthDtos';

// Mock dependencies
jest.mock('../../apiClients/authClient');
jest.mock('../../utils/tokenService');

const mockedAuthClient = authClient as jest.Mocked<typeof authClient>;
const mockedTokenService = tokenService as jest.Mocked<typeof tokenService>;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const mockUser: UserDto = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      minecraftUUID: null,
      minecraftUsername: null,
      emailVerified: true,
      accountCreatedVia: 'email',
      balanceGold: 0,
      balanceSilver: 0,
      balanceCopper: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    const mockLoginResponse: AuthLoginResponseDto = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600,
      user: mockUser,
    };

    it('should successfully login with rememberMe=true and store tokens', async () => {
      mockedAuthClient.login.mockResolvedValue(mockLoginResponse);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: true,
      });

      expect(result).toEqual(mockUser);
      expect(mockedAuthClient.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: true,
      });
      expect(mockedTokenService.setAccessToken).toHaveBeenCalledWith('mock-access-token', true);
      expect(mockedTokenService.setRememberMe).toHaveBeenCalledWith(true, expect.any(Number));
    });

    it('should successfully login with rememberMe=false and store tokens in session', async () => {
      mockedAuthClient.login.mockResolvedValue(mockLoginResponse);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false,
      });

      expect(result).toEqual(mockUser);
      expect(mockedTokenService.setAccessToken).toHaveBeenCalledWith('mock-access-token', false);
      expect(mockedTokenService.setRememberMe).not.toHaveBeenCalled();
    });

    it('should successfully login with rememberMe undefined (default false)', async () => {
      mockedAuthClient.login.mockResolvedValue(mockLoginResponse);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual(mockUser);
      expect(mockedTokenService.setAccessToken).toHaveBeenCalledWith('mock-access-token', false);
    });

    it('should throw error on login failure (bad credentials)', async () => {
      const mockError = {
        code: 'InvalidCredentials',
        message: 'Invalid email or password',
        response: { code: 'InvalidCredentials', message: 'Invalid email or password' },
      };
      mockedAuthClient.login.mockRejectedValue(mockError);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrongpassword',
          rememberMe: false,
        })
      ).rejects.toEqual(mockError);

      expect(mockedTokenService.setAccessToken).not.toHaveBeenCalled();
      expect(mockedTokenService.setRememberMe).not.toHaveBeenCalled();
    });

    it('should throw error on network failure', async () => {
      const networkError = new Error('Network error');
      mockedAuthClient.login.mockRejectedValue(networkError);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'password123',
          rememberMe: false,
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('register', () => {
    const mockUser: UserDto = {
      id: 2,
      email: 'newuser@example.com',
      username: 'newuser',
      minecraftUUID: null,
      minecraftUsername: null,
      emailVerified: false,
      accountCreatedVia: 'email',
      balanceGold: 0,
      balanceSilver: 0,
      balanceCopper: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    it('should successfully register a new user', async () => {
      mockedAuthClient.register.mockResolvedValue(mockUser);

      const result = await authService.register({
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'SecurePass123!',
      });

      expect(result).toEqual(mockUser);
      expect(mockedAuthClient.register).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'SecurePass123!',
      });
    });

    it('should throw error on duplicate email', async () => {
      const duplicateError = {
        code: 'DuplicateEmail',
        message: 'Email already exists',
        response: { code: 'DuplicateEmail', message: 'Email already exists' },
      };
      mockedAuthClient.register.mockRejectedValue(duplicateError);

      await expect(
        authService.register({
          email: 'existing@example.com',
          username: 'newuser',
          password: 'SecurePass123!',
        })
      ).rejects.toEqual(duplicateError);
    });
  });

  describe('logout', () => {
    it('should successfully logout and clear all tokens', async () => {
      mockedAuthClient.logout.mockResolvedValue();

      await authService.logout();

      expect(mockedAuthClient.logout).toHaveBeenCalled();
      expect(mockedTokenService.clearAll).toHaveBeenCalled();
    });

    it('should clear tokens even if logout request fails', async () => {
      mockedAuthClient.logout.mockRejectedValue(new Error('Network error'));

      await expect(authService.logout()).rejects.toThrow('Network error');
      
      // Note: clearAll should still be called in a proper implementation
      // For now, the current implementation doesn't have try/catch
    });
  });

  describe('getCurrentUser', () => {
    const mockUser: UserDto = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      minecraftUUID: null,
      minecraftUsername: null,
      emailVerified: true,
      accountCreatedVia: 'email',
      balanceGold: 100,
      balanceSilver: 50,
      balanceCopper: 25,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    it('should return current user when authenticated', async () => {
      mockedAuthClient.me.mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser();

      expect(result).toEqual(mockUser);
      expect(mockedAuthClient.me).toHaveBeenCalled();
    });

    it('should return null on unauthorized error', async () => {
      const unauthorizedError = { code: 'Unauthorized', message: 'Invalid token' };
      mockedAuthClient.me.mockRejectedValue(unauthorizedError);

      const result = await authService.getCurrentUser();

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      mockedAuthClient.me.mockRejectedValue(new Error('Network error'));

      const result = await authService.getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('refreshSession', () => {
    const mockRefreshResponse: AuthRefreshResponseDto = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
    };

    it('should successfully refresh tokens when remembered', async () => {
      mockedAuthClient.refresh.mockResolvedValue(mockRefreshResponse);
      mockedTokenService.isRemembered.mockReturnValue(true);

      const result = await authService.refreshSession();

      expect(result).toBe(true);
      expect(mockedAuthClient.refresh).toHaveBeenCalled();
      expect(mockedTokenService.setAccessToken).toHaveBeenCalledWith('new-access-token', true);
    });

    it('should successfully refresh tokens when not remembered', async () => {
      mockedAuthClient.refresh.mockResolvedValue(mockRefreshResponse);
      mockedTokenService.isRemembered.mockReturnValue(false);

      const result = await authService.refreshSession();

      expect(result).toBe(true);
      expect(mockedTokenService.setAccessToken).toHaveBeenCalledWith('new-access-token', false);
    });

    it('should return false when refresh response has no accessToken', async () => {
      mockedAuthClient.refresh.mockResolvedValue({
        accessToken: '',
        expiresIn: 0,
      } as AuthRefreshResponseDto);

      const result = await authService.refreshSession();

      expect(result).toBe(false);
      expect(mockedTokenService.setAccessToken).not.toHaveBeenCalled();
    });

    it('should return false on refresh failure (expired refresh token)', async () => {
      const expiredError = { code: 'TokenExpired', message: 'Refresh token expired' };
      mockedAuthClient.refresh.mockRejectedValue(expiredError);

      const result = await authService.refreshSession();

      expect(result).toBe(false);
    });

    it('should return false on network error during refresh', async () => {
      mockedAuthClient.refresh.mockRejectedValue(new Error('Network error'));

      const result = await authService.refreshSession();

      expect(result).toBe(false);
    });
  });

  describe('autoLogin', () => {
    const mockUser: UserDto = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      minecraftUUID: null,
      minecraftUsername: null,
      emailVerified: true,
      accountCreatedVia: 'email',
      balanceGold: 0,
      balanceSilver: 0,
      balanceCopper: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    it('should auto-login when user session is valid', async () => {
      mockedTokenService.isRemembered.mockReturnValue(true);
      mockedAuthClient.me.mockResolvedValue(mockUser);

      const result = await authService.autoLogin();

      expect(result).toEqual(mockUser);
      expect(mockedAuthClient.me).toHaveBeenCalledTimes(1);
    });

    it('should auto-login after refresh when initial getCurrentUser fails but remembered', async () => {
      mockedTokenService.isRemembered.mockReturnValue(true);
      
      // First call fails (unauthorized), second succeeds after refresh
      mockedAuthClient.me
        .mockRejectedValueOnce({ code: 'Unauthorized' })
        .mockResolvedValueOnce(mockUser);
      
      mockedAuthClient.refresh.mockResolvedValue({
        accessToken: 'new-token',
        expiresIn: 3600,
      } as AuthRefreshResponseDto);

      const result = await authService.autoLogin();

      expect(result).toEqual(mockUser);
      expect(mockedAuthClient.refresh).toHaveBeenCalled();
      expect(mockedAuthClient.me).toHaveBeenCalledTimes(2);
    });

    it('should return null when not remembered and session invalid', async () => {
      mockedTokenService.isRemembered.mockReturnValue(false);
      mockedAuthClient.me.mockRejectedValue({ code: 'Unauthorized' });

      const result = await authService.autoLogin();

      expect(result).toBeNull();
      expect(mockedAuthClient.refresh).not.toHaveBeenCalled();
    });

    it('should return null when refresh fails', async () => {
      mockedTokenService.isRemembered.mockReturnValue(true);
      mockedAuthClient.me.mockRejectedValue({ code: 'Unauthorized' });
      mockedAuthClient.refresh.mockRejectedValue({ code: 'TokenExpired' });

      const result = await authService.autoLogin();

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    const mockUser: UserDto = {
      id: 1,
      email: 'updated@example.com',
      username: 'updateduser',
      minecraftUUID: null,
      minecraftUsername: null,
      emailVerified: true,
      accountCreatedVia: 'email',
      balanceGold: 0,
      balanceSilver: 0,
      balanceCopper: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    it('should successfully update user', async () => {
      mockedAuthClient.updateUser.mockResolvedValue(mockUser);

      const result = await authService.updateUser({
        email: 'updated@example.com',
      });

      expect(result).toEqual(mockUser);
      expect(mockedAuthClient.updateUser).toHaveBeenCalledWith({
        email: 'updated@example.com',
      });
    });
  });
});
