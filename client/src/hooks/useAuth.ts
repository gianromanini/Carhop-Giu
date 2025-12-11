import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

interface AuthError {
  status?: number;
  message?: string;
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User | null, AuthError>({
    queryKey: ["/api/auth/user"],
    retry: false,
    queryFn: async () => {
      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (res.status === 401) {
        return null;
      }
      if (res.status === 503) {
        return null;
      }
      if (!res.ok) {
        throw { status: res.status, message: await res.text() };
      }
      return res.json();
    },
  });

  const isAuthConfigured = error?.status !== 503;

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAuthConfigured,
    error,
  };
}
