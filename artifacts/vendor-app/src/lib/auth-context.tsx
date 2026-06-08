import { createContext, useContext, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe, useLogin, useRegister, useLogout } from "@workspace/api-client-react";
import type { AuthUser, LoginInput, RegisterInput } from "@workspace/api-client-react";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (data: LoginInput) => Promise<AuthUser>;
  register: (data: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe({ query: { retry: false, queryKey: ["/api/auth/me"] } });
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const logoutMutation = useLogout();

  const login = async (data: LoginInput) => {
    const result = await loginMutation.mutateAsync({ data });
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    return result;
  };

  const register = async (data: RegisterInput) => {
    const result = await registerMutation.mutateAsync({ data });
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    return result;
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
    queryClient.setQueryData(["/api/auth/me"], null);
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
