import { authService } from '../authService';
import { authClient } from '../../apiClients/authClient';
import { tokenService } from '../../utils/tokenService';
import { refreshAccessToken, refreshSession } from '../sessionRefresh';
import { UserDto, AccountCreationMethod } from '../../types/dtos/auth/UserDtos';
import { AuthLoginResponseDto } from '../../types/dtos/auth/AuthDtos';

// Mock dependencies
jest.mock('../../apiClients/authClient');
jest.mock('../../utils/tokenService');
jest.mock('../sessionRefresh', () => ({ refreshAccessToken: jest.fn(), refreshSession: jest.fn() }));

const mockedAuthClient = authClient as jest.Mocked<typeof authClient>;
const mockedTokenService = tokenService as jest.Mocked<typeof tokenService>;
const mockedRefresh = refreshAccessToken as jest.MockedFunction<typeof refreshAccessToken>;
const mockedRefreshOutcome = refreshSession as jest.MockedFunction<typeof refreshSession>;

const mockUser: UserDto = {
  id: 1,
  email: 'test@example.com',
  username: 'Steve',
  emailVerified: true,
  accountCreatedVia: AccountCreationMethod.MinecraftServer,
  coins: 0,
  gems: 0,
  experiencePoints: 0,
  isActive: true,
  createdAt: new Date(),
  deletedAt: null,
};

