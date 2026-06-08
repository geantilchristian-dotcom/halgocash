import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AuthUser {
  id: number;
  email: string;
  username: string;
  role: string;
  vendorId?: number | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error ?? "Erreur réseau") as Error & { data: unknown };
    err.data = body;
    throw err;
  }
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiFetch("/api/auth/me").catch(() => null),
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ identifier, password }: { identifier: string; password: string }) =>
      apiFetch("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      }),
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiFetch("/api/auth/logout", { method: "POST" }),
  });

  const login = async (identifier: string, password: string): Promise<AuthUser> => {
    const result = await loginMutation.mutateAsync({ identifier, password });
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    return result;
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
    queryClient.setQueryData(["/api/auth/me"], null);
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
