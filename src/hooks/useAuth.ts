import { useEffect, useState, useCallback } from "react";
import { authService } from "../services/authService";
import { UserDto } from "../types/dtos/auth/UserDtos";
import { LoginRequestDto, RegisterRequestDto } from "../types/dtos/auth/AuthDtos";

export function useAuth() {
  const [user, setUser] = useState<UserDto | null>(null);
  const isLoggedIn = !!user;

  const login = useCallback(async (req: LoginRequestDto) => {
    const u = await authService.login(req);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (req: RegisterRequestDto) => {
    const u = await authService.register(req);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const ok = await authService.refreshSession();
    if (ok) {
      const u = await authService.getCurrentUser();
      setUser(u);
    }
    return ok;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const u = await authService.autoLogin();
      if (mounted) setUser(u);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { user, isLoggedIn, login, register, logout, refresh };
}