const loginResponse: AuthLoginResponseDto = {
  accessToken: 'access-token',
  refreshToken: null,
  expiresIn: 1800,
  user: mockUser,
};

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('sends the login identifier and stores the token with remember-me', async () => {
      mockedAuthClient.login.mockResolvedValue(loginResponse);

      const result = await authService.login({ login: 'Steve', password: 'password123', rememberMe: true });

      expect(result).toEqual(mockUser);
      expect(mockedAuthClient.login).toHaveBeenCalledWith({ login: 'Steve', password: 'password123', rememberMe: true });
      expect(mockedTokenService.setAccessToken).toHaveBeenCalledWith('access-token', true);
      expect(mockedTokenService.setRememberMe).toHaveBeenCalledWith(true, expect.any(Number));
    });

    it('keeps the token in the session without remember-me (the default)', async () => {
      mockedAuthClient.login.mockResolvedValue(loginResponse);

      await authService.login({ login: 'test@example.com', password: 'password123' });

      expect(mockedAuthClient.login).toHaveBeenCalledWith({ login: 'test@example.com', password: 'password123', rememberMe: false });
      expect(mockedTokenService.setAccessToken).toHaveBeenCalledWith('access-token', false);
      expect(mockedTokenService.setRememberMe).not.toHaveBeenCalled();
      expect(mockedTokenService.clearRememberMe).toHaveBeenCalled();
    });

    it('never reads a refresh token from the body', async () => {
      mockedAuthClient.login.mockResolvedValue({ ...loginResponse, refreshToken: 'leaked' as unknown as null });

      await authService.login({ login: 'Steve', password: 'password123' });

      expect(mockedTokenService.setAccessToken).toHaveBeenCalledTimes(1);
      expect(mockedTokenService.setAccessToken).toHaveBeenCalledWith('access-token', false);
    });

    it('stores nothing when the login fails', async () => {
      const error = { code: 'InvalidCredentials', status: 401 };
      mockedAuthClient.login.mockRejectedValue(error);

      await expect(authService.login({ login: 'Steve', password: 'wrong' })).rejects.toEqual(error);

      expect(mockedTokenService.setAccessToken).not.toHaveBeenCalled();
      expect(mockedTokenService.setRememberMe).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    const request = { linkCode: 'ABCD1234', email: 'new@example.com', password: 'S3cure!pass', passwordConfirmation: 'S3cure!pass' };

    it('registers through Auth/register and starts a session without remember-me', async () => {
      mockedAuthClient.register.mockResolvedValue(loginResponse);

      const user = await authService.register(request);

      expect(user).toEqual(mockUser);
      expect(mockedAuthClient.register).toHaveBeenCalledWith(request);
      expect(mockedAuthClient.login).not.toHaveBeenCalled();
      expect(mockedTokenService.setAccessToken).toHaveBeenCalledWith('access-token', false);
      expect(mockedTokenService.setRememberMe).not.toHaveBeenCalled();
    });

    it('passes API errors through', async () => {
      const error = { code: 'DuplicateEmail', status: 409 };
      mockedAuthClient.register.mockRejectedValue(error);

      await expect(authService.register(request)).rejects.toEqual(error);
      expect(mockedTokenService.setAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('logs out and clears local state', async () => {
      mockedAuthClient.logout.mockResolvedValue(undefined);

      await authService.logout();

      expect(mockedAuthClient.logout).toHaveBeenCalled();
      expect(mockedTokenService.clearAll).toHaveBeenCalled();
    });

    it('clears local state even when the API call fails', async () => {
      mockedAuthClient.logout.mockRejectedValue(new Error('Network error'));

      await expect(authService.logout()).rejects.toThrow('Network error');
      expect(mockedTokenService.clearAll).toHaveBeenCalled();
    });

    it('logs out everywhere and clears local state', async () => {
      mockedAuthClient.logoutAll.mockRejectedValue(new Error('down'));

      await expect(authService.logoutAll()).rejects.toThrow('down');
      expect(mockedAuthClient.logoutAll).toHaveBeenCalled();
      expect(mockedTokenService.clearAll).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('returns the current user', async () => {
      mockedAuthClient.me.mockResolvedValue(mockUser);
      await expect(authService.getCurrentUser()).resolves.toEqual(mockUser);
    });

    it('returns null on any error', async () => {
      mockedAuthClient.me.mockRejectedValue({ status: 401 });
      await expect(authService.getCurrentUser()).resolves.toBeNull();
    });
  });

  describe('refreshSession', () => {
    it('uses the shared single-flight refresh', async () => {
      mockedRefresh.mockResolvedValue(true);
      await expect(authService.refreshSession()).resolves.toBe(true);
      expect(mockedRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('autoLogin', () => {
    it('does not call the API without any sign of a session', async () => {
      mockedTokenService.hasAccessToken.mockReturnValue(false);
      mockedTokenService.isRemembered.mockReturnValue(false);

      await expect(authService.autoLogin()).resolves.toBeNull();
      expect(mockedAuthClient.me).not.toHaveBeenCalled();
      expect(mockedRefreshOutcome).not.toHaveBeenCalled();
    });

    it('returns the user when the stored token is still valid', async () => {
      mockedTokenService.hasAccessToken.mockReturnValue(true);
      mockedAuthClient.me.mockResolvedValue(mockUser);

      await expect(authService.autoLogin()).resolves.toEqual(mockUser);
      expect(mockedRefreshOutcome).not.toHaveBeenCalled();
    });

    it('refreshes once when the stored token expired, also without remember-me', async () => {
      mockedTokenService.hasAccessToken.mockReturnValue(true);
      mockedTokenService.isRemembered.mockReturnValue(false);
      mockedAuthClient.me.mockRejectedValueOnce({ status: 401 }).mockResolvedValueOnce(mockUser);
      mockedRefreshOutcome.mockResolvedValue('renewed');

      await expect(authService.autoLogin()).resolves.toEqual(mockUser);
      expect(mockedRefreshOutcome).toHaveBeenCalledTimes(1);
      expect(mockedAuthClient.me).toHaveBeenCalledTimes(2);
    });

    it('clears the stored session when the API rejects the refresh', async () => {
      mockedTokenService.hasAccessToken.mockReturnValue(false);
      mockedTokenService.isRemembered.mockReturnValue(true);
      mockedAuthClient.me.mockRejectedValue({ status: 401 });
      mockedRefreshOutcome.mockResolvedValue('rejected');

      await expect(authService.autoLogin()).resolves.toBeNull();
      expect(mockedTokenService.clearAll).toHaveBeenCalled();
    });

    it('keeps the stored session when the API cannot be reached', async () => {
      mockedTokenService.hasAccessToken.mockReturnValue(true);
      mockedAuthClient.me.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(authService.autoLogin()).resolves.toBeNull();
      expect(mockedRefreshOutcome).not.toHaveBeenCalled();
      expect(mockedTokenService.clearAll).not.toHaveBeenCalled();
    });

    it('keeps the stored session when Auth/me answers 5xx', async () => {
      mockedTokenService.hasAccessToken.mockReturnValue(true);
      mockedAuthClient.me.mockRejectedValue({ status: 503 });

      await expect(authService.autoLogin()).resolves.toBeNull();
      expect(mockedTokenService.clearAll).not.toHaveBeenCalled();
    });

    it('keeps the stored session when the refresh itself fails transiently', async () => {
      mockedTokenService.hasAccessToken.mockReturnValue(false);
      mockedTokenService.isRemembered.mockReturnValue(true);
      mockedAuthClient.me.mockRejectedValue({ status: 401 });
      mockedRefreshOutcome.mockResolvedValue('unavailable');

      await expect(authService.autoLogin()).resolves.toBeNull();
      expect(mockedTokenService.clearAll).not.toHaveBeenCalled();
    });

    it('clears the stored session when the renewed token is still refused', async () => {
      mockedTokenService.hasAccessToken.mockReturnValue(true);
      mockedAuthClient.me.mockRejectedValue({ status: 401 });
      mockedRefreshOutcome.mockResolvedValue('renewed');

      await expect(authService.autoLogin()).resolves.toBeNull();
      expect(mockedTokenService.clearAll).toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('stores the fresh access token an email change returns', async () => {
      mockedTokenService.isRemembered.mockReturnValue(true);
      mockedAuthClient.updateUser.mockResolvedValue({ user: mockUser, accessToken: 'fresh-token' });

      await authService.updateUser({ email: 'new@example.com', currentPassword: 'pw' });

      expect(mockedAuthClient.updateUser).toHaveBeenCalledWith({ email: 'new@example.com', currentPassword: 'pw' });
      expect(mockedTokenService.setAccessToken).toHaveBeenCalledWith('fresh-token', true);
    });

    it('keeps the current token when none is returned', async () => {
      mockedAuthClient.updateUser.mockResolvedValue({ user: mockUser });

      await authService.updateUser({ newPassword: 'n', currentPassword: 'c' });

      expect(mockedTokenService.setAccessToken).not.toHaveBeenCalled();
    });
  });
});
