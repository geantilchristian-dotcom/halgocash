import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  vendorId: number | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<unknown>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((u) => setUser(u as User))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(u as User);
    await AsyncStorage.setItem("user", JSON.stringify(u));
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    const u = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password, role: "player" }),
    });
    setUser(u as User);
    await AsyncStorage.setItem("user", JSON.stringify(u));
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    await AsyncStorage.removeItem("user");
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
