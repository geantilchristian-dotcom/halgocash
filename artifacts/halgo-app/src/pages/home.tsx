import { useState, useRef, useCallback } from "react";
import { Bell, Eye, EyeOff, Lock, ChevronRight, History, CheckCircle, AlertCircle, Copy, Phone, User, ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import { useUser } from "@clerk/react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/lib/theme-context";

interface BalanceData {
  code: string;
  balance: number;
  currency: string;
  ownerName: string;
}

function formatXAF(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(amount)).replace(/\s/g, ".");
}

export default function Home() {
  const { user } = useUser();
  const { isDark } = useTheme();
  const [digits, setDigits] = useState<string[]>(Array(10).fill(""));
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRetrait, setShowRetrait] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const enteredCode = digits.join("");
  const isComplete = enteredCode.length === 10 && !digits.includes("");

  const displayId = user ? `HG${(user.id ?? "").slice(-8).toUpperCase()}` : "HG----------";
  const displayName = user?.fullName ?? user?.username ?? "John Doe";
  const rawPhone = (user?.phoneNumbers?.[0]?.phoneNumber)
    ?? (user?.unsafeMetadata?.phone as string | undefined)
    ?? null;
  const displayPhone = rawPhone ?? "+243 _ _ _ _ _ _ _ _";

  const checkBalance = useCallback(async (code: string) => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/balance/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Code introuvable");
        setBalance(null);
      } else {
        const data: BalanceData = await res.json();
        setBalance(data);
        setError(null);
      }
    } catch {
      setError("Erreur de connexion");
    } finally {
      setChecking(false);
    }
  }, []);

  const handleDigitInput = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    if (digit && index < 9) inputRefs.current[index + 1]?.focus();
    const fullCode = newDigits.join("");
    if (fullCode.length === 10 && !newDigits.includes("")) checkBalance(fullCode);
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      const newDigits = [...digits];
      if (digits[index]) { newDigits[index] = ""; setDigits(newDigits); }
      else if (index > 0) { newDigits[index - 1] = ""; setDigits(newDigits); inputRefs.current[index - 1]?.focus(); }
      setBalance(null); setError(null);
    } else if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    else if (e.key === "ArrowRight" && index < 9) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 10);
    const newDigits = Array(10).fill("");
    for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i]!;
    setDigits(newDigits);
    inputRefs.current[Math.min(pasted.length, 9)]?.focus();
    if (pasted.length === 10) checkBalance(pasted);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(displayId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const clearCode = () => {
    setDigits(Array(10).fill("")); setBalance(null); setError(null);
    inputRefs.current[0]?.focus();
  };

  /* ── formatted code display ── */
  const codeDisplay = digits.map((d, i) => {
    const char = d || "–";
    if (i === 4 || i === 8) return " " + char;
    return char;
  }).join(" ");

  const card = isDark ? "bg-[#0f2418] border-white/10" : "bg-white border-gray-100";
  const cardText = isDark ? "text-white" : "text-gray-900";
  const subText = isDark ? "text-gray-400" : "text-gray-500";
  const page = isDark ? "bg-[#080f0a]" : "bg-gray-50";

  return (
    <div className={`min-h-dvh flex flex-col pb-20 transition-colors ${page}`}>
      <div className="px-4 pt-4 space-y-4">

        {/* ── User Profile Card ── */}
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, #0f3d1c 0%, #1a5c2a 40%, #1e6b31 60%, #0f3d1c 100%)" }}
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(120deg, transparent 30%, rgba(141,198,63,0.12) 50%, transparent 70%)" }} />
          <div className="relative z-10 p-4 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center shrink-0 overflow-hidden">
                {user?.imageUrl
                  ? <img src={user.imageUrl} alt="avatar" className="w-full h-full object-cover" />
                  : <User className="w-8 h-8 text-white/80" />}
              </div>
              <div>
                <p className="text-white/50 text-[9px] uppercase tracking-widest font-semibold">ID Utilisateur</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-[#8DC63F] font-bold font-mono text-sm tracking-wider">{displayId}</p>
                  <button onClick={handleCopyId} className="text-[#8DC63F] hover:opacity-80 transition-opacity">
                    {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <User className="w-3.5 h-3.5 text-[#8DC63F]" />
                  <p className="text-white font-semibold text-sm">{displayName}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-[#8DC63F]" />
                  <p className={`text-sm ${rawPhone ? "text-white/80" : "text-white/40 italic"}`}>{displayPhone}</p>
                </div>
              </div>
            </div>
            <button className="relative p-1 mt-1">
              <div className="w-10 h-10 rounded-full bg-[#F5C518] flex items-center justify-center shadow-md">
                <Bell className="w-5 h-5 text-[#0f3d1c]" />
              </div>
            </button>
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
              <span className="text-[40px] font-black text-[#F5C518] leading-none halgo-lightning ml-0.5">⚡</span>
            </div>
          </div>
          <p className={`text-[11px] font-semibold tracking-[0.2em] uppercase mt-2 transition-colors ${subText}`}>
            RAPIDE • SÉCURISÉ • FIABLE
          </p>
        </div>

        {/* ── Balance Card (IMPROVED) ── */}
        <div
          className="rounded-2xl overflow-hidden shadow-md"
          style={{ background: isDark
            ? "linear-gradient(135deg, #071a0d 0%, #0f2e18 50%, #0a1f10 100%)"
            : "linear-gradient(135deg, #0f3d1c 0%, #1a5c2a 50%, #0f3d1c 100%)"
          }}
        >
          {/* shimmer stripe */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(105deg, transparent 40%, rgba(245,197,24,0.06) 50%, transparent 60%)" }} />

          <div className="p-4 relative">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #F5C518, #8DC63F)" }}>
                  <span className="text-xl">💰</span>
                </div>
                <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">SOLDE ACTUEL</span>
              </div>
              <button onClick={() => setShowBalance(!showBalance)} className="text-white/40 hover:text-white/70 transition-colors mt-1">
                {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>

            {checking ? (
              <Skeleton className="h-10 w-44 rounded-xl mb-1 bg-white/10" />
            ) : balance ? (
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-black text-white font-mono tracking-tight">
                  {showBalance ? formatXAF(balance.balance) : "• • • • •"}
                </span>
                <span className="text-base font-bold text-white/50">XAF</span>
              </div>
            ) : (
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-black font-mono tracking-tight" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {showBalance ? "– –  . – – –" : "• • • • •"}
                </span>
                <span className="text-base font-bold text-white/20">XAF</span>
              </div>
            )}

            {balance && (
              <p className="text-white/50 text-xs flex items-center gap-1 mb-3">
                <CheckCircle className="w-3 h-3 text-[#8DC63F]" />
                {balance.ownerName}
              </p>
            )}
            {error && (
              <p className="text-red-300 text-xs flex items-center gap-1 mb-3">
                <AlertCircle className="w-3 h-3" />{error}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-2">
              <button
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
                style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
                onClick={() => alert("Fonctionnalité dépôt à venir")}
              >
                <ArrowDownLeft className="w-4 h-4 text-[#8DC63F]" />
                DÉPÔT
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #F5C518, #d4a017)", color: "#0f3d1c", boxShadow: "0 4px 14px rgba(245,197,24,0.35)" }}
                onClick={() => setShowRetrait(true)}
              >
                <ArrowUpRight className="w-4 h-4" />
                RETRAIT
              </button>
            </div>
          </div>
        </div>

        {/* ── Code Entry Card ── */}
        <div className={`rounded-2xl px-4 py-4 shadow-sm border transition-colors ${card}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isDark ? "bg-white/10" : "bg-[#eaf3ec]"}`}>
              <Lock className={`w-4 h-4 ${isDark ? "text-[#8DC63F]" : "text-[#0f3d1c]"}`} />
            </div>
            <div className="flex-1 flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wide leading-tight ${subText}`}>
                SAISISSEZ VOTRE CODE<br />À 10 CHIFFRES ICI
              </span>
              {enteredCode.length > 0 && (
                <button onClick={clearCode}
                  className={`text-[10px] font-bold transition-colors flex items-center gap-0.5 ${isDark ? "text-gray-500 hover:text-red-400" : "text-gray-400 hover:text-red-400"}`}>
                  <X className="w-3 h-3" />Effacer
                </button>
              )}
            </div>
          </div>

          {/* ── NUMBER DISPLAY ── */}
          <div
            className={`mb-3 py-2.5 px-4 rounded-xl flex items-center justify-center transition-all ${
              isDark ? "bg-black/30 border border-white/10" : "bg-[#f0f7f1] border border-[#c8e6c9]"
            }`}
          >
            <span
              className={`font-mono font-black text-xl tracking-[0.25em] transition-colors ${
                enteredCode.length > 0
                  ? isDark ? "text-[#8DC63F]" : "text-[#0f3d1c]"
                  : isDark ? "text-gray-600" : "text-gray-300"
              }`}
            >
              {codeDisplay}
            </span>
          </div>

          {/* ── DIGIT BOXES ── */}
          <div className="flex gap-1.5 justify-between" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitInput(i, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(i, e)}
                onClick={() => inputRefs.current[i]?.select()}
                className={`
                  w-full aspect-square min-w-0 text-center font-mono font-bold text-sm rounded-lg border-2 transition-all outline-none
                  ${digit
                    ? isDark
                      ? "border-[#3aab3a] bg-[#3aab3a]/20 text-[#8DC63F]"
                      : "border-[#0f3d1c] bg-[#eaf3ec] text-[#0f3d1c]"
                    : isDark
                      ? "border-white/10 bg-black/20 text-gray-500"
                      : "border-gray-200 bg-white text-gray-400"
                  }
                  ${isDark
                    ? "focus:border-[#3aab3a] focus:bg-[#3aab3a]/10 focus:shadow-[0_0_0_3px_rgba(58,171,58,0.2)]"
                    : "focus:border-[#3aab3a] focus:bg-white focus:shadow-[0_0_0_3px_rgba(58,171,58,0.12)]"
                  }
                  ${checking ? "opacity-50 pointer-events-none" : ""}
                `}
                placeholder="·"
              />
            ))}
          </div>

          {checking && (
            <div className={`mt-3 flex items-center gap-2 text-xs ${subText}`}>
              <div className="w-3.5 h-3.5 border-2 border-[#3aab3a] border-t-transparent rounded-full animate-spin" />
              Vérification en cours…
            </div>
          )}
          {isComplete && !checking && !balance && !error && (
            <button
              onClick={() => checkBalance(enteredCode)}
              className="mt-3 w-full text-white text-sm font-bold rounded-xl py-3 active:scale-[0.99] transition-all"
              style={{ background: "linear-gradient(135deg, #0f3d1c, #1a5c2a)" }}
            >
              Vérifier le solde
            </button>
          )}
        </div>

        {/* ── Historique Button ── */}
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

        {/* ── Verified Account Detail ── */}
        {balance && (
          <div className={`rounded-2xl p-4 shadow-sm border transition-colors animate-in fade-in slide-in-from-bottom-4 duration-300 ${card}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${subText}`}>Compte vérifié</p>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? "bg-white/10" : "bg-[#eaf3ec]"}`}>
                <CheckCircle className={`w-5 h-5 ${isDark ? "text-[#8DC63F]" : "text-[#0f3d1c]"}`} />
              </div>
              <div>
                <p className={`font-bold ${cardText}`}>{balance.ownerName}</p>
                <p className={`text-xs font-mono ${subText}`}>{balance.code}</p>
              </div>
              <div className="ml-auto text-right">
                <p className={`font-black ${isDark ? "text-[#8DC63F]" : "text-[#0f3d1c]"}`}>{formatXAF(balance.balance)}</p>
                <p className={`text-xs ${subText}`}>XAF</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Retrait Modal ── */}
      {showRetrait && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRetrait(false)} />
          <div className={`relative w-full max-w-sm rounded-t-3xl p-6 pb-10 transition-colors ${isDark ? "bg-[#0f2418]" : "bg-white"}`}
            style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.3)" }}>
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5" />
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-black uppercase tracking-wider ${cardText}`}>RETRAIT</h2>
              <button onClick={() => setShowRetrait(false)}
                className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
                <X className={`w-4 h-4 ${subText}`} />
              </button>
            </div>
            <p className={`text-sm mb-6 ${subText}`}>
              Pour effectuer un retrait, entrez votre code à 10 chiffres ci-dessus puis confirmez le montant.
            </p>
            {balance ? (
              <div>
                <div className={`rounded-xl p-4 mb-4 ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${subText}`}>Solde disponible</p>
                  <p className={`text-2xl font-black ${isDark ? "text-[#8DC63F]" : "text-[#0f3d1c]"}`}>
                    {formatXAF(balance.balance)} <span className={`text-sm font-bold ${subText}`}>XAF</span>
                  </p>
                </div>
                <button
                  className="w-full py-4 rounded-xl font-black text-[#0f3d1c] text-sm uppercase tracking-widest"
                  style={{ background: "linear-gradient(135deg, #F5C518, #d4a017)", boxShadow: "0 4px 20px rgba(245,197,24,0.4)" }}
                  onClick={() => { setShowRetrait(false); alert("Fonctionnalité retrait bientôt disponible !"); }}
                >
                  CONFIRMER LE RETRAIT
                </button>
              </div>
            ) : (
              <div className={`text-center py-4 text-sm ${subText}`}>
                ⚠️ Vérifiez d'abord votre code pour accéder au retrait.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
