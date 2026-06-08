import { useState, useCallback, useEffect, useRef } from "react";
import {
  X, QrCode, Sparkles, Send, Loader2,
  ChevronRight, Bell,
  Ticket, Clock, Home as HomeIcon,
  AlertCircle, CheckCircle, MapPin, Scan,
} from "lucide-react";
import { useUser } from "@clerk/react";
import { QRCodeSVG } from "qrcode.react";
import { useTheme } from "@/lib/theme-context";

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

function AdvertisingBanner() {
  const [hasImage, setHasImage] = useState<boolean | null>(null);
  const [ts] = useState(() => Date.now());
  if (hasImage === false) return null;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: "1780/930" }}>
      <img
        src={`/api/banners/active/image?t=${ts}`}
        alt="Publicité"
        className="w-full h-full object-cover"
        onLoad={() => setHasImage(true)}
        onError={() => setHasImage(false)}
      />
    </div>
  );
}

export default function Home() {
  const { user } = useUser();
  const { isDark } = useTheme();

  const [showRetrait, setShowRetrait] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showTicketInput, setShowTicketInput] = useState(false);

  const [ticketCode, setTicketCode] = useState("");
  const [activating, setActivating] = useState(false);
  const [activationResult, setActivationResult] = useState<{
    code: string; isWinner: boolean; prizeAmount: number | null; prizeLabel: string;
  } | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);

  const [balance, setBalance] = useState<number | null>(null);
  const [balanceFlash, setBalanceFlash] = useState(false);

  const [chipsWiggling, setChipsWiggling] = useState(false);
  const [fallingChips, setFallingChips] = useState<Array<{
    id: number; x: number; delay: number; duration: number; rotation: number; size: number;
  }>>([]);

  const [retraitAmount, setRetraitAmount] = useState("");
  const [retraitLoading, setRetraitLoading] = useState(false);
  const [retraitQR, setRetraitQR] = useState<{ token: string; amount: number; qrValue: string } | null>(null);
  const [retraitError, setRetraitError] = useState<string | null>(null);
  const [retraitPaid, setRetraitPaid] = useState<{ paidAt: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/balance", { credentials: "include" });
      if (res.ok) { const d = await res.json() as { balance: number }; setBalance(d.balance); }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { void fetchBalance(); }, [user?.id]);

  const rollingAmount = useRollingCounter(activationResult?.isWinner ? (activationResult.prizeAmount ?? 0) : null);

  useEffect(() => {
    if (activationResult?.isWinner) {
      setBalanceFlash(true);
      const t = setTimeout(() => setBalanceFlash(false), 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [activationResult?.code, activationResult?.isWinner]);

  useEffect(() => {
    if (!balanceFlash) return;
    const chips = Array.from({ length: 22 }, (_, i) => ({
      id: i,
      x: 2 + Math.random() * 96,
      delay: Math.random() * 1.0,
      duration: 1.6 + Math.random() * 1.4,
      rotation: Math.random() * 720 - 360,
      size: 44 + Math.floor(Math.random() * 32),
    }));
    setFallingChips(chips);
    const t = setTimeout(() => setFallingChips([]), 4500);
    return () => clearTimeout(t);
  }, [balanceFlash]);

  const handleChipsTouch = () => {
    setChipsWiggling(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setChipsWiggling(true));
    });
    setTimeout(() => setChipsWiggling(false), 750);
  };

  useEffect(() => {
    if (!activationResult) return;
    const t = setTimeout(resetActivation, activationResult.isWinner ? 2400 : 3000);
    return () => clearTimeout(t);
  }, [activationResult?.code]);

  useEffect(() => {
    const name = user?.fullName ?? user?.username ?? "Utilisateur";
    const ping = () => fetch("/api/auth/ping", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name }) }).catch(() => {});
    ping();
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, [user?.id]);

  const activateTicket = useCallback(async () => {
    const code = ticketCode.trim().toUpperCase();
    if (!code) return;
    setActivating(true); setActivationError(null); setActivationResult(null);
    try {
      const res = await fetch("/api/tickets/activate", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ code }) });
      const data = await res.json();
      if (!res.ok) { setActivationError(data.error || "Code introuvable"); }
      else { setActivationResult(data); void fetchBalance(); }
    } catch { setActivationError("Erreur de connexion"); }
    finally { setActivating(false); }
  }, [ticketCode, fetchBalance]);

  const resetActivation = () => { setTicketCode(""); setActivationResult(null); setActivationError(null); setShowTicketInput(false); };

  useEffect(() => {
    if (!retraitQR || retraitPaid) { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } return; }
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/withdrawals/my", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json() as Array<{ token: string; status: string; paidAt: string | null }>;
        const match = data.find((w) => w.token === retraitQR.token);
        if (match?.status === "paid" && match.paidAt) { clearInterval(pollRef.current!); pollRef.current = null; setRetraitPaid({ paidAt: match.paidAt }); void fetchBalance(); }
      } catch { /* silent */ }
    }, 3000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [retraitQR, retraitPaid]);

  const cancelPendingRetrait = async (token: string) => {
    try { await fetch(`/api/withdrawals/${encodeURIComponent(token)}`, { method: "DELETE", credentials: "include" }); } catch { /* silent */ }
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
      const res = await fetch("/api/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ amount: amt }) });
      const data = await res.json() as { token?: string; error?: string };
      if (!res.ok) { setRetraitError(data.error ?? "Erreur serveur"); return; }
      setRetraitQR({ token: data.token!, amount: amt, qrValue: data.token! });
    } catch { setRetraitError("Erreur de connexion"); }
    finally { setRetraitLoading(false); }
  };

  const displayId   = user ? `HG${(user.id ?? "").slice(-8).toUpperCase()}` : "HG----------";
  const displayName = user?.fullName ?? user?.username ?? "Utilisateur";
  const rawPhone    = (user?.phoneNumbers?.[0]?.phoneNumber) ?? (user?.unsafeMetadata?.phone as string | undefined) ?? null;

  const isAnimating = activationResult?.isWinner && rollingAmount < (activationResult.prizeAmount ?? 0);

  const quickAmounts = balance && balance > 0
    ? [0.25, 0.5, 0.75, 1].map((f) => Math.floor(balance * f))
    : [];

  const bg = isDark ? "bg-[#080f0a]" : "bg-[#f4f5f0]";
  const cardText = isDark ? "text-white" : "text-gray-900";
  const subText  = isDark ? "text-gray-400" : "text-gray-500";

  return (
    <div className={`min-h-dvh flex flex-col transition-colors ${bg}`}>

      {/* ── Falling chips rain overlay ── */}
      {fallingChips.length > 0 && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 9999 }}>
          {fallingChips.map((chip) => (
            <img
              key={chip.id}
              src="/chips.png"
              alt=""
              className="chip-falling absolute"
              style={{
                left: `${chip.x}%`,
                width: chip.size,
                "--chip-dur": `${chip.duration}s`,
                "--chip-delay": `${chip.delay}s`,
                "--chip-rot": `${chip.rotation}deg`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* ── Header ── */}
      <header
        className="relative flex items-center justify-center px-4 pt-4 pb-3"
        style={{ background: "linear-gradient(135deg, #0a1f0e 0%, #0f3d1c 45%, #1a5c2a 80%, #0f3d1c 100%)" }}
      >
        <div className="flex items-center gap-1">
          <img
            src="/logo-halgo-cash-nobg.png"
            alt="Halgo Cash"
            className="w-44 object-contain"
          />
          <img
            src="/chips.png"
            alt="jetons"
            className={`object-contain cursor-pointer select-none ${chipsWiggling ? "chips-wiggle" : ""}`}
            style={{
              width: 90,
              height: 60,
              filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.6))",
            }}
            onClick={handleChipsTouch}
            onAnimationEnd={() => setChipsWiggling(false)}
          />
        </div>
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
        >
          <Bell className={`w-5 h-5 ${isDark ? "text-white/70" : "text-gray-600"}`} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F5C518] border-2 border-[#f4f5f0]" />
        </button>
      </header>

      <div className="px-4 pb-24 flex-1 space-y-3 mt-3">

        {/* ── Balance Card ── */}
        <div
          className="rounded-3xl overflow-hidden shadow-2xl relative"
          style={{
            background: "linear-gradient(135deg, #0a2010 0%, #0d3318 40%, #165c28 75%, #0d3318 100%)",
            border: "1.5px solid rgba(245,197,24,0.25)",
          }}
        >
          {/* Decorative glows */}
          <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(141,198,63,0.12) 0%, transparent 65%)", transform: "translate(15%,-20%)" }} />
          <div className="absolute bottom-0 left-0 w-36 h-36 pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(245,197,24,0.08) 0%, transparent 65%)", transform: "translate(-15%,20%)" }} />
          {/* Dollar watermark */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none select-none text-[120px] font-black opacity-[0.04] text-[#8DC63F] leading-none">$</div>

          <div className="relative z-10 px-5 pt-4 pb-4">

            {/* ── Top row ── */}
            <div className="flex items-start justify-between mb-5">
              {/* Wallet + SOLDE */}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(245,197,24,0.15)", border: "1.5px solid rgba(245,197,24,0.4)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5C518" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                    <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-white font-black text-base uppercase tracking-widest leading-none">SOLDE</p>
                  <p className="text-white/40 text-[10px] font-semibold uppercase tracking-[0.2em] mt-0.5">DISPONIBLE</p>
                </div>
              </div>
              {/* KIVU pill */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: "rgba(10,32,16,0.7)", border: "1.5px solid rgba(245,197,24,0.5)" }}>
                <MapPin className="w-3 h-3 text-[#F5C518]" />
                <span className="text-[#F5C518] text-[11px] font-black tracking-widest">KIVU</span>
              </div>
            </div>

            {/* ── Amount row ── */}
            <div className="mb-2 flex flex-col items-center">
              <div className="transition-all duration-300" style={{ transform: balanceFlash ? "scale(1.04)" : "scale(1)" }}>
                {balance === null ? (
                  <div className="h-20 w-56 rounded-lg animate-pulse mx-auto" style={{ background: "rgba(255,255,255,0.08)" }} />
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <span
                      className="leading-none"
                      style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: balance >= 100000 ? "4.2rem" : "5.4rem",
                        color: balanceFlash ? "#8DC63F" : "#ffffff",
                        transition: "color 0.5s",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {formatFC(balance)}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: balance >= 100000 ? "4.2rem" : "5.4rem",
                        color: balanceFlash ? "#8DC63F" : "#ffffff",
                        transition: "color 0.5s",
                        lineHeight: 1,
                      }}
                    >
                      FC
                    </span>
                  </div>
                )}
              </div>
              {/* USD pill */}
              {balance !== null && balance > 0 && (
                <div className="inline-flex items-center px-3 py-1 rounded-full mt-2"
                  style={{ background: "rgba(22,92,40,0.8)", border: "1px solid rgba(141,198,63,0.3)" }}>
                  <span className="text-[#8DC63F] text-[11px] font-bold">≈ {(balance / 2800).toFixed(2)} USD</span>
                </div>
              )}
              {balance !== null && balance === 0 && (
                <p className="text-white/30 text-[11px] font-medium mt-1">Grattez un ticket pour gagner</p>
              )}
            </div>

            {/* ── Dotted divider ── */}
            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 border-t border-dashed" style={{ borderColor: "rgba(245,197,24,0.2)" }} />
              <span style={{ color: "#F5C518", opacity: 0.5, fontSize: 12 }}>✦</span>
              <div className="flex-1 border-t border-dashed" style={{ borderColor: "rgba(245,197,24,0.2)" }} />
            </div>

            {/* ── Retrait button ── */}
            <button
              onClick={openRetrait}
              className="w-full flex items-center py-3.5 rounded-2xl font-black text-[14px] uppercase tracking-wider transition-all active:scale-[0.97] relative overflow-hidden"
              style={{
                background: "linear-gradient(90deg, #F5C518 0%, #e6b800 60%, #d4a017 100%)",
                color: "#0a1f0e",
                boxShadow: "0 4px 20px rgba(245,197,24,0.45), inset 0 1px 0 rgba(255,255,255,0.3)",
              }}
            >
              <span className="flex-1 flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                RETRAIT
              </span>
              <span className="absolute right-4 w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(10,31,14,0.2)" }}>
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          </div>
        </div>


        {/* ── Advertising Banner ── */}
        <AdvertisingBanner />

        {/* ── Promo Banner ── */}
        <div
          className="rounded-3xl overflow-hidden relative shadow-md"
          style={{ background: "linear-gradient(135deg, #1a5c2a 0%, #22c55e 50%, #F5C518 100%)", minHeight: 90 }}
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 80% 50%, rgba(245,197,24,0.5) 0%, transparent 60%)" }} />
          <div className="relative z-10 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-white/80 text-[11px] font-bold uppercase tracking-widest mb-0.5">GAGNEZ JUSQU'À</p>
              <p className="text-white font-black text-2xl leading-none" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                1.000.000 <span className="text-[#F5C518]">CDF</span>
              </p>
              <div className="inline-flex items-center px-2.5 py-1 rounded-full mt-2"
                style={{ background: "rgba(0,0,0,0.25)" }}>
                <span className="text-white font-black text-[10px] uppercase tracking-widest">CHAQUE SAMEDI</span>
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,255,255,0.2)", border: "1.5px solid rgba(255,255,255,0.4)" }}
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        {/* ── Activer un Ticket ── */}
        {!showTicketInput ? (
          /* Compact row */
          <div className={`rounded-3xl px-4 py-3.5 flex items-center gap-3 shadow-sm ${isDark ? "bg-[#0f2418]" : "bg-white"}`}>
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #F5C518, #e6b800)" }}
            >
              <Ticket className="w-5 h-5 text-[#0a1f0e]" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-black text-sm leading-tight ${cardText}`}>ACTIVER UN TICKET</p>
              <p className={`text-[11px] leading-tight mt-0.5 ${subText}`}>Entrez le code de votre ticket pour tenter votre chance</p>
            </div>
            <button
              onClick={() => setShowTicketInput(true)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl font-black text-[12px] uppercase tracking-wide shrink-0 transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #F5C518, #e6b800)", color: "#0a1f0e" }}
            >
              ACTIVER <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* Expanded input */
          <div className="rounded-3xl overflow-hidden shadow-lg">
            <div
              className="p-5"
              style={{ background: "linear-gradient(135deg, #F5C518 0%, #e6b800 50%, #d4a017 100%)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-[#0a1f0e]" strokeWidth={2.2} />
                  <span className="font-black text-[#0a1f0e] text-base uppercase tracking-wide">ACTIVER UN TICKET</span>
                </div>
                <button onClick={resetActivation} className="text-[#0a1f0e]/50 hover:text-[#0a1f0e]/80 transition-colors">
                  <X className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                </button>
              </div>
              <p className="text-[#0a1f0e]/60 text-[12px] font-semibold mb-4">Entrez le code de ticket gagnant</p>

              {activationResult ? (
                <div
                  className="rounded-2xl p-4 flex flex-col items-center gap-2 animate-in fade-in duration-300"
                  style={{
                    background: activationResult.isWinner ? "rgba(22,163,74,0.2)" : "rgba(0,0,0,0.15)",
                    border: `1.5px solid ${activationResult.isWinner ? "rgba(22,163,74,0.5)" : "rgba(0,0,0,0.2)"}`,
                  }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#0a1f0e]/50">{activationResult.code}</span>
                  {activationResult.isWinner ? (
                    <>
                      <CheckCircle className="w-10 h-10 text-[#16a34a]" />
                      <p className="text-[#0a1f0e] font-black text-base uppercase text-center">{activationResult.prizeLabel}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black font-mono text-[#0a1f0e]" style={{ textShadow: isAnimating ? "0 0 16px rgba(0,0,0,0.3)" : "none" }}>
                          +{formatFC(rollingAmount)}
                        </span>
                        <span className="text-[#0a1f0e]/60 font-bold text-sm">FC</span>
                      </div>
                      {isAnimating
                        ? <p className="text-[#0a1f0e]/70 text-[10px] font-black tracking-widest animate-pulse">CALCUL EN COURS…</p>
                        : <p className="text-[#16a34a] text-[10px] font-black tracking-widest">✓ CRÉDITÉ SUR VOTRE SOLDE</p>
                      }
                    </>
                  ) : (
                    <>
                      <X className="w-10 h-10 text-[#0a1f0e]/40" />
                      <p className="text-[#0a1f0e]/70 font-black text-base uppercase">Perdu</p>
                      <p className="text-[#0a1f0e]/50 text-xs text-center">Tentez votre chance avec un autre ticket</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Input row */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      inputMode="text"
                      maxLength={10}
                      placeholder="KHF79HF5V2"
                      value={ticketCode}
                      onChange={(e) => { setActivationError(null); setTicketCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10)); }}
                      onKeyDown={(e) => { if (e.key === "Enter") activateTicket(); }}
                      className="flex-1 px-4 py-3 rounded-2xl text-center font-mono font-black text-xl tracking-[0.25em] outline-none border-2 transition-all"
                      style={{
                        background: "rgba(255,255,255,0.55)",
                        borderColor: activationError ? "#ef4444" : "rgba(255,255,255,0.8)",
                        color: "#0a1f0e",
                        caretColor: "#0a1f0e",
                      }}
                      autoFocus
                    />
                    <button
                      className="w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-95"
                      style={{ width: 52, height: 52, background: "rgba(255,255,255,0.4)", border: "2px solid rgba(255,255,255,0.7)" }}
                    >
                      <Scan className="w-5 h-5 text-[#0a1f0e]" />
                    </button>
                  </div>

                  {activationError && (
                    <p className="text-red-700 text-xs text-center mb-2 flex items-center justify-center gap-1 font-semibold">
                      <AlertCircle className="w-3 h-3" />{activationError}
                    </p>
                  )}

                  <button
                    onClick={activateTicket}
                    disabled={activating || ticketCode.length === 0}
                    className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ background: "rgba(0,0,0,0.25)", color: "#fff" }}
                  >
                    {activating
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Sparkles className="w-4 h-4" />}
                    {activating ? "Vérification…" : "ACTIVER"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}


      </div>

      {/* ── Retrait Modal ── */}
      {showRetrait && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeRetrait} />
          <div
            className="relative w-full max-w-sm rounded-t-3xl pb-10"
            style={{ background: isDark ? "#0d1f12" : "#ffffff", boxShadow: "0 -8px 48px rgba(0,0,0,0.4)" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-1" />
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-white/7" : "border-gray-100"}`}>
              <div>
                <h2 className={`text-lg font-black uppercase tracking-wider ${isDark ? "text-white" : "text-gray-900"}`}>DEMANDE DE RETRAIT</h2>
                <p className={`text-xs mt-0.5 ${subText}`}>
                  Solde dispo :&nbsp;<span className="text-[#8DC63F] font-bold">{balance !== null ? `${formatFC(balance)} FC` : "—"}</span>
                </p>
              </div>
              <button onClick={closeRetrait} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                <X className={`w-4 h-4 ${subText}`} />
              </button>
            </div>

            {retraitQR ? (
              retraitPaid ? (
                <div className="px-5 py-8 flex flex-col items-center gap-4 text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 0 32px rgba(34,197,94,0.4)" }}>
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <p className="font-black text-xl text-green-500">RETRAIT PAYÉ !</p>
                    <p className={`text-sm mt-1 ${subText}`}>Votre retrait de <span className="font-black text-[#F5C518]">{formatFC(retraitQR.amount)} FC</span> a été confirmé</p>
                  </div>
                  <div className="w-full rounded-xl px-4 py-3 text-xs" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <p className={`font-bold ${subText}`}>Confirmé le</p>
                    <p className="font-black text-green-500 mt-0.5">{new Date(retraitPaid.paidAt).toLocaleString("fr-FR")}</p>
                  </div>
                  <button onClick={closeRetrait} className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff" }}>FERMER</button>
                </div>
              ) : (
                <div className="px-5 py-6 flex flex-col items-center gap-4 text-center">
                  <p className={`font-black text-base ${isDark ? "text-white" : "text-gray-900"}`}>Présentez ce QR à un vendeur Halgo Cash</p>
                  <p className={`text-xs ${subText}`}>Retrait de <span className="text-[#F5C518] font-bold">{formatFC(retraitQR.amount)} FC</span> · en attente de paiement</p>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className={`text-xs font-semibold ${subText}`}>En attente de confirmation vendeur…</span>
                  </div>
                  <div className="p-4 rounded-2xl" style={{ background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
                    <QRCodeSVG value={retraitQR.qrValue} size={200} bgColor="#ffffff" fgColor="#0a1f0e" level="M" />
                  </div>
                  <div className="w-full rounded-xl px-4 py-2 text-xs font-mono break-all" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", color: isDark ? "#aaa" : "#666" }}>{retraitQR.token}</div>
                  <button onClick={closeRetrait} className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: isDark ? "#fff" : "#333" }}>ANNULER LE RETRAIT</button>
                </div>
              )
            ) : (
              <div className="px-5 pt-5 space-y-4">
                {quickAmounts.length > 0 && (
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${subText}`}>Montant rapide</p>
                    <div className="grid grid-cols-4 gap-2">
                      {quickAmounts.map((amt, i) => (
                        <button key={i} onClick={() => setRetraitAmount(String(amt))} className="py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                          style={{ background: retraitAmount === String(amt) ? "linear-gradient(135deg, #F5C518, #d4a017)" : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", color: retraitAmount === String(amt) ? "#0a1f0e" : isDark ? "#fff" : "#222" }}>
                          {["25%", "50%", "75%", "100%"][i]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${subText}`}>Montant à retirer (FC)</p>
                  <div className="relative">
                    <input type="number" min={1} max={balance ?? undefined} inputMode="numeric" placeholder="Ex: 5 000" value={retraitAmount}
                      onChange={(e) => { setRetraitAmount(e.target.value); setRetraitError(null); }}
                      className="w-full px-4 py-3.5 rounded-xl font-black text-2xl outline-none border-2 transition-all pr-16"
                      style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", borderColor: retraitError ? "#ef4444" : isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDark ? "#fff" : "#111" }}
                    />
                    <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold ${subText}`}>FC</span>
                  </div>
                  {retraitAmount && !isNaN(parseFloat(retraitAmount)) && (
                    <p className={`text-[11px] mt-1 ${subText}`}>≈ {(parseFloat(retraitAmount) / 2800).toFixed(2)} USD</p>
                  )}
                </div>
                {retraitError && (
                  <p className="text-red-400 text-xs flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{retraitError}</p>
                )}
                <button onClick={() => { void submitRetrait(); }} disabled={!retraitAmount || retraitLoading}
                  className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #F5C518, #d4a017)", color: "#0a1f0e", boxShadow: "0 4px 16px rgba(245,197,24,0.35)" }}>
                  {retraitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  {retraitLoading ? "GÉNÉRATION..." : "GÉNÉRER LE QR CODE"}
                </button>
                <p className={`text-[10px] text-center pb-2 ${subText}`}>Les retraits sont traités sous 24h ouvrées · Service Halgo Cash</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom Nav ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex"
        style={{
          background: "linear-gradient(90deg, #0f3d1c 0%, #16a34a 100%)",
          boxShadow: "0 -4px 20px rgba(15,61,28,0.4)",
          height: 64,
        }}
      >
        {[
          { label: "Accueil",     icon: HomeIcon,  active: true  },
          { label: "Historique",  icon: Clock, active: false },
        ].map(({ label, icon: Icon, active }) => (
          <button
            key={label}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-all active:opacity-70"
          >
            {active && (
              <span
                className="absolute top-0 rounded-full"
                style={{ width: 32, height: 3, background: "#F5C518", borderRadius: "0 0 4px 4px" }}
              />
            )}
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all"
              style={active ? { background: "rgba(245,197,24,0.18)" } : {}}
            >
              <Icon
                className="transition-colors"
                style={{ width: 20, height: 20, color: active ? "#F5C518" : "rgba(255,255,255,0.55)" }}
                strokeWidth={active ? 2.5 : 1.8}
              />
            </div>
            <span
              className="text-[9px] font-bold uppercase tracking-wide leading-none"
              style={{ color: active ? "#F5C518" : "rgba(255,255,255,0.55)" }}
            >
              {label}
            </span>
          </button>
        ))}
      </nav>

      {/* ── QR Code Modal ── */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowQR(false)} />
          <div className="relative w-full max-w-sm rounded-t-3xl p-6 pb-12"
            style={{ background: isDark ? "#0d1f12" : "#ffffff", boxShadow: "0 -8px 40px rgba(0,0,0,0.4)" }}>
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />
            <div className="flex items-center justify-between mb-2">
              <h2 className={`text-lg font-black uppercase tracking-wider ${isDark ? "text-white" : "text-gray-900"}`}>MON QR CODE</h2>
              <button onClick={() => setShowQR(false)} className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                <X className={`w-4 h-4 ${subText}`} />
              </button>
            </div>
            <p className={`text-xs mb-5 text-center ${subText}`}>Présentez ce QR code à un vendeur Halgo Cash pour recevoir un paiement.</p>
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-2xl" style={{ background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>
                <QRCodeSVG
                  value={JSON.stringify({ type: "halgo-pay", id: displayId, name: displayName, phone: rawPhone ?? "" })}
                  size={200} bgColor="#ffffff" fgColor="#0f3d1c" level="M" includeMargin={false}
                />
              </div>
              <div className="px-5 py-2 rounded-xl" style={{ background: "linear-gradient(135deg, #0f3d1c, #1a5c2a)" }}>
                <span className="font-mono font-black text-[#8DC63F] text-sm tracking-wider">{displayId}</span>
              </div>
              <p className={`text-xs text-center ${subText}`}>{displayName}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
