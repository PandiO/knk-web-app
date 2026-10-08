import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { authService } from '../services/authService';
import { UserDto } from '../types/dtos/auth/UserDtos';
import { LoginRequestDto, RegisterRequestDto } from '../types/dtos/auth/AuthDtos';

interface AuthContextType {
  user: UserDto | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
  login: (req: LoginRequestDto) => Promise<UserDto>;
  register: (req: RegisterRequestDto) => Promise<UserDto>;
  logout: () => Promise<void>;
  /** Ends every session of this user on every device, then this one. */
  logoutAll: () => Promise<void>;
  /** Reloads the current user, renewing an expired access token with the refresh cookie if needed. */
  refresh: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLoggedIn = !!user;

  const login = useCallback(async (req: LoginRequestDto) => {
    setIsLoading(true);
    setError(null);
    try {
      const u = await authService.login(req);
      setUser(u);
      return u;
    } catch (err: any) {
      const errorMsg = err?.response?.message || err?.message || 'Login failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (req: RegisterRequestDto) => {
    setIsLoading(true);
    setError(null);
    try {
      const u = await authService.register(req);
      setUser(u);
      return u;
    } catch (err: any) {
      const errorMsg = err?.response?.message || err?.message || 'Registration failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // authService clears the stored tokens even when the API call fails; the user state goes too.
  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.logout();
    } catch (err: any) {
      setError(err?.response?.message || err?.message || 'Logout failed');
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.logoutAll();
    } catch (err: any) {
      setError(err?.response?.message || err?.message || 'Logout failed');
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      // GET Auth/me with the stored access token; refreshes once with the cookie if it expired.
      // Without any sign of a session it doesn't call the API at all.
      const u = await authService.autoLogin();
      setUser(u);
      return !!u;
    } catch (err) {
      setUser(null);
      return false;
    }
  }, []);

  // Auto-login on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const u = await authService.autoLogin();
        if (mounted) setUser(u);
      } catch (err) {
        // Auto-login failure is silent, just leave user as null
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const value = {
    user,
    isLoggedIn,
    isLoading,
    error,
    login,
    register,
    logout,
    logoutAll,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
