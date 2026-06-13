import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/react";

interface BalanceContextValue {
  balance: number | null;
  setBalance: (n: number) => void;
  refreshBalance: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const BalanceContext = createContext<BalanceContextValue>({
  balance: null,
  setBalance: () => {},
  refreshBalance: async () => {},
  authFetch: (url, options) => fetch(url, options),
});

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const [balance, setBalanceState] = useState<number | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = await getToken().catch(() => null);
    const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined ?? {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...options, headers, credentials: "include" });
  }, [getToken]);

  const setBalance = useCallback((n: number) => {
    const clamped = Math.max(0, Math.round(n));
    setBalanceState(clamped);
    if (user?.id) {
      try { localStorage.setItem(`halgo_balance_${user.id}`, String(clamped)); } catch { /* ignore */ }
    }
  }, [user?.id]);

  const refreshBalance = useCallback(async () => {
    if (!isSignedIn) {
      setBalanceState(null);
      return;
    }
    try {
      const res = await authFetch("/api/auth/balance");
      if (res.ok) {
        const d = await res.json() as { balance: number };
        const bal = Math.max(0, d.balance);
        if (bal > 0) {
          retryCountRef.current = 0;
          if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
          setBalanceState(bal);
          if (user?.id) {
            try { localStorage.setItem(`halgo_balance_${user.id}`, String(bal)); } catch { /* ignore */ }
          }
        } else {
          // Server returned 0 — may be a Clerk JWT timing issue; retry up to 3×
          setBalanceState(prev => (prev !== null && prev > 0) ? prev : 0);
          if (user?.id && retryCountRef.current < 3) {
            retryCountRef.current++;
            const delay = 1500 * retryCountRef.current;
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            retryTimerRef.current = setTimeout(() => {
              retryTimerRef.current = null;
              void refreshRef.current();
            }, delay);
          }
        }
      } else {
        // API error — keep current value or load from localStorage
        if (user?.id) {
          try {
            const cached = localStorage.getItem(`halgo_balance_${user.id}`);
            if (cached !== null) setBalanceState(prev => prev === null ? parseFloat(cached) : prev);
          } catch { /* ignore */ }
        }
      }
    } catch {
      // Network error — fall back to localStorage
      if (user?.id) {
        try {
          const cached = localStorage.getItem(`halgo_balance_${user.id}`);
          if (cached !== null) setBalanceState(prev => prev === null ? parseFloat(cached) : prev);
        } catch { /* ignore */ }
      }
    }
  }, [authFetch, isSignedIn, user?.id]);

  // Keep ref up to date so retryTimer can call latest version
  useEffect(() => { refreshRef.current = refreshBalance; }, [refreshBalance]);

  // On sign-in: pre-populate from localStorage then fetch from server
  useEffect(() => {
    if (!isSignedIn) {
      setBalanceState(null);
      return;
    }
    if (user?.id) {
      try {
        const cached = localStorage.getItem(`halgo_balance_${user.id}`);
        if (cached !== null) setBalanceState(prev => prev === null ? parseFloat(cached) : prev);
      } catch { /* ignore */ }
    }
    retryCountRef.current = 0;
    void refreshBalance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user?.id]);

  // Poll every 30 s to stay in sync
  useEffect(() => {
    if (!isSignedIn) return;
    const id = setInterval(() => { void refreshRef.current(); }, 30_000);
    return () => clearInterval(id);
  }, [isSignedIn]);

  return (
    <BalanceContext.Provider value={{ balance, setBalance, refreshBalance, authFetch }}>
      {children}
    </BalanceContext.Provider>
  );
}

export function useBalance() {
  return useContext(BalanceContext);
}
