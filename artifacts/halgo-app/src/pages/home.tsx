import { useState, useCallback, useEffect, useRef } from "react";
import { MobileMoneyModal } from "@/components/mobile-money-modal";
import {
  X, QrCode, Sparkles, Loader2,
  ChevronRight, Eye, EyeOff,
  Ticket, AlertCircle, CheckCircle, Scan,
  Home as HomeIcon, User, Settings,
  Bell, CheckCheck, Clock, Shield, Lock, Camera, Tag,
  Users, Copy, Plane, Zap, Gem, TrendingUp, Gift, Trophy, UserPlus, CircleDot, Smartphone,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import { useUser, useAuth } from "@clerk/react";
import { QRCodeSVG } from "qrcode.react";
import { useLocation } from "wouter";
import { QrScanner } from "@/components/qr-scanner";
import { SupportChat } from "@/components/support-chat";

function formatFC(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(amount)).replace(/[\u00a0\s]/g, " ");
}

function currentWeekId(): string {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function JackpotBanner({ countdown, onParticiper, participated, prizeLabel = "5 000 000 FC" }: { countdown: string; onParticiper: () => void; participated: boolean; prizeLabel?: string }) {
  const [imgOk, setImgOk] = useState<boolean | null>(null);
  const ts = useRef(Date.now());

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg,#0d3320 0%,#165c2a 50%,#1a7a36 100%)",
        border: "1px solid rgba(141,198,63,0.35)",
        boxShadow: "0 8px 32px rgba(22,92,40,0.5)",
        animation: "jackpotGlow 3s ease-in-out infinite",
        minHeight: imgOk ? undefined : undefined,
      }}
    >
      {/* Image affiche (cachée si erreur) */}
      <img
        src={`/api/jackpot-poster/image?t=${ts.current}`}
        alt="Affiche jackpot"
        onLoad={() => setImgOk(true)}
        onError={() => setImgOk(false)}
        className="w-full block"
        style={{ display: imgOk ? "block" : "none" }}
      />

      {/* Fallback texte si pas d'image */}
      {imgOk === false && (
        <div className="p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-1 text-white">
            JACKPOT HEBDOMADAIRE
          </p>
          <p className="font-black leading-none text-white" style={{ fontFamily: "'Oswald', sans-serif", fontSize: "2.1rem", letterSpacing: "0.04em" }}>
            {prizeLabel}
          </p>
        </div>
      )}

      {/* Barre PARTICIPER — toujours visible */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={imgOk ? { background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" } : {}}
      >
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <Clock style={{ width: 11, height: 11, color: "rgba(255,255,255,0.5)" }} />
          <span className="text-[10px] font-bold uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>FIN DANS</span>
          <span className="text-[11px] font-black text-white">{countdown}</span>
        </div>
        <button
          onClick={onParticiper}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-wide transition-all active:scale-95"
          style={participated
            ? { background: "rgba(141,198,63,0.12)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.35)", boxShadow: "none" }
            : { background: "linear-gradient(135deg,#1a6b2f,#22a84a)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 2px 12px rgba(34,168,74,0.45)", animation: "participerPulse 2.5s ease-in-out infinite" }}
        >
          {participated
            ? <><CheckCircle style={{ width: 12, height: 12 }} /> DÉJÀ PARTICIPÉ</>
            : <>PARTICIPER <ChevronRight style={{ width: 13, height: 13 }} /></>}
        </button>
      </div>
    </div>
  );
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

interface GameDef {
  name: string;
  coverKey: string;
  badge: string;
  badgeColor: string;
  bg: string;
  previewBg: string;
  Icon: React.FC<LucideProps>;
  iconSize: number;
  glow: string;
  players: string;
  multiplier: string | null;
  accent: string;
  route?: string;
}

// Covers are served from the API (stored in DB by admin) — not from localStorage.
// We track per-key load failures so we can show the fallback illustration on 404.
function getGameCoverUrl(key: string): string {
  return `/api/game-covers/${key}/image`;
}

const GAMES: GameDef[] = [
  {
    name: "Halgo Crash",
    coverKey: "halgo_cover_crash",
    badge: "TOP",
    badgeColor: "#e74c3c",
    bg: "linear-gradient(160deg,#1a0505 0%,#3a0a0a 50%,#110303 100%)",
    previewBg: "radial-gradient(ellipse at 50% 80%, #dc262655 0%, transparent 70%)",
    Icon: TrendingUp,
    iconSize: 30,
    glow: "#ef4444",
    players: "3 210",
    multiplier: "12.45×",
    accent: "#ef4444",
    route: "/app/crash",
  },
  {
    name: "Roulette Halgo",
    coverKey: "halgo_cover_roulette",
    badge: "TOP",
    badgeColor: "#92400e",
    bg: "linear-gradient(160deg,#160d00 0%,#2e1a00 50%,#0d0800 100%)",
    previewBg: "radial-gradient(ellipse at 50% 80%, #F5C51855 0%, transparent 70%)",
    Icon: CircleDot,
    iconSize: 34,
    glow: "#F5C518",
    players: "1 623",
    multiplier: null,
    accent: "#F5C518",
    route: "/app/roulette",
  },
  {
    name: "Mines",
    coverKey: "halgo_cover_mines",
    badge: "NOUVEAU",
    badgeColor: "#22a84a",
    bg: "linear-gradient(160deg,#081418 0%,#0d2a3a 50%,#050e12 100%)",
    previewBg: "radial-gradient(ellipse at 50% 80%, #1abc9c55 0%, transparent 70%)",
    Icon: Gem,
    iconSize: 34,
    glow: "#1abc9c",
    players: "987",
    multiplier: null,
    accent: "#1abc9c",
    route: "/app/mines",
  },
  {
    name: "Malette Secrète",
    coverKey: "halgo_cover_malette",
    badge: "NOUVEAU",
    badgeColor: "#b45309",
    bg: "linear-gradient(160deg,#1a0f00 0%,#2e1e00 50%,#110c00 100%)",
    previewBg: "radial-gradient(ellipse at 50% 80%, #F5C51855 0%, transparent 70%)",
    Icon: Gift,
    iconSize: 32,
    glow: "#F5C518",
    players: "412",
    multiplier: "×5",
    accent: "#F5C518",
    route: "/app/malette",
  },
];

interface Notif {
  id: string;
  type: "ticket_win" | "withdrawal_paid" | "withdrawal_pending" | "withdrawal_cancelled" | "referral_ticket";
  message: string;
  amount: number;
  date: string;
}

// ── Age gate modal ──────────────────────────────────────────────────────
function AgeGateModal({ onConfirm, onDeny }: { onConfirm: () => void; onDeny: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center pb-6 px-4"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 flex flex-col items-center gap-5"
        style={{ background: "#0f1f12", border: "1px solid rgba(141,198,63,0.2)", boxShadow: "0 0 60px rgba(141,198,63,0.08)" }}
      >
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
          style={{ background: "rgba(141,198,63,0.1)", border: "1px solid rgba(141,198,63,0.25)" }}
        >
          🔞
        </div>

        {/* Title */}
        <div className="text-center">
          <p className="text-white font-black text-[18px] mb-1">Vérification d'âge</p>
          <p className="text-zinc-400 text-[12px] leading-relaxed">
            Halgo Cash est une plateforme de divertissement réservée aux personnes majeures.
            Confirmez que vous avez au moins <strong className="text-white">18 ans</strong> pour continuer.
          </p>
        </div>

        {/* Legal note */}
        <div
          className="w-full px-3 py-2 rounded-xl text-center text-[10px] text-zinc-500 leading-relaxed"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          En accédant à cette plateforme, vous acceptez que vous êtes majeur(e) selon la législation de la RDC (≥ 18 ans).
        </div>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={onConfirm}
            className="w-full py-3.5 rounded-2xl font-black text-[14px] uppercase tracking-wide"
            style={{ background: "linear-gradient(135deg,#8DC63F,#6baa2a)", color: "#0a1f0e" }}
          >
            ✓  J'ai 18 ans ou plus
          </button>
          <button
            onClick={onDeny}
            className="w-full py-3 rounded-2xl font-black text-[13px] uppercase tracking-wide"
            style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            J'ai moins de 18 ans
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, isLoaded } = useUser();
  const { getToken, isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const countdown = useJackpotCountdown();

  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = await getToken().catch(() => null);
    const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined ?? {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...options, headers, credentials: "include" });
  }, [getToken]);

  // ── Age gate ──
  const [ageConfirmed, setAgeConfirmed] = useState(() => {
    try { return localStorage.getItem("halgo_age_confirmed") === "1"; } catch { return false; }
  });
  const [ageDenied, setAgeDenied] = useState(false);

  const handleAgeConfirm = useCallback(() => {
    try { localStorage.setItem("halgo_age_confirmed", "1"); } catch { /* ignore */ }
    setAgeConfirmed(true);
  }, []);

  const handleAgeDeny = useCallback(() => {
    setAgeDenied(true);
  }, []);

  // ── State ──
  const [showRetrait,       setShowRetrait]       = useState(false);
  const [showTicketInput,   setShowTicketInput]   = useState(false);
  const [balanceHidden,     setBalanceHidden]     = useState(false);
  const [showNotifPanel,    setShowNotifPanel]    = useState(false);
  const [showParticipeModal, setShowParticipeModal] = useState(false);
  const [showCashbackModal,  setShowCashbackModal]  = useState(false);
  const [participeTab,       setParticipeTab]       = useState<"ticket" | "balance">("ticket");
  const [jackpotParticipated, setJackpotParticipated] = useState(() => {
    try { return localStorage.getItem(`jackpot_p_${currentWeekId()}`) === "1"; } catch { return false; }
  });
  const [jackpotBetAmt,      setJackpotBetAmt]      = useState("500");
  const [jackpotBetLoading,  setJackpotBetLoading]  = useState(false);
  const [jackpotBetDone,     setJackpotBetDone]     = useState(false);
  const [jackpotMinAmount,   setJackpotMinAmount]   = useState(500);
  const [cashbackLines,      setCashbackLines]      = useState<string[]>([
    "Chaque lundi, on calcule vos mises des 7 jours précédents",
    "10% de ce montant est crédité sur votre solde le lundi à 8h",
    "Valable sur tous les jeux : Crash, Roulette, Paris Sportifs",
    "Activé automatiquement pour tout compte Halgo Cash actif",
  ]);
  const [jackpotPrizeLabel,  setJackpotPrizeLabel]  = useState("5 000 000 FC");
  const [cashbackRate,       setCashbackRate]       = useState(10);
  const [cashbackTitle,      setCashbackTitle]      = useState("Cashback 10%");
  const [bonusAmount,        setBonusAmount]        = useState("50 000 FC");
  const [bonusSubtitle,      setBonusSubtitle]      = useState("100% jusqu'à 50 000 FC");
  const [bonusConditions,    setBonusConditions]    = useState("Obtenez jusqu'à 50 000 FC de bonus. Parrainez vos amis pour débloquer des récompenses supplémentaires.");
  const [showBonusModal,     setShowBonusModal]     = useState(false);

  // ── Send money ──
  const [showActionSheet,  setShowActionSheet]  = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showSendMoney,    setShowSendMoney]    = useState(false);
  const [sendCode,         setSendCode]         = useState("");
  const [sendAmount,       setSendAmount]       = useState("");
  const [sendLoading,      setSendLoading]      = useState(false);
  const [sendError,        setSendError]        = useState<string | null>(null);
  const [sendSuccess,      setSendSuccess]      = useState<{ refId: string; amount: number } | null>(null);
  const [sendCodeValid,    setSendCodeValid]    = useState<boolean | null>(null);
  const [sendValidating,   setSendValidating]   = useState(false);

  // Notifications
  const [notifs,      setNotifs]      = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [transferToast, setTransferToast] = useState<string | null>(null);
  const supportUnreadRef = useRef(0);

  // Balance — clé par utilisateur pour éviter les fuites entre comptes
  const lsKey = user?.id ? `halgo_balance_${user.id}` : null;
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceFlash, setBalanceFlash] = useState(false);

  // Pré-charger depuis localStorage dès que l'ID utilisateur est connu
  // pour afficher une valeur immédiatement pendant que l'API charge.
  useEffect(() => {
    if (!lsKey) return;
    try {
      const stored = localStorage.getItem(lsKey);
      if (stored !== null) setBalance(prev => prev === null ? parseFloat(stored) : prev);
    } catch { /* ignore */ }
  }, [lsKey]);

  // Ticket activation
  const [ticketCode,       setTicketCode]       = useState("");
  const [activating,       setActivating]       = useState(false);
  const [activationResult, setActivationResult] = useState<{
    code: string; isWinner: boolean; prizeAmount: number | null; prizeLabel: string;
  } | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);

  // QR Scanner
  const [showQrScanner, setShowQrScanner] = useState(false);

  // Game cover image errors — tracks which cover URLs returned 404 so we show fallback
  const [coverErrors, setCoverErrors] = useState<Record<string, boolean>>({});

  // Live winner feed (real players from API, padded with simulated fallback)
  interface LiveFeedEntry { name: string; amount: number; game: string; real: boolean; }
  const [liveFeed, setLiveFeed] = useState<LiveFeedEntry[]>([]);
  useEffect(() => {
    const load = () => {
      fetch("/api/live-feed")
        .then(r => r.ok ? r.json() as Promise<LiveFeedEntry[]> : Promise.reject())
        .then(data => { if (Array.isArray(data) && data.length > 0) setLiveFeed(data); })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 30_000); // refresh every 30s
    return () => clearInterval(t);
  }, []);

  // Parrainage
  const [referralCode,    setReferralCode]    = useState<string | null>(null);
  const [referralCount,   setReferralCount]   = useState(0);
  const [referralTickets, setReferralTickets] = useState(0);
  const [referralCopied,  setReferralCopied]  = useState(false);

  // Retrait
  const [retraitAmount,  setRetraitAmount]  = useState("");
  const [retraitLoading, setRetraitLoading] = useState(false);
  const [retraitQR,      setRetraitQR]      = useState<{ token: string; amount: number; qrValue: string } | null>(null);
  const [retraitError,   setRetraitError]   = useState<string | null>(null);
  const [retraitPaid,    setRetraitPaid]    = useState<{ paidAt: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const balanceRetryCountRef = useRef<number>(0);
  const balanceRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch helpers ──
  const fetchBalance = useCallback(async () => {
    const key = user?.id ? `halgo_balance_${user.id}` : null;
    const readLocal = (): number | null => {
      if (!key) return null;
      try { const v = localStorage.getItem(key); return v !== null ? parseFloat(v) : null; } catch { return null; }
    };
    try {
      const res = await authFetch("/api/auth/balance");
      if (res.ok) {
        const d = await res.json() as { balance: number };
        if (d.balance > 0) {
          balanceRetryCountRef.current = 0;
          if (balanceRetryTimerRef.current) { clearTimeout(balanceRetryTimerRef.current); balanceRetryTimerRef.current = null; }
          setBalance(d.balance);
          if (key) { try { localStorage.setItem(key, String(d.balance)); } catch { /* ignore */ } }
        } else {
          // Server returned 0 — only trust it if we have no locally-confirmed wins
          // and the current displayed balance is already 0/null (avoids race where
          // Clerk token is slow and overwrites a just-won balance).
          const localWins = localWinsRef.current;
          if (localWins > 0) {
            setBalance(localWins);
          } else {
            // Only zero out if the current balance is null or already 0;
            // keep any positive balance the user already sees.
            setBalance(prev => {
              if (prev !== null && prev > 0) return prev;
              if (key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }
              return 0;
            });
            // Retry: if the user is authenticated but we got 0, the Clerk JWT may
            // not have been ready on the first request.  Retry up to 3 times with
            // increasing delays so we don't leave a real balance stuck at 0.
            if (user?.id && balanceRetryCountRef.current < 3) {
              balanceRetryCountRef.current++;
              const delay = 1500 * balanceRetryCountRef.current;
              if (balanceRetryTimerRef.current) clearTimeout(balanceRetryTimerRef.current);
              balanceRetryTimerRef.current = setTimeout(() => {
                balanceRetryTimerRef.current = null;
                void fetchBalance();
              }, delay);
            }
          }
        }
      } else {
        // API returned an error (4xx/5xx) — keep whatever is in localStorage rather
        // than leaving the display stuck on the skeleton indefinitely.
        const cached = readLocal();
        if (cached !== null) setBalance(prev => prev === null ? cached : prev);
        else setBalance(prev => prev === null ? 0 : prev);
      }
    } catch {
      // Network error — fall back to localStorage so balance never stays blank.
      const cached = readLocal();
      if (cached !== null) setBalance(prev => prev === null ? cached : prev);
      else setBalance(prev => prev === null ? 0 : prev);
    }
  }, [authFetch, user?.id]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await authFetch("/api/auth/profile");
      if (!res.ok) return;
      const data = await res.json() as { referralCode: string; referralCount: number; referralTickets: number };
      setReferralCode(data.referralCode);
      setReferralCount(data.referralCount);
      setReferralTickets(data.referralTickets);
    } catch { /* silent */ }
  }, [authFetch]);

  const claimPendingReferral = useCallback(async () => {
    const pending = (() => { try { return localStorage.getItem("halgo_pending_referral"); } catch { return null; } })();
    if (!pending) return;
    try { localStorage.removeItem("halgo_pending_referral"); } catch { /* ignore */ }
    try {
      const res = await authFetch("/api/auth/referral/use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: pending }) });
      if (res.ok) { void fetchBalance(); void fetchProfile(); }
    } catch { /* silent */ }
  }, [authFetch, fetchBalance]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await authFetch("/api/auth/notifications");
      if (!res.ok) return;
      const data = await res.json() as { count: number; items: Notif[] };
      setNotifs(data.items);
      const lastSeen = localStorage.getItem("halgo_notif_seen");
      const lastSeenTs = lastSeen ? parseInt(lastSeen) : 0;
      const unread = data.items.filter((n) => new Date(n.date).getTime() > lastSeenTs).length;
      setUnreadCount(unread);
    } catch { /* silent */ }
  }, [authFetch]);

  // Only fetch once Clerk has finished loading — avoids a race where the
  // unauthenticated first fetch (no token) returns 0 and overwrites the real balance.
  useEffect(() => {
    if (isLoaded) {
      void fetchBalance();
      void fetchNotifications();
      void fetchProfile();
      void claimPendingReferral();
    }
  }, [isLoaded]);

  // Secondary trigger: fires only when isSignedIn TRANSITIONS to true (not on
  // initial mount), meaning the JWT just became available for the first time.
  // Guards against double-call by tracking the previous value in a ref.
  const prevIsSignedInRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const prev = prevIsSignedInRef.current;
    prevIsSignedInRef.current = isSignedIn ?? false;
    // Only act when transitioning from non-true → true (skip first-render where
    // both isLoaded and isSignedIn fire simultaneously and cause rate-limiting).
    if (isSignedIn && prev === false) {
      balanceRetryCountRef.current = 0;
      if (balanceRetryTimerRef.current) {
        clearTimeout(balanceRetryTimerRef.current);
        balanceRetryTimerRef.current = null;
      }
      void fetchBalance();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  // QR scan auto-fill
  // Tracks locally-confirmed wins not yet reflected by server balance.
  const localWinsRef = useRef<number>(0);

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

  // ── Fetch jackpot settings ──
  useEffect(() => {
    fetch("/api/jackpot-settings")
      .then(r => r.ok ? r.json() as Promise<{
        minAmount?: number; cashbackLines?: string[]; prizeLabel?: string;
        cashbackRate?: number; cashbackTitle?: string;
        bonusAmount?: string; bonusSubtitle?: string; bonusConditions?: string;
      }> : null)
      .then(cfg => {
        if (!cfg) return;
        if (typeof cfg.minAmount === "number" && cfg.minAmount >= 100) setJackpotMinAmount(cfg.minAmount);
        if (Array.isArray(cfg.cashbackLines) && cfg.cashbackLines.length) setCashbackLines(cfg.cashbackLines);
        if (cfg.prizeLabel) setJackpotPrizeLabel(cfg.prizeLabel);
        if (typeof cfg.cashbackRate === "number") setCashbackRate(cfg.cashbackRate);
        if (cfg.cashbackTitle) setCashbackTitle(cfg.cashbackTitle);
        if (cfg.bonusAmount) setBonusAmount(cfg.bonusAmount);
        if (cfg.bonusSubtitle) setBonusSubtitle(cfg.bonusSubtitle);
        if (cfg.bonusConditions) setBonusConditions(cfg.bonusConditions);
      })
      .catch(() => {});
  }, []);

  // ── Poll support unread count every 15 s — detects incoming transfers ──────
  useEffect(() => {
    if (!isSignedIn) return;
    const check = async () => {
      try {
        const res = await authFetch("/api/support/unread-count");
        if (!res.ok) return;
        const { count } = await res.json() as { count: number };
        if (count > supportUnreadRef.current) {
          // New message arrived — refetch balance immediately and show toast
          void fetchBalance();
          // Read the latest admin message to extract transfer info for toast
          authFetch("/api/support/messages")
            .then(r => r.ok ? r.json() : null)
            .then((msgs: Array<{ message: string; fromAdmin: boolean }> | null) => {
              if (!msgs) return;
              const last = [...msgs].reverse().find(m => m.fromAdmin && m.message.includes("💸"));
              if (last) setTransferToast(last.message);
              else setTransferToast("💸 Vous avez reçu un virement ! Votre solde a été crédité.");
              setTimeout(() => setTransferToast(null), 6000);
            })
            .catch(() => {
              setTransferToast("💸 Vous avez reçu un virement ! Votre solde a été crédité.");
              setTimeout(() => setTransferToast(null), 6000);
            });
        }
        supportUnreadRef.current = count;
      } catch { /* silent */ }
    };
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, [isSignedIn, authFetch, fetchBalance]);

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
            const key = user?.id ? `halgo_balance_${user.id}` : null;
            if (key) { try { localStorage.setItem(key, String(data.newBalance)); } catch { /* ignore */ } }
            setTimeout(() => { void fetchBalance(); }, 2000);
          } else {
            // Server couldn't compute balance (Clerk auth failing on server) —
            // increment locally and track so fetchBalance won't wipe it with 0
            localWinsRef.current += data.prizeAmount as number;
            setBalance((prev) => {
              const nb = (prev ?? 0) + (data.prizeAmount as number);
              const key = user?.id ? `halgo_balance_${user.id}` : null;
              if (key) { try { localStorage.setItem(key, String(nb)); } catch { /* ignore */ } }
              return nb;
            });
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

  // ── Send money helpers ──
  const openSendMoney = () => {
    setSendCode(""); setSendAmount(""); setSendError(null); setSendSuccess(null); setSendCodeValid(null);
    setShowActionSheet(false);
    setShowSendMoney(true);
  };
  const closeSendMoney = () => {
    setShowSendMoney(false);
    setSendCode(""); setSendAmount(""); setSendError(null); setSendSuccess(null); setSendCodeValid(null);
  };

  const validateSendCode = useCallback(async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase().replace(/-/g, "");
    if (code.length < 3) { setSendCodeValid(null); return; }
    setSendValidating(true);
    try {
      const res = await authFetch(`/api/transfer/validate/${encodeURIComponent(code)}`);
      if (res.ok) {
        const d = await res.json() as { exists: boolean };
        setSendCodeValid(d.exists);
      }
    } catch { setSendCodeValid(null); }
    finally { setSendValidating(false); }
  }, [authFetch]);

  const submitSend = async () => {
    const code = sendCode.trim().toUpperCase().replace(/-/g, "");
    const amt = parseFloat(sendAmount.replace(/\s/g, "").replace(",", "."));
    if (!code) { setSendError("Entrez l'identifiant du destinataire"); return; }
    if (!sendCodeValid) { setSendError("Identifiant introuvable"); return; }
    if (!amt || amt <= 0) { setSendError("Entrez un montant valide"); return; }
    if (amt < 1) { setSendError("Montant minimum : 1 FC"); return; }
    if (balance !== null && amt > balance) { setSendError(`Solde insuffisant — vous avez ${Math.round(balance).toLocaleString("fr-FR")} FC`); return; }
    setSendLoading(true); setSendError(null);
    try {
      const res = await authFetch("/api/transfer/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientCode: code, amount: amt }),
      });
      const d = await res.json() as { ok?: boolean; error?: string; refId?: string };
      if (!res.ok) { setSendError(d.error ?? "Erreur lors du transfert"); return; }
      setSendSuccess({ refId: d.refId ?? "", amount: amt });
      void fetchBalance();
    } catch { setSendError("Erreur de connexion"); }
    finally { setSendLoading(false); }
  };
  const submitRetrait = async () => {
    const amt = parseFloat(retraitAmount.replace(/\s/g, "").replace(",", "."));
    if (!amt || amt <= 0) { setRetraitError("Entrez un montant valide"); return; }
    if (amt < 500) { setRetraitError("Retrait minimum : 500 FC"); return; }
    if (!balance || amt > balance) { setRetraitError("Montant supérieur à votre solde disponible"); return; }
    setRetraitError(null); setRetraitLoading(true);
    try {
      const res = await authFetch("/api/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: amt }) });
      const data = await res.json() as { token?: string; error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          setRetraitError("Session expirée — rechargez la page et reconnectez-vous");
        } else {
          setRetraitError(data.error ?? "Erreur serveur");
        }
        return;
      }
      setRetraitQR({ token: data.token!, amount: amt, qrValue: data.token! });
      void fetchBalance();
    } catch { setRetraitError("Erreur de connexion"); }
    finally { setRetraitLoading(false); }
  };

  const openNotifPanel = () => {
    setShowNotifPanel(true);
    setUnreadCount(0);
    try { localStorage.setItem("halgo_notif_seen", String(Date.now())); } catch { /* ignore */ }
  };

  const quickAmounts = balance && balance > 0 ? [0.25, 0.5, 0.75, 1].map((f) => Math.floor(balance * f)) : [];

  // ── Blocked (under 18) ──
  if (ageDenied) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 gap-6" style={{ background: "#0b1612" }}>
        <div className="text-5xl">🚫</div>
        <div className="text-center">
          <p className="text-white font-black text-[18px] mb-2">Accès refusé</p>
          <p className="text-zinc-400 text-[13px] leading-relaxed">
            Vous devez avoir au moins <strong className="text-white">18 ans</strong> pour accéder à Halgo Cash.
          </p>
        </div>
        <p className="text-zinc-600 text-[11px] text-center">
          Si vous pensez qu'il s'agit d'une erreur, contactez notre support.
        </p>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: "#0b1612" }}>

      {/* ── Age gate overlay (first visit only) ── */}
      {!ageConfirmed && <AgeGateModal onConfirm={handleAgeConfirm} onDeny={handleAgeDeny} />}

      {/* ═══════════════ HEADER — style betPawa ═══════════════ */}
      <header
        className="flex items-center justify-between px-4 pt-4 pb-3 gap-3 shrink-0"
        style={{ background: "#0f1f12", position: "sticky", top: 0, zIndex: 40 }}
      >
        {/* Left: logo + player ID */}
        <div className="flex flex-col gap-1 select-none shrink-0">
          <div className="flex items-baseline gap-0">
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

          {/* Player ID badge */}
          {referralCode ? (
            <button
              onClick={() => {
                const formatted = referralCode.slice(0, 3) + "-" + referralCode.slice(3);
                void navigator.clipboard.writeText(formatted).catch(() => {});
                setReferralCopied(true);
                setTimeout(() => setReferralCopied(false), 1500);
              }}
              className="flex items-center gap-1 self-start transition-all active:scale-95"
            >
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>ID</span>
              <span
                className="text-[11px] font-black tracking-wider px-2 py-0.5 rounded-md"
                style={{
                  fontFamily: "'Courier New', monospace",
                  background: referralCopied ? "rgba(141,198,63,0.2)" : "rgba(255,255,255,0.07)",
                  color: referralCopied ? "#8DC63F" : "rgba(255,255,255,0.7)",
                  border: `1px solid ${referralCopied ? "rgba(141,198,63,0.4)" : "rgba(255,255,255,0.1)"}`,
                  transition: "all 0.25s",
                  letterSpacing: "0.08em",
                }}
              >
                {referralCopied ? "Copié ✓" : referralCode.slice(0, 3) + "-" + referralCode.slice(3)}
              </span>
              <span className="flex items-center justify-center w-5 h-5 rounded" style={{ background: "rgba(255,255,255,0.06)" }}>
                {referralCopied
                  ? <CheckCircle style={{ width: 11, height: 11, color: "#8DC63F" }} />
                  : <Copy style={{ width: 11, height: 11, color: "rgba(255,255,255,0.4)" }} />}
              </span>
            </button>
          ) : (
            <div className="h-5 w-24 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
          )}
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

          {/* Green "+" button — opens action sheet */}
          <button
            onClick={() => setShowActionSheet(true)}
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
        <JackpotBanner
          countdown={countdown}
          participated={jackpotParticipated}
          prizeLabel={jackpotPrizeLabel}
          onParticiper={() => {
            setParticipeTab("ticket");
            if (!jackpotParticipated) setJackpotBetDone(false);
            setShowParticipeModal(true);
          }}
        />

        {/* ── Live Ticker ── */}
        {(() => {
          const SIM_FALLBACK = [
            { name: "Jean M.", amount: 45_000, game: "Crash", real: false },
            { name: "Bijou K.", amount: 120_000, game: "Crash", real: false },
            { name: "Paul T.", amount: 8_500, game: "Loterie", real: false },
            { name: "Grâce L.", amount: 250_000, game: "Crash", real: false },
            { name: "Moise N.", amount: 15_000, game: "Crash", real: false },
            { name: "Ruth B.", amount: 60_000, game: "Mines", real: false },
            { name: "David M.", amount: 32_000, game: "Crash", real: false },
            { name: "Espérance O.", amount: 500_000, game: "Loterie", real: false },
          ];
          const wins = liveFeed.length > 0 ? liveFeed : SIM_FALLBACK;
          return (
            <div className="overflow-hidden rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center" style={{ padding: "7px 0" }}>
                <div style={{ display: "flex", animation: "liveMarquee 22s linear infinite", width: "max-content" }}>
                  {[...wins, ...wins].map((w, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-4 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: w.real ? "#F5C518" : "#22c55e", boxShadow: w.real ? "0 0 4px #F5C518" : "0 0 4px #22c55e" }} />
                      <span className="text-[9.5px] font-black uppercase" style={{ color: w.real ? "#F5C518" : "#22c55e" }}>{w.real ? "VRAI" : "LIVE"}</span>
                      <span className="text-[9.5px]" style={{ color: "rgba(255,255,255,0.55)" }}>{w.name} a gagné</span>
                      <span className="text-[9.5px] font-black" style={{ color: "#F5C518" }}>+{formatFC(w.amount)} FC</span>
                      <span className="text-[8px] px-1 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>{w.game}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

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
                onClick={() => g.route && navigate(g.route)}
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
                {(() => {
                  const coverFailed = coverErrors[g.coverKey] ?? false;
                  const coverUrl = getGameCoverUrl(g.coverKey);
                  return (
                <div
                  className="relative flex-1 flex items-center justify-center overflow-hidden"
                  style={{ background: coverFailed ? g.previewBg : undefined }}
                >
                  {/* Custom cover image — always attempt; hide on 404 */}
                  {!coverFailed && (
                    <img
                      src={coverUrl}
                      alt={g.name}
                      className="absolute inset-0 w-full h-full object-contain"
                      onError={() => setCoverErrors(prev => ({ ...prev, [g.coverKey]: true }))}
                    />
                  )}
                  {/* Subtle grid lines for depth */}
                  {coverFailed && <div
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: `linear-gradient(${g.accent}60 1px, transparent 1px), linear-gradient(90deg, ${g.accent}60 1px, transparent 1px)`,
                      backgroundSize: "18px 18px",
                    }}
                  />}
                  {/* Glow orb behind icon */}
                  {coverFailed && <div
                    className="absolute rounded-full"
                    style={{
                      width: 60, height: 60,
                      background: `radial-gradient(circle, ${g.glow}55 0%, transparent 70%)`,
                      filter: "blur(8px)",
                    }}
                  />}
                  {/* Multiplier or icon — hidden when cover is set */}
                  {coverFailed && (g.multiplier ? (
                    <div className="flex flex-col items-center gap-1 relative z-10">
                      <g.Icon
                        style={{
                          width: g.iconSize, height: g.iconSize,
                          color: g.accent,
                          filter: `drop-shadow(0 0 10px ${g.glow})`,
                        }}
                        strokeWidth={1.8}
                      />
                      <span
                        className="font-black"
                        style={{ fontSize: "1.1rem", color: g.accent, textShadow: `0 0 14px ${g.glow}`, lineHeight: 1 }}
                      >
                        {g.multiplier}
                      </span>
                    </div>
                  ) : (
                    <g.Icon
                      className="relative z-10"
                      style={{
                        width: g.iconSize, height: g.iconSize,
                        color: g.accent,
                        filter: `drop-shadow(0 0 12px ${g.glow}) drop-shadow(0 4px 8px rgba(0,0,0,0.5))`,
                      }}
                      strokeWidth={1.8}
                    />
                  ))}
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
                  );
                })()}

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
                  <div className="flex items-center gap-1">
                    <Users style={{ width: 8, height: 8, color: "rgba(255,255,255,0.38)" }} />
                    <p className="text-[8px] font-semibold" style={{ color: "rgba(255,255,255,0.38)" }}>{g.players}</p>
                  </div>
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

        {/* ══════════════ ACTIVER MON TICKET CTA ══════════════ */}
        <button
          onClick={() => setShowTicketInput(true)}
          className="w-full rounded-2xl transition-all active:scale-[0.97]"
          style={{
            background: "linear-gradient(135deg,#F5C518 0%,#f59e0b 100%)",
            boxShadow: "0 6px 28px rgba(245,197,24,0.45)",
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(0,0,0,0.18)" }}
            >
              <Ticket style={{ width: 21, height: 21, color: "#fff" }} strokeWidth={2.5} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-black text-[14px] tracking-wide uppercase" style={{ color: "#0a1f0e" }}>ACTIVER MON TICKET</p>
              <p className="text-[10px] font-semibold" style={{ color: "rgba(0,0,0,0.5)" }}>Saisir un code ou scanner le QR</p>
            </div>
            <div
              className="flex items-center gap-1 px-3 py-2 rounded-xl font-black text-[11px] uppercase tracking-wide shrink-0"
              style={{ background: "rgba(0,0,0,0.18)", color: "#0a1f0e" }}
            >
              JOUER <ChevronRight style={{ width: 13, height: 13 }} />
            </div>
          </div>
        </button>


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
              className="rounded-2xl flex flex-col items-center pt-3 pb-3 px-2 gap-1.5 cursor-pointer transition-all active:scale-[0.97]"
              onClick={() => setShowBonusModal(true)}
              style={{
                background: "linear-gradient(160deg,#0e2a12 0%,#163d1c 60%,#0a1f0e 100%)",
                border: "1px solid rgba(34,197,94,0.25)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              <div
                className="relative w-14 h-14 rounded-full flex items-center justify-center mb-0.5"
                style={{
                  background: "radial-gradient(circle at 38% 32%, #3ecf6a, #1a7a36 55%, #0b4a1f)",
                  boxShadow: "0 0 18px rgba(34,197,94,0.55), 0 0 36px rgba(34,197,94,0.2), inset 0 2px 5px rgba(255,255,255,0.18), inset 0 -3px 6px rgba(0,0,0,0.35)",
                  border: "1.5px solid rgba(34,197,94,0.55)",
                  animation: "promoFloat 4s ease-in-out infinite",
                }}
              >
                <Gift style={{ width: 28, height: 28, color: "#fff", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.5))" }} strokeWidth={1.8} />
              </div>
              <p className="text-[9.5px] font-black text-white text-center leading-tight tracking-wide uppercase">BONUS DE<br/>BIENVENUE</p>
              <p className="text-[8px] text-center leading-tight" style={{ color: "rgba(255,255,255,0.5)" }}>{bonusSubtitle}</p>
              <button
                className="w-full py-2 rounded-xl text-[8.5px] font-black uppercase tracking-wide mt-auto"
                style={{ background: "linear-gradient(135deg,#1a6b2f,#22a84a)", color: "#fff", boxShadow: "0 3px 10px rgba(22,107,47,0.5)" }}
              >
                EN PROFITER
              </button>
            </div>

            {/* ── Cashback 10% ── */}
            <div
              className="rounded-2xl flex flex-col items-center pt-3 pb-3 px-2 gap-1.5 cursor-pointer transition-all active:scale-[0.97]"
              onClick={() => setShowCashbackModal(true)}
              style={{
                background: "linear-gradient(160deg,#1e1400 0%,#2e1e00 60%,#1a1000 100%)",
                border: "1px solid rgba(245,197,24,0.35)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              <div
                className="relative w-14 h-14 rounded-full flex items-center justify-center mb-0.5"
                style={{
                  background: "radial-gradient(circle at 38% 32%, #f5d060, #d4a017 55%, #8a6500)",
                  boxShadow: "0 0 18px rgba(245,197,24,0.6), 0 0 36px rgba(245,197,24,0.25), inset 0 2px 5px rgba(255,255,255,0.3), inset 0 -3px 6px rgba(0,0,0,0.4)",
                  border: "1.5px solid rgba(245,197,24,0.7)",
                  animation: "promoFloat 4s ease-in-out infinite 0.8s",
                }}
              >
                <span className="font-black select-none" style={{ fontSize: "1.4rem", color: "#7a4800", textShadow: "0 1px 3px rgba(0,0,0,0.4), 0 -1px 0 rgba(255,255,255,0.25)", lineHeight: 1 }}>%</span>
              </div>
              <p className="text-[9.5px] font-black text-center leading-tight tracking-wide uppercase" style={{ color: "#F5C518" }}>CASHBACK<br/>10%</p>
              <p className="text-[8px] text-center leading-tight" style={{ color: "rgba(255,255,255,0.5)" }}>chaque semaine<br/>sur vos mises</p>
              <button
                className="w-full py-2 rounded-xl text-[8.5px] font-black uppercase tracking-wide mt-auto"
                style={{ background: "linear-gradient(135deg,#c8960a,#F5C518)", color: "#3a1f00", boxShadow: "0 3px 10px rgba(200,150,10,0.5)" }}
              >
                EN PROFITER
              </button>
            </div>

            {/* ── Jackpot du Samedi ── */}
            <div
              className="rounded-2xl flex flex-col items-center pt-3 pb-3 px-2 gap-1.5 cursor-pointer transition-all active:scale-[0.97]"
              onClick={() => navigate("/app/jackpot")}
              style={{
                background: "linear-gradient(160deg,#0e2a12 0%,#163d1c 60%,#0a1f0e 100%)",
                border: "1px solid rgba(245,197,24,0.3)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              <div
                className="relative w-14 h-14 rounded-full flex items-center justify-center mb-0.5"
                style={{
                  background: "radial-gradient(circle at 38% 32%, #f5d060, #c8960a 55%, #7a5800)",
                  boxShadow: "0 0 18px rgba(245,197,24,0.55), 0 0 36px rgba(245,197,24,0.2), inset 0 2px 5px rgba(255,255,255,0.25), inset 0 -3px 6px rgba(0,0,0,0.4)",
                  border: "1.5px solid rgba(245,197,24,0.6)",
                  animation: "promoFloat 4s ease-in-out infinite 1.6s",
                }}
              >
                <Trophy style={{ width: 28, height: 28, color: "#3a1f00", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.4))" }} strokeWidth={2} />
              </div>
              <p className="text-[9.5px] font-black text-white text-center leading-tight tracking-wide uppercase">JACKPOT<br/>DU SAMEDI</p>
              <p className="text-[8px] text-center leading-tight" style={{ color: "rgba(255,255,255,0.5)" }}>{jackpotPrizeLabel}<br/>à gagner</p>
              <button
                className="w-full py-2 rounded-xl text-[8.5px] font-black uppercase tracking-wide mt-auto"
                style={{ background: "rgba(141,198,63,0.15)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.35)", boxShadow: "0 2px 8px rgba(141,198,63,0.2)" }}
              >
                EN SAVOIR +
              </button>
            </div>
          </div>
        </div>

        {/* ── Paris Sportifs ── */}
        <div
          onClick={() => navigate("/app/sport")}
          className="rounded-2xl overflow-hidden relative cursor-pointer active:scale-[0.98] transition-transform"
          style={{
            background: "linear-gradient(135deg,#0a1f10 0%,#0d2a16 50%,#061209 100%)",
            border: "1px solid rgba(39,174,96,0.35)",
            boxShadow: "0 6px 24px rgba(39,174,96,0.15)",
          }}
        >
          <div className="px-4 py-4 flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-3xl"
              style={{ background: "linear-gradient(135deg,#1e5c2e,#27ae60)", boxShadow: "0 4px 16px rgba(39,174,96,0.4)" }}
            >
              ⚽
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-white font-black text-sm">Paris Sportifs</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: "#27ae60", color: "#fff" }}>LIVE</span>
              </div>
              <p className="text-white/50 text-[11px]">CL · Ligue 1 · Premier League · Bundesliga…</p>
              <p className="text-[#27ae60] text-[11px] font-bold mt-1">Misez sur les matchs en direct →</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/30 flex-shrink-0" />
          </div>
        </div>

      </div>

      {/* ═══════════════ QR SCANNER OVERLAY ═══════════════ */}
      {showQrScanner && (
        <QrScanner
          onResult={(raw) => {
            setShowQrScanner(false);
            // Try to extract a 10-digit code from the raw value
            let code = "";
            // 1. URL with ?code= param (tickets embed alphanumeric codes)
            try { const url = new URL(raw); const p = url.searchParams.get("code"); if (p) code = p.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10); } catch { /* not a URL */ }
            // 2. 10-char alphanumeric sequence (ticket code format: ABCDEFGHJK...)
            if (code.length !== 10) { const m = raw.replace(/\s/g, "").toUpperCase().match(/[A-Z0-9]{10}/); if (m) code = m[0]; }
            // 3. fallback: strip non-alphanumeric, take first 10
            if (code.length !== 10) { code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10); }
            if (!code) return;
            setTicketCode(code);
            setActivationError(null);
            setShowTicketInput(true);
            if (code.length === 10) autoSubmitRef.current = true;
          }}
          onClose={() => setShowQrScanner(false)}
        />
      )}

      {/* ═══════════════ ACTIVATION MODAL (centré) ═══════════════ */}
      {showTicketInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={resetActivation} />
          <div
            className="relative w-full max-w-sm rounded-3xl overflow-hidden"
            style={{ background: "#0d1f14", boxShadow: "0 8px 60px rgba(0,0,0,0.8)", maxHeight: "88vh", overflowY: "auto" }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(141,198,63,0.15)" }}>
                  <Ticket style={{ width: 16, height: 16, color: "#8DC63F" }} />
                </div>
                <span className="font-black text-[13px] uppercase tracking-wide text-white">Activer mon ticket</span>
              </div>
              <button
                onClick={resetActivation}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <X style={{ width: 15, height: 15, color: "rgba(255,255,255,0.6)" }} />
              </button>
            </div>

            {/* Trust badge */}
            <div className="mx-5 mt-3 mb-2 flex items-center gap-2.5 px-3 py-2 rounded-xl"
              style={{ background: "rgba(141,198,63,0.08)", border: "1px solid rgba(141,198,63,0.18)" }}>
              <Shield style={{ width: 14, height: 14, color: "#8DC63F", flexShrink: 0 }} />
              <p className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
                Tickets officiels <span className="font-black" style={{ color: "#8DC63F" }}>HALGO CASH</span> uniquement
              </p>
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
                  <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>Vos gains et retraits apparaîtront ici</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 pb-4">
                  {notifs.map((n) => {
                    const cfg =
                      n.type === "ticket_win"
                        ? { bg: "rgba(245,197,24,0.08)", border: "rgba(245,197,24,0.25)", iconBg: "rgba(245,197,24,0.15)", iconColor: "#F5C518", Icon: Ticket }
                        : n.type === "withdrawal_paid"
                        ? { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)", iconBg: "rgba(34,197,94,0.15)", iconColor: "#22c55e", Icon: CheckCircle }
                        : n.type === "withdrawal_pending"
                        ? { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)", iconBg: "rgba(251,191,36,0.15)", iconColor: "#fbbf24", Icon: Clock }
                        : n.type === "referral_ticket"
                        ? { bg: "rgba(141,198,63,0.08)", border: "rgba(141,198,63,0.25)", iconBg: "rgba(141,198,63,0.15)", iconColor: "#8DC63F", Icon: Ticket }
                        : { bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.2)",  iconBg: "rgba(239,68,68,0.12)",  iconColor: "#ef4444", Icon: X };
                    return (
                      <div key={n.id} className="rounded-xl px-4 py-3 flex items-center gap-3"
                        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: cfg.iconBg }}>
                          <cfg.Icon style={{ width: 18, height: 18, color: cfg.iconColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-[13px] leading-tight">{n.message}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                              {new Date(n.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                            {n.type === "ticket_win" && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                                style={{ background: "rgba(245,197,24,0.2)", color: "#F5C518" }}>
                                +{formatFC(n.amount)} FC
                              </span>
                            )}
                            {n.type === "withdrawal_paid" && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                                style={{ background: "rgba(34,197,94,0.2)", color: "#22c55e" }}>
                                PAYÉ
                              </span>
                            )}
                            {n.type === "withdrawal_pending" && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                                style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>
                                EN ATTENTE
                              </span>
                            )}
                            {n.type === "withdrawal_cancelled" && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                                style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}>
                                ANNULÉ
                              </span>
                            )}
                            {n.type === "referral_ticket" && (() => {
                              const code = n.message.match(/Code : (\d{10})/)?.[1];
                              return code ? (
                                <button
                                  onClick={() => { setShowNotifPanel(false); setTicketCode(code); setShowTicketInput(true); }}
                                  className="text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-wide transition-all active:scale-95"
                                  style={{ background: "rgba(141,198,63,0.25)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.4)" }}>
                                  GRATTER →
                                </button>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                    <input type="number" min={500} max={balance ?? undefined} inputMode="numeric" placeholder="Min. 500 FC"
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
                  Minimum de retrait : 500 FC · Traitement sous 24h ouvrées
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ ACTION SHEET — "+" button ═══════════════ */}
      {showActionSheet && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowActionSheet(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl pb-8 pt-5 px-4 space-y-3"
            style={{ background: "#0f1f12", border: "1px solid rgba(141,198,63,0.15)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "rgba(255,255,255,0.15)" }} />

            <p className="text-[11px] font-black uppercase tracking-widest text-center mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
              Que souhaitez-vous faire ?
            </p>

            {/* Recharger via Mobile Money */}
            <button
              onClick={() => { setShowActionSheet(false); setShowRechargeModal(true); }}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all active:scale-[0.97]"
              style={{ background: "rgba(141,198,63,0.08)", border: "1px solid rgba(141,198,63,0.2)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(141,198,63,0.15)" }}>
                <Smartphone style={{ width: 20, height: 20, color: "#8DC63F" }} />
              </div>
              <div className="text-left">
                <p className="font-black text-white text-[14px] leading-tight">Recharger via Mobile Money</p>
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>M-Pesa · Airtel Money · Orange Money</p>
              </div>
            </button>

            {/* Retrait */}
            <button
              onClick={() => { setShowActionSheet(false); openRetrait(); }}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all active:scale-[0.97]"
              style={{ background: "rgba(245,197,24,0.08)", border: "1px solid rgba(245,197,24,0.2)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(245,197,24,0.15)" }}>
                <QrCode style={{ width: 20, height: 20, color: "#F5C518" }} />
              </div>
              <div className="text-left">
                <p className="font-black text-white text-[14px] leading-tight">Retrait d'argent</p>
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>Générer un QR code pour retirer en agence</p>
              </div>
            </button>

            {/* Envoyer à quelqu'un */}
            <button
              onClick={openSendMoney}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all active:scale-[0.97]"
              style={{ background: "rgba(141,198,63,0.08)", border: "1px solid rgba(141,198,63,0.2)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(141,198,63,0.15)" }}>
                <Users style={{ width: 20, height: 20, color: "#8DC63F" }} />
              </div>
              <div className="text-left">
                <p className="font-black text-white text-[14px] leading-tight">Envoyer à quelqu'un</p>
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>Envoyer des FC à n'importe quel compte Halgo</p>
              </div>
            </button>

            <button
              onClick={() => setShowActionSheet(false)}
              className="w-full py-3 rounded-2xl font-bold text-[13px] mt-1 transition-all active:scale-[0.97]"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ SEND MONEY MODAL ═══════════════ */}
      {showSendMoney && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          onClick={closeSendMoney}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl pb-8 pt-5"
            style={{ background: "#0f1f12", border: "1px solid rgba(141,198,63,0.15)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "rgba(255,255,255,0.15)" }} />

            {sendSuccess ? (
              /* ── Succès ── */
              <div className="px-5 flex flex-col items-center gap-5 pb-2">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: "rgba(141,198,63,0.12)", border: "1px solid rgba(141,198,63,0.3)" }}
                >
                  ✅
                </div>
                <div className="text-center">
                  <p className="text-white font-black text-[20px] mb-1">Transfert réussi !</p>
                  <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                    <span className="text-white font-black">{formatFC(sendSuccess.amount)} FC</span> ont été envoyés
                  </p>
                  <p className="text-[10px] mt-2 font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Réf : {sendSuccess.refId}
                  </p>
                </div>
                <button
                  onClick={closeSendMoney}
                  className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest"
                  style={{ background: "linear-gradient(135deg,#8DC63F,#6baa2a)", color: "#0a1f0e" }}
                >
                  Fermer
                </button>
              </div>
            ) : (
              /* ── Formulaire ── */
              <div className="px-5 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-white font-black text-[17px] leading-tight">Dédier à un ami</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Solde disponible : <span className="text-white font-bold">{balance !== null ? formatFC(balance) : "…"} FC</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setShowSendMoney(false); setShowActionSheet(true); }}
                      className="flex items-center gap-1 px-2 h-8 rounded-xl text-[11px] font-bold transition-all active:scale-95"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                    >
                      ← Retour
                    </button>
                    <button onClick={closeSendMoney} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <X style={{ width: 15, height: 15, color: "rgba(255,255,255,0.5)" }} />
                    </button>
                  </div>
                </div>

                {/* ID destinataire */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    ID Halgo du destinataire
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="ex: HLG-XXXXX"
                      value={sendCode}
                      onChange={(e) => {
                        const v = e.target.value.toUpperCase();
                        setSendCode(v);
                        setSendCodeValid(null);
                        setSendError(null);
                        clearTimeout((window as unknown as { _scTimer?: ReturnType<typeof setTimeout> })._scTimer);
                        (window as unknown as { _scTimer?: ReturnType<typeof setTimeout> })._scTimer = setTimeout(() => {
                          void validateSendCode(v);
                        }, 600);
                      }}
                      className="w-full px-4 py-3.5 rounded-xl font-black text-base outline-none border-2 transition-all pr-10"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderColor: sendCodeValid === true ? "#8DC63F" : sendCodeValid === false ? "#ef4444" : "rgba(255,255,255,0.12)",
                        color: "#fff",
                        letterSpacing: "0.08em",
                        fontFamily: "'Courier New', monospace",
                      }}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {sendValidating && <Loader2 style={{ width: 16, height: 16, color: "rgba(255,255,255,0.4)" }} className="animate-spin" />}
                      {!sendValidating && sendCodeValid === true  && <CheckCircle style={{ width: 16, height: 16, color: "#8DC63F" }} />}
                      {!sendValidating && sendCodeValid === false && <AlertCircle style={{ width: 16, height: 16, color: "#ef4444" }} />}
                    </div>
                  </div>
                  {sendCodeValid === false && (
                    <p className="text-[11px] mt-1" style={{ color: "#ef4444" }}>Aucun compte trouvé avec cet ID</p>
                  )}
                  {sendCodeValid === true && (
                    <p className="text-[11px] mt-1" style={{ color: "#8DC63F" }}>✓ Compte trouvé</p>
                  )}
                  <p className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    L'ID Halgo s'affiche en haut à gauche de l'appli, sous le nom <em>halgoCash</em>
                  </p>
                </div>

                {/* Montant */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Montant à envoyer (FC)
                  </p>
                  {/* Raccourcis */}
                  {balance && balance > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {[0.1, 0.25, 0.5, 1].map((f, i) => {
                        const amt = Math.floor(balance * f);
                        return (
                          <button
                            key={i}
                            onClick={() => { setSendAmount(String(amt)); setSendError(null); }}
                            className="py-2 rounded-xl text-[11px] font-black transition-all active:scale-95"
                            style={{
                              background: sendAmount === String(amt) ? "linear-gradient(135deg,#8DC63F,#6baa2a)" : "rgba(255,255,255,0.07)",
                              color: sendAmount === String(amt) ? "#0a1f0e" : "#fff",
                            }}
                          >
                            {["10%","25%","50%","MAX"][i]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      placeholder="0"
                      value={sendAmount}
                      onChange={(e) => { setSendAmount(e.target.value); setSendError(null); }}
                      className="w-full px-4 py-3.5 rounded-xl font-black text-2xl outline-none border-2 transition-all pr-16"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderColor: sendError ? "#ef4444" : "rgba(255,255,255,0.12)",
                        color: "#fff",
                      }}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>FC</span>
                  </div>
                </div>

                {sendError && (
                  <p className="text-red-400 text-xs flex items-center gap-1.5">
                    <AlertCircle style={{ width: 14, height: 14 }} className="shrink-0" />{sendError}
                  </p>
                )}

                <button
                  onClick={() => { void submitSend(); }}
                  disabled={sendLoading || !sendCodeValid || !sendAmount}
                  className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#8DC63F,#6baa2a)", color: "#0a1f0e", boxShadow: "0 4px 16px rgba(141,198,63,0.35)" }}
                >
                  {sendLoading
                    ? <><Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> ENVOI…</>
                    : <><Gift style={{ width: 16, height: 16 }} /> ENVOYER</>
                  }
                </button>

                <p className="text-[10px] text-center pb-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Les transferts entre comptes Halgo sont instantanés et irréversibles
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Transfer received toast ── */}
      {transferToast && (
        <div
          className="fixed left-1/2 z-[9999] px-4 py-3 rounded-2xl shadow-2xl flex items-start gap-3"
          style={{
            bottom: 90,
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg,#0d3320,#155a28)",
            border: "1px solid rgba(141,198,63,0.45)",
            maxWidth: 320,
            width: "calc(100% - 32px)",
            animation: "slideUp 0.35s ease-out",
          }}
        >
          <span className="text-xl shrink-0">💸</span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-black text-white leading-snug">{transferToast.replace("💸 ", "")}</p>
          </div>
          <button onClick={() => setTransferToast(null)} className="shrink-0 mt-0.5">
            <X style={{ width: 14, height: 14, color: "rgba(255,255,255,0.45)" }} />
          </button>
        </div>
      )}

      <SupportChat />

      {/* ═══════════════ BOTTOM NAV ═══════════════ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch"
        style={{ background: "#0a1a0e", borderTop: "1px solid rgba(255,255,255,0.06)", height: 68 }}
      >
        {[
          { icon: HomeIcon, label: "ACCUEIL",  path: "/app",          active: true  },
          { icon: Ticket,   label: "TICKETS",  path: "/app/tickets",  active: false },
          { icon: UserPlus, label: "PARRAIN",  path: "/app/parrainage", active: false },
          { icon: User,     label: "PROFIL",   path: "/app/profile",  active: false },
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

      {/* ══ PARTICIPER MODAL ══ */}
      {showParticipeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowParticipeModal(false)} />
          <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: "#0d1f14", boxShadow: "0 8px 60px rgba(0,0,0,0.8)", maxHeight: "90dvh", overflowY: "auto" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,197,24,0.15)" }}>
                  <Trophy style={{ width: 16, height: 16, color: "#F5C518" }} />
                </div>
                <span className="font-black text-[13px] uppercase tracking-wide text-white">Participer au Jackpot</span>
              </div>
              <button onClick={() => setShowParticipeModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                <X style={{ width: 15, height: 15, color: "rgba(255,255,255,0.6)" }} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-5 pt-4">
              {[
                { key: "ticket", label: "🎟 Gratter un ticket" },
                { key: "balance", label: "💰 Miser mon solde" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setParticipeTab(key as "ticket" | "balance"); setJackpotBetDone(false); }}
                  className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all"
                  style={participeTab === key
                    ? { background: "linear-gradient(135deg,#1a6b2f,#22a84a)", color: "#fff", boxShadow: "0 3px 12px rgba(34,168,74,0.4)" }
                    : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="px-5 pt-4 pb-6">
              {participeTab === "ticket" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                    Entrez le code à 10 chiffres de votre ticket Halgo Cash. Chaque ticket activé = <strong className="text-white">1 participation</strong> au tirage du samedi.
                  </p>
                  <button
                    onClick={() => { setShowParticipeModal(false); setShowTicketInput(true); }}
                    className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] transition-all active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg,#8DC63F,#6baa2a)", color: "#0a1f0e", boxShadow: "0 4px 16px rgba(141,198,63,0.4)" }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Ticket style={{ width: 16, height: 16 }} />
                      OUVRIR LE CLAVIER
                    </span>
                  </button>
                </div>
              ) : jackpotBetDone ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 0 32px rgba(34,197,94,0.4)" }}>
                    <CheckCircle style={{ width: 32, height: 32, color: "#fff" }} />
                  </div>
                  <p className="font-black text-base text-white text-center">Participation enregistrée !</p>
                  <p className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Vous participez au tirage de <strong className="text-white">samedi à minuit</strong>. Bonne chance 🍀
                  </p>
                  <button onClick={() => setShowParticipeModal(false)} className="w-full py-3 rounded-2xl font-black text-[12px]" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}>
                    Fermer
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>Solde disponible</span>
                    <span className="font-black text-[12px] text-white">{balance !== null ? `${formatFC(balance)} FC` : "—"}</span>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wide mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>
                      Montant à miser (min. {jackpotMinAmount} FC)
                    </label>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <input
                        type="number"
                        min={jackpotMinAmount}
                        value={jackpotBetAmt}
                        onChange={e => setJackpotBetAmt(e.target.value)}
                        className="flex-1 bg-transparent text-white font-black text-[14px] outline-none"
                        placeholder={String(jackpotMinAmount)}
                      />
                      <span className="font-bold text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>FC</span>
                    </div>
                    <p className="text-[9px] mt-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Chaque tranche de {jackpotMinAmount} FC = 1 participation supplémentaire
                    </p>
                  </div>
                  <button
                    disabled={jackpotBetLoading || !jackpotBetAmt || Number(jackpotBetAmt) < jackpotMinAmount}
                    onClick={async () => {
                      const amt = Number(jackpotBetAmt);
                      if (!amt || amt < jackpotMinAmount) return;
                      setJackpotBetLoading(true);
                      try {
                        const res = await authFetch("/api/jackpot/enter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: amt }) });
                        if (res.ok) {
                          setJackpotBetDone(true);
                          setJackpotParticipated(true);
                          try { localStorage.setItem(`jackpot_p_${currentWeekId()}`, "1"); } catch { /* */ }
                          void fetchBalance();
                        } else {
                          const d = await res.json().catch(() => ({})) as { error?: string };
                          alert(d.error ?? "Erreur — veuillez réessayer");
                        }
                      } catch { alert("Erreur de connexion"); }
                      finally { setJackpotBetLoading(false); }
                    }}
                    className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#c8960a,#F5C518)", color: "#3a1f00", boxShadow: "0 4px 16px rgba(200,150,10,0.4)" }}
                  >
                    {jackpotBetLoading
                      ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin mx-auto" />
                      : <span className="flex items-center justify-center gap-2"><Zap style={{ width: 16, height: 16 }} />CONFIRMER LA MISE</span>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ CASHBACK INFO MODAL ══ */}
      {showCashbackModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCashbackModal(false)} />
          <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: "#0d1f14", boxShadow: "0 8px 60px rgba(0,0,0,0.8)" }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-[14px]" style={{ background: "radial-gradient(circle at 38% 32%,#f5d060,#d4a017 55%,#8a6500)", boxShadow: "0 0 12px rgba(245,197,24,0.5)" }}>%</div>
                <span className="font-black text-[13px] uppercase tracking-wide text-white">{cashbackTitle}</span>
              </div>
              <button onClick={() => setShowCashbackModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                <X style={{ width: 15, height: 15, color: "rgba(255,255,255,0.6)" }} />
              </button>
            </div>
            <div className="px-5 py-5 flex flex-col gap-4">
              {/* Big highlight */}
              <div className="rounded-2xl p-5 flex flex-col items-center gap-2" style={{ background: "linear-gradient(160deg,#1e1400,#2e1e00)", border: "1px solid rgba(245,197,24,0.3)" }}>
                <span className="text-5xl font-black" style={{ color: "#F5C518", textShadow: "0 0 24px rgba(245,197,24,0.4)" }}>{cashbackRate}%</span>
                <p className="text-[11px] font-bold text-center" style={{ color: "rgba(255,255,255,0.6)" }}>
                  du montant misé chaque semaine,<br/>crédité <strong className="text-white">automatiquement</strong>
                </p>
              </div>
              {/* How it works */}
              {cashbackLines.map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-[18px] flex-shrink-0">{(["📅","💰","🎯","✅","⭐","🔥"] as string[])[i] ?? "•"}</span>
                  <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{text}</p>
                </div>
              ))}
              <button
                onClick={() => { setShowCashbackModal(false); navigate("/app"); }}
                className="w-full py-3.5 rounded-2xl font-black text-[13px] uppercase tracking-wide"
                style={{ background: "linear-gradient(135deg,#c8960a,#F5C518)", color: "#3a1f00" }}
              >
                J'ai compris — Allons jouer !
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ BONUS DE BIENVENUE MODAL ══ */}
      {showBonusModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowBonusModal(false)} />
          <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: "#0d1f14", boxShadow: "0 8px 60px rgba(0,0,0,0.8)" }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle at 38% 32%,#3ecf6a,#1a7a36 55%,#0b4a1f)", boxShadow: "0 0 12px rgba(34,197,94,0.5)" }}>
                  <Gift style={{ width: 16, height: 16, color: "#fff" }} strokeWidth={2} />
                </div>
                <span className="font-black text-[13px] uppercase tracking-wide text-white">Bonus de Bienvenue</span>
              </div>
              <button onClick={() => setShowBonusModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                <X style={{ width: 15, height: 15, color: "rgba(255,255,255,0.6)" }} />
              </button>
            </div>
            <div className="px-5 py-5 flex flex-col gap-4">
              <div className="rounded-2xl p-5 flex flex-col items-center gap-2" style={{ background: "linear-gradient(160deg,#0e2a12,#163d1c)", border: "1px solid rgba(34,197,94,0.3)" }}>
                <span className="text-4xl font-black" style={{ color: "#22c55e", textShadow: "0 0 24px rgba(34,197,94,0.4)" }}>{bonusAmount}</span>
                <p className="text-[11px] font-bold text-center" style={{ color: "rgba(255,255,255,0.6)" }}>{bonusSubtitle}</p>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{bonusConditions}</p>
              <button
                onClick={() => { setShowBonusModal(false); navigate("/app/parrainage"); }}
                className="w-full py-3.5 rounded-2xl font-black text-[13px] uppercase tracking-wide"
                style={{ background: "linear-gradient(135deg,#1a6b2f,#22a84a)", color: "#fff", boxShadow: "0 4px 16px rgba(22,107,47,0.4)" }}
              >
                Parrainer mes amis
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes jackpotGlow {
          0%,100% { box-shadow: 0 8px 32px rgba(22,92,40,0.5), 0 0 0 0 rgba(141,198,63,0.0); }
          50%      { box-shadow: 0 8px 32px rgba(22,92,40,0.5), 0 0 24px 4px rgba(141,198,63,0.22); }
        }
        @keyframes participerPulse {
          0%,100% { box-shadow: 0 2px 12px rgba(34,168,74,0.45); }
          50%      { box-shadow: 0 2px 20px rgba(34,168,74,0.75), 0 0 0 3px rgba(34,168,74,0.15); }
        }
        @keyframes promoFloat {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-4px); }
        }
        @keyframes liveMarquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* ═══════════════ MOBILE MONEY RECHARGE MODAL ═══════════════ */}
      <MobileMoneyModal
        open={showRechargeModal}
        onClose={() => setShowRechargeModal(false)}
        onSuccess={() => {
          setShowRechargeModal(false);
          void fetchBalance();
        }}
      />
    </div>
  );
}
