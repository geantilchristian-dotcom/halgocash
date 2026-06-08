import { useState, useCallback, useEffect, useRef } from "react";
import { Bell, ChevronRight, History, CheckCircle, AlertCircle, X, QrCode, Zap, Sparkles, RotateCcw, Wallet, Send, ChevronDown } from "lucide-react";
import { useUser } from "@clerk/react";
import { QRCodeSVG } from "qrcode.react";
import { useTheme } from "@/lib/theme-context";

function formatFC(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(amount)).replace(/\s/g, ".");
}

// Rolling counter: animates from 0 → target over ~1.4s, ease-out curve
function useRollingCounter(target: number | null) {
  const [display, setDisplay] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (target === null) { setDisplay(0); return; }

    const STEPS    = 40;
    const DURATION = 1400;
    const INTERVAL = DURATION / STEPS;
    let step = 0;

    timerRef.current = setInterval(() => {
      step++;
      if (step >= STEPS) {
        setDisplay(target);
        clearInterval(timerRef.current!);
      } else {
        const t = step / STEPS;
        const eased = 1 - Math.pow(1 - t, 2.5);
        setDisplay(Math.round(eased * target));
      }
    }, INTERVAL);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [target]);

  return display;
}

export default function Home() {
  const { user } = useUser();
  const { isDark } = useTheme();
  const [showRetrait, setShowRetrait] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const [ticketCode, setTicketCode] = useState("");
  const [activating, setActivating] = useState(false);
  const [activationResult, setActivationResult] = useState<{
    code: string; isWinner: boolean; prizeAmount: number | null; prizeLabel: string;
  } | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);

  // Real persistent balance from DB
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceFlash, setBalanceFlash] = useState(false);

  // Withdrawal state
  const [retraitAmount, setRetraitAmount] = useState("");
  const [retraitPhone, setRetraitPhone] = useState("");
  const [retraitSent, setRetraitSent] = useState(false);
  const [retraitError, setRetraitError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/balance", { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { balance: number };
        setBalance(data.balance);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { void fetchBalance(); }, [user?.id]);

  const rollingAmount = useRollingCounter(
    activationResult?.isWinner ? (activationResult.prizeAmount ?? 0) : null,
  );

  useEffect(() => {
    if (activationResult?.isWinner && activationResult.prizeAmount) {
      void fetchBalance();
      setBalanceFlash(true);
      const t = setTimeout(() => setBalanceFlash(false), 700);
      return () => clearTimeout(t);
    }
  }, [activationResult?.code, activationResult?.isWinner]);

  useEffect(() => {
    if (!activationResult) return;
    const delay = activationResult.isWinner ? 2400 : 3000;
    const t = setTimeout(resetActivation, delay);
    return () => clearTimeout(t);
  }, [activationResult?.code]);

  useEffect(() => {
    const name = user?.fullName ?? user?.username ?? "Utilisateur";
    const ping = () => {
      fetch("/api/auth/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, [user?.id]);

  const activateTicket = useCallback(async () => {
    const code = ticketCode.trim().toUpperCase();
    if (!code) return;
    setActivating(true);
    setActivationError(null);
    setActivationResult(null);
    try {
      const res = await fetch("/api/tickets/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) setActivationError(data.error || "Code introuvable");
      else setActivationResult(data);
    } catch {
      setActivationError("Erreur de connexion");
    } finally {
      setActivating(false);
    }
  }, [ticketCode]);

  const resetActivation = () => {
    setTicketCode(""); setActivationResult(null); setActivationError(null);
  };

  const openRetrait = () => {
    setRetraitAmount("");
    setRetraitPhone("");
    setRetraitSent(false);
    setRetraitError(null);
    setShowRetrait(true);
  };

  const submitRetrait = () => {
    const amt = parseFloat(retraitAmount.replace(/\s/g, "").replace(",", "."));
    if (!amt || amt <= 0) { setRetraitError("Entrez un montant valide"); return; }
    if (!balance || amt > balance) { setRetraitError("Montant supérieur à votre solde disponible"); return; }
    if (!retraitPhone.trim()) { setRetraitError("Entrez votre numéro de téléphone"); return; }
    setRetraitError(null);
    setRetraitSent(true);
  };

  const displayId   = user ? `HG${(user.id ?? "").slice(-8).toUpperCase()}` : "HG----------";
  const displayName = user?.fullName ?? user?.username ?? "Utilisateur";
  const rawPhone    = (user?.phoneNumbers?.[0]?.phoneNumber) ?? (user?.unsafeMetadata?.phone as string | undefined) ?? null;

  const page = isDark ? "bg-[#080f0a]" : "bg-gray-50";
  const cardText = isDark ? "text-white" : "text-gray-900";
  const subText  = isDark ? "text-gray-400" : "text-gray-500";
  const card     = isDark ? "bg-[#0f2418] border-white/10" : "bg-white border-gray-100";

  const prizeTarget = activationResult?.isWinner ? (activationResult.prizeAmount ?? 0) : 0;
  const isAnimating = activationResult?.isWinner && rollingAmount < prizeTarget;

  // Quick amount shortcuts: 25%, 50%, 75%, 100%
  const quickAmounts = balance && balance > 0
    ? [0.25, 0.5, 0.75, 1].map((f) => Math.floor(balance * f))
    : [];

  return (
    <div className={`min-h-dvh flex flex-col pb-20 transition-colors ${page}`}>
      <div className="px-4 pt-4 space-y-4">

        {/* ── Advertising Banner ── */}
        <div className="rounded-2xl overflow-hidden relative flex items-center justify-between px-5 py-4"
          style={{ background: "linear-gradient(135deg, #0f3d1c 0%, #1a5c2a 60%, #0f3d1c 100%)", minHeight: 80 }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(120deg, transparent 30%, rgba(141,198,63,0.1) 50%, transparent 70%)" }} />
          <div className="relative z-10">
            <p className="text-white/40 text-[9px] font-bold uppercase tracking-[0.25em]">PUBLICITÉ</p>
            <p className="text-white font-black text-base tracking-wide mt-0.5">HALGO CASH</p>
            <p className="text-[#8DC63F] text-xs font-semibold">Gagnez jusqu'à 50 000 FC</p>
          </div>
          <div className="relative z-10 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-[#F5C518]/40 flex items-center justify-center"
              style={{ background: "rgba(245,197,24,0.15)" }}>
              <Bell className="w-5 h-5 text-[#F5C518]" />
            </div>
          </div>
        </div>

        {/* ── HALGO CASH Logo ── */}
        <div className={`rounded-2xl py-5 px-4 flex flex-col items-center shadow-sm border transition-colors ${card}`}>
          <div className="flex flex-col items-center leading-none">
            <span className={`text-[52px] font-black tracking-tight leading-none transition-colors ${cardText}`}>HALGO</span>
            <div className="flex items-center gap-1 -mt-1">
              <div className="flex flex-col gap-[3px] mr-1">
                <div className="w-5 h-[3px] rounded-full bg-[#F5C518] halgo-line-1" />
                <div className="w-3 h-[3px] rounded-full bg-[#F5C518] halgo-line-2" />
                <div className="w-4 h-[3px] rounded-full bg-[#F5C518] halgo-line-3" />
              </div>
              <span className="text-[52px] font-black italic text-[#3aab3a] tracking-tight leading-none halgo-cash-text">CASH</span>
              <Zap className="w-9 h-9 text-[#F5C518] fill-[#F5C518] ml-0.5 halgo-lightning" />
            </div>
          </div>
          <p className={`text-[11px] font-semibold tracking-[0.2em] uppercase mt-2 transition-colors ${subText}`}>
            RAPIDE · SECURISE · FIABLE
          </p>
        </div>

        {/* ── Balance Card ── */}
        <div
          className="rounded-2xl overflow-hidden shadow-xl relative"
          style={{
            background: "linear-gradient(135deg, #0a1f0e 0%, #0f3d1c 40%, #1a5c2a 70%, #0f3d1c 100%)",
            boxShadow: "0 8px 32px rgba(15,61,28,0.5)",
          }}
        >
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(141,198,63,0.15) 0%, transparent 70%)", transform: "translate(20%, -30%)" }} />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(245,197,24,0.1) 0%, transparent 70%)", transform: "translate(-20%, 30%)" }} />

          <div className="relative z-10 px-5 pt-5 pb-4">
            {/* Top row: label + user chip */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(141,198,63,0.2)", border: "1.5px solid rgba(141,198,63,0.35)" }}>
                  <Wallet className="w-3.5 h-3.5 text-[#8DC63F]" />
                </div>
                <span className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">SOLDE DISPONIBLE</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-[#8DC63F] animate-pulse" />
                <span className="text-white/70 text-[10px] font-semibold">{displayName.split(" ")[0]}</span>
              </div>
            </div>

            {/* Balance display */}
            <div
              className="mb-1 transition-all duration-300"
              style={{ transform: balanceFlash ? "scale(1.04)" : "scale(1)" }}
            >
              {balance === null ? (
                <div className="flex items-baseline gap-2">
                  <div className="h-10 w-32 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
                  <span className="text-white/30 text-lg font-bold">FC</span>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <span
                    className="font-black font-mono leading-none"
                    style={{
                      fontSize: balance >= 100000 ? "2.4rem" : "3rem",
                      color: balanceFlash ? "#8DC63F" : "#ffffff",
                      transition: "color 0.5s, font-size 0.2s",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {formatFC(balance)}
                  </span>
                  <span className="text-white/40 text-base font-bold mb-1">FC</span>
                </div>
              )}
            </div>

            {/* Equivalent USD hint */}
            {balance !== null && balance > 0 && (
              <p className="text-[#8DC63F]/60 text-[11px] font-medium mb-4">
                ≈ {(balance / 2800).toFixed(2)} USD
              </p>
            )}
            {balance !== null && balance === 0 && (
              <p className="text-white/25 text-[11px] font-medium mb-4">
                Grattez un ticket pour gagner
              </p>
            )}
            {balance === null && <div className="mb-4" />}

            {/* Divider */}
            <div className="h-px mb-4" style={{ background: "rgba(255,255,255,0.08)" }} />

            {/* Action buttons */}
            <div className="flex gap-2.5">
              <button
                onClick={openRetrait}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[13px] uppercase tracking-wider transition-all active:scale-[0.97]"
                style={{
                  background: "linear-gradient(135deg, #F5C518, #d4a017)",
                  color: "#0a1f0e",
                  boxShadow: "0 4px 16px rgba(245,197,24,0.4)",
                }}
              >
                <Send className="w-4 h-4" />
                RETRAIT
              </button>
              <button
                onClick={() => setShowQR(true)}
                className="px-4 flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.97]"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  border: "1.5px solid rgba(255,255,255,0.15)",
                }}
              >
                <QrCode className="w-4 h-4" />
                MON QR
              </button>
            </div>
          </div>
        </div>

        {/* ── Activer un Ticket ── */}
        <div className="rounded-2xl overflow-hidden shadow-md">
          <div className="p-4" style={{ background: isDark
            ? "linear-gradient(135deg, #1a0a00 0%, #2d1500 50%, #1a0a00 100%)"
            : "linear-gradient(135deg, #7c3a00 0%, #a34e00 50%, #7c3a00 100%)"
          }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(245,197,24,0.25)", border: "1.5px solid rgba(245,197,24,0.5)" }}>
                  <Sparkles className="w-4 h-4 text-[#F5C518]" />
                </div>
                <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest">ACTIVER UN TICKET</span>
              </div>
              {activationResult && (
                <button onClick={resetActivation} className="text-white/40 hover:text-white/70 transition-colors">
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>

            {activationResult ? (
              <div
                className="rounded-xl p-4 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{
                  background: activationResult.isWinner
                    ? "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(20,83,45,0.4))"
                    : "rgba(0,0,0,0.35)",
                  border: `1.5px solid ${activationResult.isWinner ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.1)"}`,
                }}>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">{activationResult.code}</span>
                {activationResult.isWinner ? (
                  <>
                    <CheckCircle className="w-10 h-10 text-[#22c55e]" />
                    <p className="text-white font-black text-lg uppercase tracking-wide text-center">
                      {activationResult.prizeLabel}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span
                        className="text-3xl font-black font-mono"
                        style={{
                          color: "#F5C518",
                          textShadow: isAnimating ? "0 0 20px rgba(245,197,24,0.8)" : "none",
                          transition: "text-shadow 0.3s",
                        }}
                      >
                        +{formatFC(rollingAmount)}
                      </span>
                      <span className="text-white/60 font-bold text-sm">FC</span>
                    </div>
                    {isAnimating ? (
                      <p className="text-[#8DC63F] text-[10px] font-bold tracking-widest animate-pulse">
                        CALCUL EN COURS…
                      </p>
                    ) : (
                      <p className="text-[#8DC63F] text-[10px] font-bold tracking-widest">
                        ✓ CRÉDITÉ SUR VOTRE SOLDE
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <X className="w-10 h-10 text-white/40" />
                    <p className="text-white/60 font-black text-base uppercase tracking-wide">Perdu</p>
                    <p className="text-white/30 text-xs text-center">Tentez votre chance avec un autre ticket</p>
                  </>
                )}
              </div>
            ) : (
              <>
                <input
                  type="text"
                  inputMode="text"
                  maxLength={10}
                  placeholder="KHF79HF5V2"
                  value={ticketCode}
                  onChange={(e) => {
                    setActivationError(null);
                    setTicketCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10));
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") activateTicket(); }}
                  className="w-full px-4 py-3 rounded-xl text-center font-mono font-black text-xl tracking-[0.3em] outline-none border-2 transition-all mb-3"
                  style={{
                    background: "rgba(0,0,0,0.35)",
                    borderColor: activationError ? "#ef4444" : "rgba(245,197,24,0.3)",
                    color: "#F5C518",
                    caretColor: "#F5C518",
                  }}
                />
                {activationError && (
                  <p className="text-red-400 text-xs text-center mb-2 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3" />{activationError}
                  </p>
                )}
                <button
                  onClick={activateTicket}
                  disabled={activating || ticketCode.length === 0}
                  className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #F5C518, #d4a017)", color: "#1a0a00", boxShadow: "0 4px 18px rgba(245,197,24,0.4)" }}
                >
                  {activating
                    ? <div className="w-4 h-4 border-2 border-[#1a0a00]/60 border-t-transparent rounded-full animate-spin" />
                    : <Sparkles className="w-4 h-4" />}
                  {activating ? "Vérification..." : "ACTIVER"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Historique ── */}
        <button
          className="w-full rounded-2xl px-5 py-4 flex items-center gap-3 active:scale-[0.99] transition-all shadow-sm"
          style={{ background: "linear-gradient(135deg, #0f3d1c 0%, #1a5c2a 100%)" }}
        >
          <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <History className="w-5 h-5 text-[#F5C518]" />
          </div>
          <span className="font-black text-white uppercase tracking-widest text-sm flex-1 text-left">HISTORIQUE</span>
          <ChevronRight className="w-5 h-5 text-white/60" />
        </button>

      </div>

      {/* ── Retrait Modal ── */}
      {showRetrait && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRetrait(false)} />
          <div
            className="relative w-full max-w-sm rounded-t-3xl pb-10"
            style={{
              background: isDark ? "#0d1f12" : "#ffffff",
              boxShadow: "0 -8px 48px rgba(0,0,0,0.4)",
            }}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-1" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }}>
              <div>
                <h2 className={`text-lg font-black uppercase tracking-wider ${cardText}`}>DEMANDE DE RETRAIT</h2>
                <p className={`text-xs mt-0.5 ${subText}`}>
                  Solde dispo :&nbsp;
                  <span className="text-[#8DC63F] font-bold">
                    {balance !== null ? `${formatFC(balance)} FC` : "—"}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowRetrait(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
              >
                <X className={`w-4 h-4 ${subText}`} />
              </button>
            </div>

            {retraitSent ? (
              /* ── Success state ── */
              <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
                  style={{ background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.35)" }}>
                  <CheckCircle className="w-8 h-8 text-[#22c55e]" />
                </div>
                <p className={`font-black text-lg ${cardText}`}>Demande envoyée !</p>
                <p className={`text-sm ${subText} max-w-xs`}>
                  Votre retrait de <span className="text-[#F5C518] font-bold">{formatFC(parseFloat(retraitAmount))} FC</span> est en cours de traitement.
                  Vous recevrez votre paiement sur le <span className="font-semibold">{retraitPhone}</span> sous 24h.
                </p>
                <button
                  onClick={() => setShowRetrait(false)}
                  className="mt-4 w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #F5C518, #d4a017)", color: "#0a1f0e" }}
                >
                  FERMER
                </button>
              </div>
            ) : (
              /* ── Form ── */
              <div className="px-5 pt-5 space-y-4">
                {/* Quick amount buttons */}
                {quickAmounts.length > 0 && (
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${subText}`}>Montant rapide</p>
                    <div className="grid grid-cols-4 gap-2">
                      {quickAmounts.map((amt, i) => (
                        <button
                          key={i}
                          onClick={() => setRetraitAmount(String(amt))}
                          className="py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                          style={{
                            background: retraitAmount === String(amt)
                              ? "linear-gradient(135deg, #F5C518, #d4a017)"
                              : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                            color: retraitAmount === String(amt) ? "#0a1f0e" : isDark ? "#fff" : "#222",
                            border: retraitAmount === String(amt) ? "none" : "1.5px solid transparent",
                          }}
                        >
                          {["25%", "50%", "75%", "100%"][i]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Amount input */}
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${subText}`}>Montant à retirer (FC)</p>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={balance ?? undefined}
                      inputMode="numeric"
                      placeholder="Ex: 5 000"
                      value={retraitAmount}
                      onChange={(e) => { setRetraitAmount(e.target.value); setRetraitError(null); }}
                      className="w-full px-4 py-3.5 rounded-xl font-black text-2xl outline-none border-2 transition-all pr-16"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                        borderColor: retraitError ? "#ef4444" : isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
                        color: isDark ? "#fff" : "#111",
                      }}
                    />
                    <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold ${subText}`}>FC</span>
                  </div>
                  {retraitAmount && !isNaN(parseFloat(retraitAmount)) && (
                    <p className={`text-[11px] mt-1 ${subText}`}>
                      ≈ {(parseFloat(retraitAmount) / 2800).toFixed(2)} USD
                    </p>
                  )}
                </div>

                {/* Phone number */}
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${subText}`}>Numéro Mobile Money</p>
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="+243 8XX XXX XXXX"
                    value={retraitPhone}
                    onChange={(e) => { setRetraitPhone(e.target.value); setRetraitError(null); }}
                    className="w-full px-4 py-3.5 rounded-xl font-semibold text-base outline-none border-2 transition-all"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                      borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
                      color: isDark ? "#fff" : "#111",
                    }}
                  />
                </div>

                {/* Error */}
                {retraitError && (
                  <p className="text-red-400 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{retraitError}
                  </p>
                )}

                {/* Submit */}
                <button
                  onClick={submitRetrait}
                  disabled={!retraitAmount || !retraitPhone}
                  className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{
                    background: "linear-gradient(135deg, #F5C518, #d4a017)",
                    color: "#0a1f0e",
                    boxShadow: "0 4px 16px rgba(245,197,24,0.35)",
                  }}
                >
                  <Send className="w-4 h-4" />
                  CONFIRMER LE RETRAIT
                </button>

                <p className={`text-[10px] text-center pb-2 ${subText}`}>
                  Les retraits sont traités sous 24h ouvrées · Service Halgo Cash
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── QR Code Modal ── */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowQR(false)} />
          <div
            className="relative w-full max-w-sm rounded-t-3xl p-6 pb-12"
            style={{
              background: isDark ? "#0d1f12" : "#ffffff",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.4)",
            }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />
            <div className="flex items-center justify-between mb-2">
              <h2 className={`text-lg font-black uppercase tracking-wider ${cardText}`}>MON QR CODE</h2>
              <button onClick={() => setShowQR(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                <X className={`w-4 h-4 ${subText}`} />
              </button>
            </div>
            <p className={`text-xs mb-5 text-center ${subText}`}>
              Présentez ce QR code à un vendeur Halgo Cash pour recevoir un paiement.
            </p>
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-2xl" style={{ background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>
                <QRCodeSVG
                  value={JSON.stringify({ type: "halgo-pay", id: displayId, name: displayName, phone: rawPhone ?? "" })}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#0f3d1c"
                  level="M"
                  includeMargin={false}
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
