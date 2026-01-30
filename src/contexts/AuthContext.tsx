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

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.logout();
      setUser(null);
    } catch (err: any) {
      // On logout failure, still clear user state but log error
      const errorMsg = err?.response?.message || err?.message || 'Logout failed';
      setError(errorMsg);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const ok = await authService.refreshSession();
      if (ok) {
        const u = await authService.getCurrentUser();
        setUser(u);
      } else {
        // Refresh failed, auto-logout
        setUser(null);
      }
      return ok;
    } catch (err) {
      // On refresh failure (401/expired), auto-logout
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
