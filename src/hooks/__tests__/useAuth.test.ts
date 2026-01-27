import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { authService } from '../../services/authService';
import { UserDto } from '../../types/dtos/auth/UserDtos';

// Mock authService
jest.mock('../../services/authService');

const mockedAuthService = authService as jest.Mocked<typeof authService>;

describe('useAuth', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should start with loading state and attempt auto-login', async () => {
      mockedAuthService.autoLogin.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.isLoggedIn).toBe(false);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isLoggedIn).toBe(true);
      expect(mockedAuthService.autoLogin).toHaveBeenCalled();
    });

    it('should handle auto-login failure gracefully', async () => {
      mockedAuthService.autoLogin.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isLoggedIn).toBe(false);
    });

    it('should handle auto-login error gracefully', async () => {
      mockedAuthService.autoLogin.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isLoggedIn).toBe(false);
    });
  });

  describe('login', () => {
    it('should successfully login and update user state', async () => {
      mockedAuthService.autoLogin.mockResolvedValue(null);
      mockedAuthService.login.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let returnedUser: UserDto | undefined;
      await act(async () => {
        returnedUser = await result.current.login({
          email: 'test@example.com',
          password: 'password123',
          rememberMe: true,
        });
      });

      expect(returnedUser).toEqual(mockUser);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.error).toBeNull();
      expect(mockedAuthService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: true,
      });
    });

    it('should set error on login failure (bad credentials)', async () => {
      mockedAuthService.autoLogin.mockResolvedValue(null);
      const mockError = {
        code: 'InvalidCredentials',
        response: { message: 'Invalid email or password' },
        message: 'Invalid credentials',
      };
      mockedAuthService.login.mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.login({
            email: 'test@example.com',
            password: 'wrongpassword',
            rememberMe: false,
          });
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isLoggedIn).toBe(false);
      expect(result.current.error).toBe('Invalid email or password');
    });

    it('should set generic error message when no specific message provided', async () => {
      mockedAuthService.autoLogin.mockResolvedValue(null);
      mockedAuthService.login.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.login({
            email: 'test@example.com',
            password: 'password123',
            rememberMe: false,
          });
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('register', () => {
    it('should successfully register and update user state', async () => {
      mockedAuthService.autoLogin.mockResolvedValue(null);
      mockedAuthService.register.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let returnedUser: UserDto | undefined;
      await act(async () => {
        returnedUser = await result.current.register({
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'SecurePass123!',
        });
      });

      expect(returnedUser).toEqual(mockUser);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should set error on registration failure', async () => {
      mockedAuthService.autoLogin.mockResolvedValue(null);
      const mockError = {
        code: 'DuplicateEmail',
        response: { message: 'Email already exists' },
      };
      mockedAuthService.register.mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.register({
            email: 'existing@example.com',
            username: 'newuser',
            password: 'SecurePass123!',
          });
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.user).toBeNull();
      expect(result.current.error).toBe('Email already exists');
    });
  });

  describe('logout', () => {
    it('should successfully logout and clear user state', async () => {
      mockedAuthService.autoLogin.mockResolvedValue(mockUser);
      mockedAuthService.logout.mockResolvedValue();

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isLoggedIn).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockedAuthService.logout).toHaveBeenCalled();
    });

    it('should clear user state even on logout failure', async () => {
      mockedAuthService.autoLogin.mockResolvedValue(mockUser);
      mockedAuthService.logout.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isLoggedIn).toBe(false);
      expect(result.current.error).toBe('Network error');
    });
  });

  describe('refresh', () => {
    it('should successfully refresh session and update user', async () => {
      mockedAuthService.autoLogin.mockResolvedValue(mockUser);
      mockedAuthService.refreshSession.mockResolvedValue(true);
      mockedAuthService.getCurrentUser.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      let refreshResult: boolean = false;
      await act(async () => {
        refreshResult = await result.current.refresh();
      });

      expect(refreshResult).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(mockedAuthService.refreshSession).toHaveBeenCalled();
      expect(mockedAuthService.getCurrentUser).toHaveBeenCalled();
    });

    it('should auto-logout on refresh failure (expired refresh token)', async () => {
      mockedAuthService.autoLogin.mockResolvedValue(mockUser);
      mockedAuthService.refreshSession.mockResolvedValue(false);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      let refreshResult: boolean = true;
      await act(async () => {
        refreshResult = await result.current.refresh();
      });

      expect(refreshResult).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.isLoggedIn).toBe(false);
    });

    it('should auto-logout on refresh error', async () => {
      mockedAuthService.autoLogin.mockResolvedValue(mockUser);
      mockedAuthService.refreshSession.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      let refreshResult: boolean = true;
      await act(async () => {
        refreshResult = await result.current.refresh();
      });

      expect(refreshResult).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('loading states', () => {
    it('should set isLoading during login', async () => {
      mockedAuthService.autoLogin.mockResolvedValue(null);
      let resolveLogin: (value: UserDto) => void;
      const loginPromise = new Promise<UserDto>((resolve) => {
        resolveLogin = resolve;
      });
      mockedAuthService.login.mockReturnValue(loginPromise);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.login({
          email: 'test@example.com',
          password: 'password123',
          rememberMe: false,
        });
      });

      // Should be loading during login
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        resolveLogin!(mockUser);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('error states', () => {
    it('should clear error on successful login after failed attempt', async () => {
      mockedAuthService.autoLogin.mockResolvedValue(null);
      mockedAuthService.login
        .mockRejectedValueOnce({ response: { message: 'Invalid credentials' } })
        .mockResolvedValueOnce(mockUser);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First login fails
      await act(async () => {
        try {
          await result.current.login({
            email: 'test@example.com',
            password: 'wrongpassword',
            rememberMe: false,
          });
        } catch (e) {
          // Expected
        }
      });

      expect(result.current.error).toBe('Invalid credentials');

      // Second login succeeds
      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'correctpassword',
          rememberMe: false,
        });
      });

      expect(result.current.error).toBeNull();
      expect(result.current.user).toEqual(mockUser);
    });
  });
});
