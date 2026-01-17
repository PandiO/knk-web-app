import { useEffect, useState } from "react";
import { authService } from "../services/authService";
import { UserDto } from "../types/dtos/auth/UserDtos";

export function useAutoLogin(): { isLoading: boolean; isLoggedIn: boolean; user: UserDto | null } {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserDto | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const u = await authService.autoLogin();
      if (mounted) {
        setUser(u);
        setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { isLoading, isLoggedIn: !!user, user };
}