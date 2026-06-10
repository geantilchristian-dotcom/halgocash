import { useState, useCallback, useEffect, useRef } from "react";
import {
  X, QrCode, Sparkles, Loader2,
  ChevronRight, Eye, EyeOff,
  Ticket, AlertCircle, CheckCircle, Scan,
  Home as HomeIcon, User, Settings,
  Bell, CheckCheck, Clock, Shield, Lock, Camera, Tag,
} from "lucide-react";
import { useUser, useAuth } from "@clerk/react";
import { QRCodeSVG } from "qrcode.react";
import { useLocation } from "wouter";
import { QrScanner } from "@/components/qr-scanner";

function formatFC(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(amount)).replace(/\s/g, ".");
}

function useRollingCounter(target: number | null) {
  const [display, setDisplay] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (target === null) { setDisplay(0); return; }
    const STEPS = 40, DURATION = 1400, INTERVAL = DURATION / STEPS;
    let step = 0;
    timerRef.current = setInterval(() => {
      step++;
      if (step >= STEPS) { setDisplay(target); clearInterval(timerRef.current!); }
      else { const t = step / STEPS; setDisplay(Math.round((1 - Math.pow(1 - t, 2.5)) * target)); }
    }, INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [target]);
  return display;
}

function useJackpotCountdown() {
  const getNextSunday = () => {
    const now = new Date();
    const next = new Date(now);
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    next.setDate(now.getDate() + daysUntilSunday);
    next.setHours(23, 59, 59, 0);
    return next;
  };
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.floor((getNextSunday().getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, Math.floor((getNextSunday().getTime() - Date.now()) / 1000))), 1000);
    return () => clearInterval(id);
  }, []);
  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  return `${String(d).padStart(2, "0")}j ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

const GAMES = [
  {
    name: "Aviator",
    badge: "TOP",
    badgeColor: "#e74c3c",
    bg: "linear-gradient(160deg,#2a0808 0%,#5a1010 50%,#1a0505 100%)",
    previewBg: "radial-gradient(ellipse at 50% 80%, #c0392b44 0%, transparent 70%)",
    icon: "✈️",
    iconSize: "2.8rem",
    glow: "#c0392b",
    players: "2 841",
    multiplier: null,
    accent: "#e74c3c",
  },
  {
    name: "JetX",
    badge: "TOP",
    badgeColor: "#e74c3c",
    bg: "linear-gradient(160deg,#08081a 0%,#101840 50%,#050512 100%)",
    previewBg: "radial-gradient(ellipse at 50% 80%, #2980b955 0%, transparent 70%)",
    icon: "🚀",
    iconSize: "2.8rem",
    glow: "#3498db",
    players: "1 623",
    multiplier: null,
    accent: "#3498db",
  },
  {
    name: "Mines",
    badge: "NOUVEAU",
    badgeColor: "#22a84a",
    bg: "linear-gradient(160deg,#081418 0%,#0d2a3a 50%,#050e12 100%)",
    previewBg: "radial-gradient(ellipse at 50% 80%, #1abc9c55 0%, transparent 70%)",
    icon: "💎",
    iconSize: "2.8rem",
    glow: "#1abc9c",
    players: "987",
    multiplier: null,
    accent: "#1abc9c",
  },
  {
    name: "Crash",
    badge: "TOP",
    badgeColor: "#e74c3c",
    bg: "linear-gradient(160deg,#0a1008 0%,#162a10 50%,#070f05 100%)",
    previewBg: "radial-gradient(ellipse at 50% 80%, #27ae6055 0%, transparent 70%)",
    icon: "📈",
    iconSize: "2.4rem",
    glow: "#2ecc71",
    players: "3 210",
    multiplier: "12.45×",
    accent: "#2ecc71",
  },
];

interface Notif {
  id: number;
  type: "withdrawal_paid";
  message: string;
  amount: number;
  paidAt: string;
}

export default function Home() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [, navigate] = useLocation();
  const countdown = useJackpotCountdown();

  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = await getToken().catch(() => null);
    const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined ?? {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...options, headers, credentials: "include" });
  }, [getToken]);

  // ── State ──
  const [showRetrait,     setShowRetrait]     = useState(false);
  const [showTicketInput, setShowTicketInput] = useState(false);
  const [balanceHidden,   setBalanceHidden]   = useState(false);
  const [showNotifPanel,  setShowNotifPanel]  = useState(false);

  // Notifications
  const [notifs,      setNotifs]      = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Balance
  const [balance, setBalance] = useState<number | null>(() => {
    try { const v = localStorage.getItem("halgo_balance"); return v !== null ? parseFloat(v) : null; }
    catch { return null; }
  });
  const [balanceFlash, setBalanceFlash] = useState(false);

  // Ticket activation
  const [ticketCode,       setTicketCode]       = useState("");
  const [activating,       setActivating]       = useState(false);
  const [activationResult, setActivationResult] = useState<{
    code: string; isWinner: boolean; prizeAmount: number | null; prizeLabel: string;
  } | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);

  // QR Scanner
  const [showQrScanner, setShowQrScanner] = useState(false);

  // Retrait
  const [retraitAmount,  setRetraitAmount]  = useState("");
  const [retraitLoading, setRetraitLoading] = useState(false);
  const [retraitQR,      setRetraitQR]      = useState<{ token: string; amount: number; qrValue: string } | null>(null);
  const [retraitError,   setRetraitError]   = useState<string | null>(null);
  const [retraitPaid,    setRetraitPaid]    = useState<{ paidAt: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch helpers ──
  const fetchBalance = useCallback(async () => {
    try {
      const res = await authFetch("/api/auth/balance");
      if (res.ok) {
        const d = await res.json() as { balance: number };
        if (d.balance > 0) {
          // Server returned a real balance — it can authenticate us, clear local tracking
          localWinsRef.current = 0;
          setBalance(d.balance);
          try { localStorage.setItem("halgo_balance", String(d.balance)); } catch { /* ignore */ }
        } else if (localWinsRef.current > 0) {
          // Server returned 0 but we have locally tracked wins (server auth failure on Render)
          // Do NOT overwrite — keep the locally computed balance
        } else {
          // Server returned 0 with no pending local wins — trust it (e.g. after full withdrawal)
          setBalance(0);
          try { localStorage.setItem("halgo_balance", "0"); } catch { /* ignore */ }
        }
      }
    } catch { /* silent */ }
  }, [authFetch]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await authFetch("/api/auth/notifications");
      if (!res.ok) return;
      const data = await res.json() as { count: number; items: Notif[] };
      setNotifs(data.items);
      const lastSeen = localStorage.getItem("halgo_notif_seen");
      const lastSeenTs = lastSeen ? parseInt(lastSeen) : 0;
      const unread = data.items.filter((n) => new Date(n.paidAt).getTime() > lastSeenTs).length;
      setUnreadCount(unread);
    } catch { /* silent */ }
  }, [authFetch]);

  // Only fetch once Clerk has finished loading — avoids a race where the
  // unauthenticated first fetch (no token) returns 0 and overwrites the real balance.
  useEffect(() => { if (isLoaded) { void fetchBalance(); void fetchNotifications(); } }, [isLoaded]);

  // QR scan auto-fill
  // Tracks locally-confirmed wins not yet reflected by server balance.
  // Prevents a server balance:0 (auth failure) from wiping real wins.
  const localWinsRef = useRef(0);

  const autoSubmitRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code");
    if (urlCode) {
      const cleaned = urlCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10);
      if (cleaned) { setTicketCode(cleaned); setShowTicketInput(true); autoSubmitRef.current = true; window.history.replaceState({}, "", window.location.pathname); }
    }
  }, []);

  const rollingAmount = useRollingCounter(activationResult?.isWinner ? (activationResult.prizeAmount ?? 0) : null);
  const isAnimating   = activationResult?.isWinner && rollingAmount < (activationResult.prizeAmount ?? 0);

  useEffect(() => {
    if (activationResult?.isWinner) { setBalanceFlash(true); const t = setTimeout(() => setBalanceFlash(false), 700); return () => clearTimeout(t); }
    return undefined;
  }, [activationResult?.code, activationResult?.isWinner]);

  useEffect(() => {
    const name = user?.fullName ?? user?.username ?? "Utilisateur";
    const ping = () => authFetch("/api/auth/ping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => {});
    ping();
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, [user?.id]);

  const activateTicket = useCallback(async () => {
    const code = ticketCode.trim().toUpperCase();
    if (!code) return;
    setActivating(true); setActivationError(null); setActivationResult(null);
    try {
      const res = await authFetch("/api/tickets/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.alreadyUsed) {
          setActivationResult({ code, isWinner: data.isWinner ?? false, prizeAmount: data.prizeAmount ?? null, prizeLabel: data.prizeLabel ?? (data.isWinner ? "Gagnant" : "Perdu") });
        } else { setActivationError(data.error || "Code introuvable"); }
      } else {
        setActivationResult(data);
        if (data.isWinner && data.prizeAmount) {
          if (typeof data.newBalance === "number") {
            // Server confirmed balance — reset local tracking and use server value
            localWinsRef.current = 0;
            setBalance(data.newBalance);
            try { localStorage.setItem("halgo_balance", String(data.newBalance)); } catch { /* ignore */ }
            setTimeout(() => { void fetchBalance(); }, 2000);
          } else {
            // Server couldn't compute balance (Clerk auth failing on server) —
            // increment locally and track so fetchBalance won't wipe it with 0
            localWinsRef.current += data.prizeAmount as number;
            setBalance((prev) => { const nb = (prev ?? 0) + (data.prizeAmount as number); try { localStorage.setItem("halgo_balance", String(nb)); } catch { /* ignore */ } return nb; });
            // Still try to refetch — it will NOT overwrite thanks to localWinsRef guard
            setTimeout(() => { void fetchBalance(); }, 2000);
          }
          setBalanceFlash(true);
        } else { void fetchBalance(); }
      }
    } catch { setActivationError("Erreur de connexion"); }
    finally { setActivating(false); }
  }, [ticketCode, fetchBalance, authFetch]);

  useEffect(() => {
    if (autoSubmitRef.current && ticketCode) { autoSubmitRef.current = false; void activateTicket(); }
  }, [ticketCode, activateTicket]);

  const resetActivation = () => { setTicketCode(""); setActivationResult(null); setActivationError(null); setShowTicketInput(false); };

  // Auto-reset input after showing result (keep card open, just clear result + code)
  const autoResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activationResult) return;
    if (autoResetRef.current) clearTimeout(autoResetRef.current);
    // Winners: wait for rolling animation (1.4s) + 2s to read → 3.5s total
    // Losers: 2s then ready for next ticket
    const delay = activationResult.isWinner ? 3500 : 2000;
    autoResetRef.current = setTimeout(() => {
      setActivationResult(null);
      setTicketCode("");
      setActivationError(null);
      // Keep showTicketInput = true so card stays expanded, ready for next code
    }, delay);
    return () => { if (autoResetRef.current) clearTimeout(autoResetRef.current); };
  }, [activationResult?.code]);

  // Retrait polling
  useEffect(() => {
    if (!retraitQR || retraitPaid) { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } return; }
    pollRef.current = setInterval(async () => {
      try {
        const res = await authFetch("/api/withdrawals/my");
        if (!res.ok) return;
        const data = await res.json() as Array<{ token: string; status: string; paidAt: string | null }>;
        const match = data.find((w) => w.token === retraitQR.token);
        if (match?.status === "paid" && match.paidAt) {
          clearInterval(pollRef.current!); pollRef.current = null;
          setRetraitPaid({ paidAt: match.paidAt });
          void fetchBalance();
          void fetchNotifications();
        }
      } catch { /* silent */ }
    }, 3000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [retraitQR, retraitPaid]);

  const cancelPendingRetrait = async (token: string) => {
    try { await authFetch(`/api/withdrawals/${encodeURIComponent(token)}`, { method: "DELETE" }); } catch { /* silent */ }
  };
  const closeRetrait = () => {
    if (retraitQR && !retraitPaid) void cancelPendingRetrait(retraitQR.token);
    setShowRetrait(false); setRetraitQR(null); setRetraitPaid(null); setRetraitAmount(""); setRetraitError(null);
    void fetchBalance();
  };
  const openRetrait = () => { setRetraitAmount(""); setRetraitQR(null); setRetraitPaid(null); setRetraitError(null); setShowRetrait(true); };
  const submitRetrait = async () => {
    const amt = parseFloat(retraitAmount.replace(/\s/g, "").replace(",", "."));
    if (!amt || amt <= 0) { setRetraitError("Entrez un montant valide"); return; }
    if (!balance || amt > balance) { setRetraitError("Montant supérieur à votre solde disponible"); return; }
    setRetraitError(null); setRetraitLoading(true);
    try {
      const res = await authFetch("/api/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: amt }) });
      const data = await res.json() as { token?: string; error?: string };
      if (!res.ok) { setRetraitError(data.error ?? "Erreur serveur"); return; }
      setRetraitQR({ token: data.token!, amount: amt, qrValue: data.token! });
    } catch { setRetraitError("Erreur de connexion"); }
    finally { setRetraitLoading(false); }
  };

  const openNotifPanel = () => {
    setShowNotifPanel(true);
    setUnreadCount(0);
    try { localStorage.setItem("halgo_notif_seen", String(Date.now())); } catch { /* ignore */ }
  };

  const quickAmounts = balance && balance > 0 ? [0.25, 0.5, 0.75, 1].map((f) => Math.floor(balance * f)) : [];

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "#0b1612" }}>

      {/* ═══════════════ HEADER — style betPawa ═══════════════ */}
      <header
        className="flex items-center justify-between px-4 pt-4 pb-3 gap-3"
        style={{ background: "#0f1f12" }}
      >
        {/* Left: logo "halgocash" lowercase two-tone */}
        <div className="flex items-baseline gap-0 select-none shrink-0">
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif",
              fontWeight: 900,
              fontSize: "1.55rem",
              color: "#ffffff",
              letterSpacing: "-0.02em",
              lineHeight: 1,
              fontStyle: "italic",
            }}
          >
            halgo
          </span>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif",
              fontWeight: 900,
              fontSize: "1.55rem",
              color: "#8DC63F",
              letterSpacing: "-0.02em",
              lineHeight: 1,
              fontStyle: "italic",
            }}
          >
            Cash
          </span>
        </div>

        {/* Right: bell + balance chip */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Bell */}
          <button
            onClick={openNotifPanel}
            className="relative w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: "rgba(255,255,255,0.07)" }}
          >
            <Bell style={{ width: 18, height: 18, color: "rgba(255,255,255,0.65)" }} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full flex items-center justify-center text-[8px] font-black px-0.5"
                style={{ background: "#e67e22", color: "#fff" }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Balance pill — eye + amount FC */}
          <div
            className="flex items-center gap-1.5 px-3 h-9 rounded-full"
            style={{ background: "#1e2e21", border: "1px solid rgba(141,198,63,0.2)" }}
          >
            <button
              onClick={() => setBalanceHidden((h) => !h)}
              className="flex items-center justify-center transition-all active:scale-90"
            >
              {balanceHidden
                ? <EyeOff style={{ width: 14, height: 14, color: "rgba(255,255,255,0.45)" }} />
                : <Eye    style={{ width: 14, height: 14, color: "rgba(255,255,255,0.55)" }} />}
            </button>
            {balance === null ? (
              <div className="h-3.5 w-14 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
            ) : (
              <span
                className="font-black leading-none"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "0.82rem",
                  color: balanceFlash ? "#8DC63F" : "#ffffff",
                  transition: "color 0.4s",
                  letterSpacing: "0.01em",
                  whiteSpace: "nowrap",
                }}
              >
                {balanceHidden ? "•••" : formatFC(balance)}
                <span className="font-bold ml-1" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem" }}>FC</span>
              </span>
            )}
          </div>

          {/* Green "+" button — opens retrait */}
          <button
            onClick={openRetrait}
            className="w-9 h-9 rounded-full flex items-center justify-center font-black text-xl transition-all active:scale-90"
            style={{
              background: "#8DC63F",
              color: "#0a1f0e",
              boxShadow: "0 2px 10px rgba(141,198,63,0.4)",
              lineHeight: 1,
            }}
          >
            +
          </button>
        </div>
      </header>

      {/* ═══════════════ SCROLLABLE CONTENT ═══════════════ */}
      <div className="flex-1 px-4 pb-28 space-y-4 mt-3 overflow-y-auto">

        {/* ── Jackpot Banner ── */}
        <div
          className="relative rounded-2xl overflow-hidden p-5"
          style={{
            background: "linear-gradient(135deg,#0d3320 0%,#165c2a 50%,#1a7a36 100%)",
            border: "1px solid rgba(141,198,63,0.3)",
            boxShadow: "0 8px 32px rgba(22,92,40,0.5)",
          }}
        >
          <div
            className="absolute right-4 top-1/2 -translate-y-1/2 select-none pointer-events-none"
            style={{ fontSize: 72, lineHeight: 1, filter: "drop-shadow(0 4px 16px rgba(245,197,24,0.6))" }}
          >🏆</div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>
            JACKPOT HEBDOMADAIRE
          </p>
          <p className="font-black leading-none" style={{ fontFamily: "'Oswald', sans-serif", fontSize: "2.1rem", color: "#F5C518", textShadow: "0 0 24px rgba(245,197,24,0.5)", letterSpacing: "0.04em" }}>
            5 000 000 <span className="text-2xl">CDF</span>
          </p>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Clock style={{ width: 11, height: 11, color: "rgba(255,255,255,0.45)" }} />
              <span className="text-[10px] font-bold uppercase" style={{ color: "rgba(255,255,255,0.45)" }}>FIN DANS</span>
              <span className="text-[11px] font-black text-white">{countdown}</span>
            </div>
            <button
              className="flex items-center gap-1 px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-wide"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              PARTICIPER <ChevronRight style={{ width: 13, height: 13 }} />
            </button>
          </div>
        </div>

        {/* ── Jeux Populaires ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-black text-[13px] uppercase tracking-wider">JEUX POPULAIRES</span>
            <button className="text-[11px] font-bold flex items-center gap-0.5" style={{ color: "#8DC63F" }}>
              Voir tout <ChevronRight style={{ width: 12, height: 12 }} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
            {GAMES.map((g) => (
              <div
                key={g.name}
                className="shrink-0 rounded-2xl overflow-hidden relative transition-all active:scale-[0.96] cursor-pointer flex flex-col"
                style={{
                  width: 120,
                  height: 158,
                  background: g.bg,
                  border: `1px solid ${g.accent}30`,
                  boxShadow: `0 6px 20px ${g.glow}35, 0 2px 6px rgba(0,0,0,0.5)`,
                }}
              >
                {/* Preview zone — top 60% */}
                <div
                  className="relative flex-1 flex items-center justify-center overflow-hidden"
                  style={{ background: g.previewBg }}
                >
                  {/* Subtle grid lines for depth */}
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: `linear-gradient(${g.accent}60 1px, transparent 1px), linear-gradient(90deg, ${g.accent}60 1px, transparent 1px)`,
                      backgroundSize: "18px 18px",
                    }}
                  />
                  {/* Glow orb behind icon */}
                  <div
                    className="absolute rounded-full"
                    style={{
                      width: 60, height: 60,
                      background: `radial-gradient(circle, ${g.glow}55 0%, transparent 70%)`,
                      filter: "blur(8px)",
                    }}
                  />
                  {/* Multiplier or icon */}
                  {g.multiplier ? (
                    <div className="flex flex-col items-center gap-0.5 relative z-10">
                      <span style={{ fontSize: g.iconSize, filter: `drop-shadow(0 0 10px ${g.glow})` }}>{g.icon}</span>
                      <span
                        className="font-black"
                        style={{
                          fontSize: "1.15rem",
                          color: g.accent,
                          textShadow: `0 0 14px ${g.glow}`,
                          lineHeight: 1,
                        }}
                      >
                        {g.multiplier}
                      </span>
                    </div>
                  ) : (
                    <span
                      className="relative z-10"
                      style={{
                        fontSize: g.iconSize,
                        filter: `drop-shadow(0 0 12px ${g.glow}) drop-shadow(0 4px 8px rgba(0,0,0,0.6))`,
                        lineHeight: 1,
                      }}
                    >
                      {g.icon}
                    </span>
                  )}
                  {/* Badge top-left */}
                  <div
                    className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wide"
                    style={{
                      background: g.badge === "NOUVEAU" ? g.badgeColor : "rgba(0,0,0,0.55)",
                      color: g.badge === "NOUVEAU" ? "#fff" : "#F5C518",
                      border: g.badge === "NOUVEAU" ? "none" : `1px solid ${g.accent}80`,
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    {g.badge}
                  </div>
                </div>

                {/* Bottom info zone */}
                <div
                  className="px-2.5 pt-2 pb-2.5 flex flex-col gap-1.5"
                  style={{ borderTop: `1px solid ${g.accent}20` }}
                >
                  {/* Name + live dot */}
                  <div className="flex items-center justify-between">
                    <span className="text-white font-black text-[12px] tracking-wide leading-none">{g.name}</span>
                    <div className="flex items-center gap-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ background: "#22c55e", boxShadow: "0 0 4px #22c55e" }}
                      />
                      <span className="text-[8px] font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>LIVE</span>
                    </div>
                  </div>
                  {/* Player count */}
                  <p className="text-[8px] font-semibold" style={{ color: "rgba(255,255,255,0.38)" }}>
                    👥 {g.players} joueurs
                  </p>
                  {/* JOUER button */}
                  <button
                    className="w-full py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide"
                    style={{
                      background: `linear-gradient(135deg, ${g.accent}dd, ${g.accent}88)`,
                      color: "#fff",
                      boxShadow: `0 2px 8px ${g.glow}40`,
                    }}
                  >
                    JOUER
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Promotions ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-black text-[13px] uppercase tracking-wider">PROMOTIONS</span>
            <button className="text-[11px] font-bold flex items-center gap-0.5" style={{ color: "#8DC63F" }}>
              Voir tout <ChevronRight style={{ width: 12, height: 12 }} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {/* ── Bonus de Bienvenue ── */}
            <div
              className="rounded-2xl flex flex-col items-center pt-3 pb-3 px-2 gap-1.5"
              style={{
                background: "linear-gradient(160deg,#0e2a12 0%,#163d1c 60%,#0a1f0e 100%)",
                border: "1px solid rgba(34,197,94,0.25)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              {/* 3D medal */}
              <div
                className="relative w-14 h-14 rounded-full flex items-center justify-center mb-0.5"
                style={{
                  background: "radial-gradient(circle at 38% 32%, #3ecf6a, #1a7a36 55%, #0b4a1f)",
                  boxShadow: "0 0 18px rgba(34,197,94,0.55), 0 0 36px rgba(34,197,94,0.2), inset 0 2px 5px rgba(255,255,255,0.18), inset 0 -3px 6px rgba(0,0,0,0.35)",
                  border: "1.5px solid rgba(34,197,94,0.55)",
                }}
              >
                <span style={{ fontSize: "1.75rem", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.6))" }}>🎁</span>
              </div>
              <p className="text-[9.5px] font-black text-white text-center leading-tight tracking-wide uppercase">BONUS DE<br/>BIENVENUE</p>
              <p className="text-[8px] text-center leading-tight" style={{ color: "rgba(255,255,255,0.5)" }}>100% jusqu'à<br/>50 000 FC</p>
              <button
                className="w-full py-2 rounded-xl text-[8.5px] font-black uppercase tracking-wide mt-auto"
                style={{ background: "linear-gradient(135deg,#1a6b2f,#22a84a)", color: "#fff", boxShadow: "0 3px 10px rgba(22,107,47,0.5)" }}
              >
                EN PROFITER
              </button>
            </div>

            {/* ── Cashback 10% ── */}
            <div
              className="rounded-2xl flex flex-col items-center pt-3 pb-3 px-2 gap-1.5"
              style={{
                background: "linear-gradient(160deg,#1e1400 0%,#2e1e00 60%,#1a1000 100%)",
                border: "1px solid rgba(245,197,24,0.35)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              {/* 3D gold coin */}
              <div
                className="relative w-14 h-14 rounded-full flex items-center justify-center mb-0.5"
                style={{
                  background: "radial-gradient(circle at 38% 32%, #f5d060, #d4a017 55%, #8a6500)",
                  boxShadow: "0 0 18px rgba(245,197,24,0.6), 0 0 36px rgba(245,197,24,0.25), inset 0 2px 5px rgba(255,255,255,0.3), inset 0 -3px 6px rgba(0,0,0,0.4)",
                  border: "1.5px solid rgba(245,197,24,0.7)",
                }}
              >
                {/* % symbol in gold coin style */}
                <span
                  className="font-black select-none"
                  style={{
                    fontSize: "1.4rem",
                    color: "#7a4800",
                    textShadow: "0 1px 3px rgba(0,0,0,0.4), 0 -1px 0 rgba(255,255,255,0.25)",
                    lineHeight: 1,
                  }}
                >
                  %
                </span>
              </div>
              <p className="text-[9.5px] font-black text-center leading-tight tracking-wide uppercase" style={{ color: "#F5C518" }}>CASHBACK<br/>10%</p>
              <p className="text-[8px] text-center leading-tight" style={{ color: "rgba(255,255,255,0.5)" }}>chaque semaine<br/>sur vos pertes</p>
              <button
                className="w-full py-2 rounded-xl text-[8.5px] font-black uppercase tracking-wide mt-auto"
                style={{ background: "linear-gradient(135deg,#c8960a,#F5C518)", color: "#3a1f00", boxShadow: "0 3px 10px rgba(200,150,10,0.5)" }}
              >
                EN PROFITER
              </button>
            </div>

            {/* ── Jackpot du Samedi ── */}
            <div
              className="rounded-2xl flex flex-col items-center pt-3 pb-3 px-2 gap-1.5"
              style={{
                background: "linear-gradient(160deg,#0e2a12 0%,#163d1c 60%,#0a1f0e 100%)",
                border: "1px solid rgba(245,197,24,0.3)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              {/* 3D gold trophy */}
              <div
                className="relative w-14 h-14 rounded-full flex items-center justify-center mb-0.5"
                style={{
                  background: "radial-gradient(circle at 38% 32%, #f5d060, #c8960a 55%, #7a5800)",
                  boxShadow: "0 0 18px rgba(245,197,24,0.55), 0 0 36px rgba(245,197,24,0.2), inset 0 2px 5px rgba(255,255,255,0.25), inset 0 -3px 6px rgba(0,0,0,0.4)",
                  border: "1.5px solid rgba(245,197,24,0.6)",
                }}
              >
                <span style={{ fontSize: "1.75rem", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.6))" }}>🏆</span>
              </div>
              <p className="text-[9.5px] font-black text-white text-center leading-tight tracking-wide uppercase">JACKPOT<br/>DU SAMEDI</p>
              <p className="text-[8px] text-center leading-tight" style={{ color: "rgba(255,255,255,0.5)" }}>5 000 000 FC<br/>à gagner</p>
              <button
                className="w-full py-2 rounded-xl text-[8.5px] font-black uppercase tracking-wide mt-auto"
                style={{ background: "rgba(141,198,63,0.15)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.35)", boxShadow: "0 2px 8px rgba(141,198,63,0.2)" }}
              >
                EN SAVOIR +
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════ ACTIVER MON TICKET CTA ══════════════ */}
        <button
          onClick={() => setShowTicketInput(true)}
          className="w-full rounded-2xl overflow-hidden transition-all active:scale-[0.97]"
          style={{
            background: "linear-gradient(135deg,#0f3d1c 0%,#1a5c2a 100%)",
            border: "1.5px solid rgba(141,198,63,0.4)",
            boxShadow: "0 6px 24px rgba(22,92,42,0.45)",
          }}
        >
          <div className="flex items-center gap-4 px-5 py-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg,#1a6b2f,#22a84a)", boxShadow: "0 4px 14px rgba(34,168,74,0.45)" }}
            >
              <Ticket style={{ width: 24, height: 24, color: "#fff" }} strokeWidth={2.5} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-black text-[15px] text-white tracking-wide uppercase">ACTIVER MON TICKET</p>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Entrez votre code et tentez votre chance</p>
            </div>
            <div
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-[12px] uppercase tracking-wide shrink-0"
              style={{ background: "rgba(141,198,63,0.2)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.35)" }}
            >
              JOUER <ChevronRight style={{ width: 14, height: 14 }} />
            </div>
          </div>
        </button>

      </div>

      {/* ═══════════════ QR SCANNER OVERLAY ═══════════════ */}
      {showQrScanner && (
        <QrScanner
          onResult={(raw) => {
            setShowQrScanner(false);
            let code = raw.trim();
            try { const url = new URL(raw); const p = url.searchParams.get("code"); if (p) code = p; } catch { /* raw */ }
            code = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10);
            setTicketCode(code);
            setActivationError(null);
            // Use autoSubmitRef pattern so activateTicket sees the updated ticketCode state
            if (code.length === 10) autoSubmitRef.current = true;
          }}
          onClose={() => setShowQrScanner(false)}
        />
      )}

      {/* ═══════════════ ACTIVATION BOTTOM SHEET ═══════════════ */}
      {showTicketInput && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={resetActivation} />
          <div
            className="relative w-full max-w-sm rounded-t-3xl overflow-hidden"
            style={{ background: "#0d1f14", boxShadow: "0 -12px 60px rgba(0,0,0,0.6)" }}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3" />

            {/* Trust badge */}
            <div className="mx-5 mt-4 mb-3 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
              style={{ background: "rgba(141,198,63,0.1)", border: "1px solid rgba(141,198,63,0.2)" }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(141,198,63,0.15)" }}>
                <Shield style={{ width: 16, height: 16, color: "#8DC63F" }} />
              </div>
              <p className="text-[11px] leading-snug font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
                Code valide uniquement pour les tickets officiels{" "}
                <span className="font-black" style={{ color: "#8DC63F" }}>HALGO CASH</span>
              </p>
              {/* Decorative coin */}
              <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center ml-auto"
                style={{
                  background: "radial-gradient(circle at 35% 35%, #2ecb6e, #0f8c3a)",
                  boxShadow: "0 0 14px rgba(34,197,94,0.5), inset 0 2px 4px rgba(255,255,255,0.25)",
                }}>
                <span style={{ fontSize: "1.25rem" }}>🍀</span>
              </div>
            </div>

            {/* ── If result is showing ── */}
            {activationResult ? (
              <div className="mx-5 mb-6 rounded-2xl p-6 flex flex-col items-center gap-3 animate-in fade-in duration-300"
                style={{
                  background: activationResult.isWinner ? "rgba(22,163,74,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${activationResult.isWinner ? "rgba(22,163,74,0.4)" : "rgba(255,255,255,0.08)"}`,
                }}>
                <span className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {activationResult.code}
                </span>
                {activationResult.isWinner ? (
                  <>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 0 32px rgba(34,197,94,0.4)" }}>
                      <CheckCircle style={{ width: 32, height: 32, color: "#fff" }} />
                    </div>
                    <p className="font-black text-base uppercase text-center text-white">{activationResult.prizeLabel}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black font-mono text-[#F5C518]"
                        style={{ textShadow: isAnimating ? "0 0 20px rgba(245,197,24,0.5)" : "none" }}>
                        +{formatFC(rollingAmount)}
                      </span>
                      <span className="font-bold text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>FC</span>
                    </div>
                    {isAnimating
                      ? <p className="text-[10px] font-black tracking-widest animate-pulse" style={{ color: "rgba(255,255,255,0.5)" }}>CALCUL EN COURS…</p>
                      : <p className="text-[10px] font-black tracking-widest" style={{ color: "#22c55e" }}>✓ CRÉDITÉ SUR VOTRE SOLDE</p>}
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.07)" }}>
                      <X style={{ width: 28, height: 28, color: "rgba(255,255,255,0.4)" }} />
                    </div>
                    <p className="font-black text-base uppercase" style={{ color: "rgba(255,255,255,0.6)" }}>Ticket perdant</p>
                    <p className="text-[12px] text-center" style={{ color: "rgba(255,255,255,0.4)" }}>Tentez votre chance avec un autre ticket</p>
                  </>
                )}
              </div>
            ) : (
              <div className="px-5 pb-6 space-y-4">
                {/* CODE DU TICKET label */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(141,198,63,0.15)" }}>
                    <Tag style={{ width: 14, height: 14, color: "#8DC63F" }} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#8DC63F" }}>
                    CODE DU TICKET
                  </span>
                </div>

                {/* Input field */}
                <div className="relative">
                  <input
                    type="text"
                    inputMode="text"
                    maxLength={10}
                    placeholder="XXXXXXXXXX"
                    value={ticketCode}
                    onChange={(e) => { setActivationError(null); setTicketCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10)); }}
                    onKeyDown={(e) => { if (e.key === "Enter") void activateTicket(); }}
                    className="w-full px-5 py-4 rounded-2xl font-mono font-black text-[22px] tracking-[0.35em] outline-none border-2 transition-all pr-14"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      borderColor: activationError ? "#ef4444" : ticketCode.length === 10 ? "#8DC63F" : "rgba(255,255,255,0.12)",
                      color: ticketCode.length > 0 ? "#ffffff" : "rgba(255,255,255,0.2)",
                      caretColor: "#8DC63F",
                    }}
                    autoFocus
                  />
                  {/* QR scan icon inside input */}
                  <button
                    onClick={() => setShowQrScanner(true)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <Scan style={{ width: 17, height: 17, color: "rgba(255,255,255,0.5)" }} />
                  </button>
                </div>

                {activationError && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                    <AlertCircle style={{ width: 13, height: 13, color: "#f87171" }} />
                    <p className="text-red-400 text-[11px] font-semibold">{activationError}</p>
                  </div>
                )}

                {/* ACTIVER LE TICKET button — always visible */}
                <button
                  onClick={() => void activateTicket()}
                  disabled={activating || ticketCode.length === 0}
                  className="w-full py-4 rounded-2xl font-black text-[14px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{
                    background: "linear-gradient(135deg,#1a6b2f,#22a84a)",
                    color: "#fff",
                    boxShadow: ticketCode.length > 0 ? "0 6px 24px rgba(34,168,74,0.45)" : "none",
                  }}
                >
                  {activating
                    ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
                    : <Sparkles style={{ width: 18, height: 18 }} />}
                  {activating ? "Vérification en cours…" : "ACTIVER LE TICKET"}
                  {!activating && <ChevronRight style={{ width: 18, height: 18 }} />}
                </button>

                {/* OU divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>OU</span>
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                </div>

                {/* Scanner un code QR row */}
                <button
                  onClick={() => setShowQrScanner(true)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98]"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(141,198,63,0.12)", border: "1px solid rgba(141,198,63,0.2)" }}>
                    <Camera style={{ width: 18, height: 18, color: "#8DC63F" }} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-[13px] text-white">Scanner un code QR</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Utilisez votre caméra pour scanner le code</p>
                  </div>
                  <ChevronRight style={{ width: 16, height: 16, color: "rgba(255,255,255,0.3)" }} />
                </button>

                {/* Security footer */}
                <div className="flex items-center justify-between px-2 pt-1 pb-1">
                  <div className="flex items-center gap-2">
                    <Lock style={{ width: 13, height: 13, color: "rgba(255,255,255,0.3)" }} />
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Vos informations sont sécurisées
                      <span className="block" style={{ color: "rgba(255,255,255,0.2)" }}>et 100% confidentielles</span>
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(141,198,63,0.1)", border: "1px solid rgba(141,198,63,0.2)" }}>
                    <Shield style={{ width: 16, height: 16, color: "#8DC63F" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ NOTIFICATION PANEL ═══════════════ */}
      {showNotifPanel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNotifPanel(false)} />
          <div className="relative w-full max-w-sm rounded-t-3xl pb-10"
            style={{ background: "#0d1f12", boxShadow: "0 -8px 48px rgba(0,0,0,0.5)", maxHeight: "70vh", overflowY: "auto" }}>
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-4" />
            <div className="flex items-center justify-between px-5 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <Bell style={{ width: 18, height: 18, color: "#F5C518" }} />
                <h2 className="text-base font-black text-white uppercase tracking-wide">Notifications</h2>
              </div>
              <button onClick={() => setShowNotifPanel(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.08)" }}>
                <X style={{ width: 15, height: 15, color: "rgba(255,255,255,0.5)" }} />
              </button>
            </div>
            <div className="px-4 pt-4">
              {notifs.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-3">
                  <CheckCheck style={{ width: 36, height: 36, color: "rgba(255,255,255,0.2)" }} />
                  <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>Aucune notification</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 pb-4">
                  {notifs.map((n) => (
                    <div key={n.id} className="rounded-xl px-4 py-3 flex items-center gap-3"
                      style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "rgba(34,197,94,0.15)" }}>
                        <CheckCircle style={{ width: 18, height: 18, color: "#22c55e" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-[13px] leading-tight">{n.message}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {new Date(n.paidAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ RETRAIT MODAL ═══════════════ */}
      {showRetrait && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeRetrait} />
          <div className="relative w-full max-w-sm rounded-t-3xl pb-10"
            style={{ background: "#0d1f12", boxShadow: "0 -8px 48px rgba(0,0,0,0.4)" }}>
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-1" />
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-white">DEMANDE DE RETRAIT</h2>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Solde dispo :&nbsp;<span className="font-bold" style={{ color: "#8DC63F" }}>{balance !== null ? `${formatFC(balance)} FC` : "—"}</span>
                </p>
              </div>
              <button onClick={closeRetrait} className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.08)" }}>
                <X style={{ width: 16, height: 16, color: "rgba(255,255,255,0.5)" }} />
              </button>
            </div>

            {retraitQR ? (
              retraitPaid ? (
                <div className="px-5 py-8 flex flex-col items-center gap-4 text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 0 32px rgba(34,197,94,0.4)" }}>
                    <CheckCircle style={{ width: 40, height: 40, color: "#fff" }} />
                  </div>
                  <div>
                    <p className="font-black text-xl text-green-500">RETRAIT PAYÉ !</p>
                    <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                      Retrait de <span className="font-black text-[#F5C518]">{formatFC(retraitQR.amount)} FC</span> confirmé
                    </p>
                  </div>
                  <div className="w-full rounded-xl px-4 py-3 text-xs"
                    style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <p className="font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>Confirmé le</p>
                    <p className="font-black text-green-500 mt-0.5">{new Date(retraitPaid.paidAt).toLocaleString("fr-FR")}</p>
                  </div>
                  <button onClick={closeRetrait} className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest"
                    style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff" }}>FERMER</button>
                </div>
              ) : (
                <div className="px-5 py-6 flex flex-col items-center gap-4 text-center">
                  <p className="font-black text-base text-white">Présentez ce QR à un vendeur Halgo Cash</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Retrait de <span className="text-[#F5C518] font-bold">{formatFC(retraitQR.amount)} FC</span> · en attente
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>En attente de confirmation vendeur…</span>
                  </div>
                  <div className="p-4 rounded-2xl" style={{ background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
                    <QRCodeSVG value={retraitQR.qrValue} size={200} bgColor="#ffffff" fgColor="#0a1f0e" level="M" />
                  </div>
                  <div className="w-full rounded-xl px-4 py-2 text-xs font-mono break-all"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#aaa" }}>{retraitQR.token}</div>
                  <button onClick={closeRetrait} className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest"
                    style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>ANNULER LE RETRAIT</button>
                </div>
              )
            ) : (
              <div className="px-5 pt-5 space-y-4">
                {quickAmounts.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Montant rapide</p>
                    <div className="grid grid-cols-4 gap-2">
                      {quickAmounts.map((amt, i) => (
                        <button key={i} onClick={() => setRetraitAmount(String(amt))}
                          className="py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                          style={{ background: retraitAmount === String(amt) ? "linear-gradient(135deg,#F5C518,#d4a017)" : "rgba(255,255,255,0.08)", color: retraitAmount === String(amt) ? "#0a1f0e" : "#fff" }}>
                          {["25%","50%","75%","100%"][i]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Montant à retirer (FC)</p>
                  <div className="relative">
                    <input type="number" min={1} max={balance ?? undefined} inputMode="numeric" placeholder="Ex: 5 000"
                      value={retraitAmount} onChange={(e) => { setRetraitAmount(e.target.value); setRetraitError(null); }}
                      className="w-full px-4 py-3.5 rounded-xl font-black text-2xl outline-none border-2 transition-all pr-16"
                      style={{ background: "rgba(255,255,255,0.05)", borderColor: retraitError ? "#ef4444" : "rgba(255,255,255,0.12)", color: "#fff" }}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>FC</span>
                  </div>
                  {retraitAmount && !isNaN(parseFloat(retraitAmount)) && (
                    <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>≈ {(parseFloat(retraitAmount) / 2800).toFixed(2)} USD</p>
                  )}
                </div>
                {retraitError && (
                  <p className="text-red-400 text-xs flex items-center gap-1.5">
                    <AlertCircle style={{ width: 14, height: 14 }} className="shrink-0" />{retraitError}
                  </p>
                )}
                <button onClick={() => { void submitRetrait(); }} disabled={!retraitAmount || retraitLoading}
                  className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#F5C518,#d4a017)", color: "#0a1f0e", boxShadow: "0 4px 16px rgba(245,197,24,0.35)" }}>
                  {retraitLoading ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : <QrCode style={{ width: 16, height: 16 }} />}
                  {retraitLoading ? "GÉNÉRATION..." : "GÉNÉRER LE QR CODE"}
                </button>
                <p className="text-[10px] text-center pb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Les retraits sont traités sous 24h ouvrées · Service Halgo Cash
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ BOTTOM NAV (4 tabs) ═══════════════ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch"
        style={{ background: "#0a1a0e", borderTop: "1px solid rgba(255,255,255,0.06)", height: 68 }}
      >
        {[
          { icon: HomeIcon, label: "ACCUEIL",   path: "/",         active: true  },
          { icon: Ticket,   label: "COUPON",    path: "/coupons",  active: false },
          { icon: User,     label: "PROFIL",    path: "/profile",  active: false },
          { icon: Settings, label: "PARAMÈTRE", path: "/settings", active: false },
        ].map(({ icon: Icon, label, path, active }) => (
          <button key={label} onClick={() => navigate(path)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90">
            <Icon style={{ width: 20, height: 20, color: active ? "#F5C518" : "rgba(255,255,255,0.35)" }} />
            <span className="text-[9px] font-black uppercase tracking-wide leading-none"
              style={{ color: active ? "#F5C518" : "rgba(255,255,255,0.3)" }}>
              {label}
            </span>
            {active && <div className="w-5 h-0.5 rounded-full mt-0.5" style={{ background: "#F5C518" }} />}
          </button>
        ))}
      </nav>

    </div>
  );
}
