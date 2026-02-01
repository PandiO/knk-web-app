import { useEffect, useState } from "react";
import { authService } from "../services/authService";
import { UserDto } from "../types/dtos/auth/UserDtos";

export function useAutoLogin(): { 
  isLoading: boolean; 
  isLoggedIn: boolean; 
  user: UserDto | null;
  error: string | null;
} {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await authService.autoLogin();
        if (mounted) {
          setUser(u);
          setError(null);
        }
      } catch (err: any) {
        // Auto-login failure is silent, but we track the error
        if (mounted) {
          setUser(null);
          setError(err?.message || 'Auto-login failed');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { isLoading, isLoggedIn: !!user, user, error };
}