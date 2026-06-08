import { useState, useRef, useCallback } from "react";
import { Bell, Wallet, Eye, EyeOff, Lock, ChevronRight, History, CheckCircle, AlertCircle, Copy, Edit2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { user } = useAuth();
  const [digits, setDigits] = useState<string[]>(Array(10).fill(""));
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const enteredCode = digits.join("");
  const isComplete = enteredCode.length === 10 && !digits.includes("");

  const displayId = user ? `HG${String(user.id).padStart(10, "0")}` : "HG----------";

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

    if (digit && index < 9) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join("");
    if (fullCode.length === 10 && !newDigits.includes("")) {
      checkBalance(fullCode);
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      const newDigits = [...digits];
      if (digits[index]) {
        newDigits[index] = "";
        setDigits(newDigits);
      } else if (index > 0) {
        newDigits[index - 1] = "";
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
      setBalance(null);
      setError(null);
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 9) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 10);
    const newDigits = Array(10).fill("");
    for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i]!;
    setDigits(newDigits);
    const focusIdx = Math.min(pasted.length, 9);
    inputRefs.current[focusIdx]?.focus();
    if (pasted.length === 10) checkBalance(pasted);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(displayId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const clearCode = () => {
    setDigits(Array(10).fill(""));
    setBalance(null);
    setError(null);
    inputRefs.current[0]?.focus();
  };

  return (
    <div className="min-h-dvh bg-[#f4f6f4]">
      {/* ── Dark Green Header ── */}
      <div className="bg-[#143024] px-5 pt-8 pb-16 relative overflow-hidden">
        {/* subtle radial glow */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-[#8DC63F]/10 blur-3xl pointer-events-none" />

        {/* top row: user info + bell */}
        <div className="flex items-start justify-between mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#1e4a30] border-2 border-[#8DC63F]/30 flex items-center justify-center shrink-0">
              <svg className="w-7 h-7 fill-white/80" viewBox="0 0 24 24">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12Zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8Z"/>
              </svg>
            </div>
            <div>
              <p className="text-white/50 text-[9px] uppercase tracking-widest font-semibold">ID Utilisateur</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-white font-bold font-mono text-sm tracking-wider">{displayId}</p>
                <button onClick={handleCopyId} className="text-[#8DC63F] hover:text-[#a8d44e] transition-colors">
                  {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <p className="text-white font-semibold text-sm">{user?.username ?? "—"}</p>
                <CheckCircle className="w-3.5 h-3.5 text-[#8DC63F]" />
              </div>
              <p className="text-white/50 text-xs mt-0.5">{user?.email ?? ""}</p>
            </div>
          </div>
          <button className="relative p-2">
            <Bell className="w-6 h-6 text-white/80" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#8DC63F]" />
          </button>
        </div>

        {/* HALGO CASH hero */}
        <div className="relative z-10">
          <div className="flex items-baseline gap-0 leading-none">
            <span className="text-[52px] font-black text-white tracking-tight font-sans">HALGO</span>
            <span className="text-[52px] font-black text-[#8DC63F] tracking-tight font-sans ml-2">CASH</span>
            <span className="text-[44px] font-black text-[#8DC63F] ml-1">›</span>
          </div>
          <p className="text-white/60 text-[11px] font-semibold tracking-[0.2em] uppercase mt-1">
            RAPIDE · SÉCURISÉ · FIABLE
          </p>
        </div>
      </div>

      {/* ── White Content Area ── */}
      <div className="bg-[#f4f6f4] -mt-6 rounded-t-3xl px-4 pt-5 pb-4 space-y-3">

        {/* Balance Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#eaf3ec] flex items-center justify-center">
              <Wallet className="w-4 h-4 text-[#143024]" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex-1">SOLDE ACTUEL</span>
            <button onClick={() => setShowBalance(!showBalance)} className="text-gray-400 hover:text-gray-600 transition-colors">
              {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>

          {checking ? (
            <Skeleton className="h-9 w-40 rounded-lg" />
          ) : balance ? (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-gray-900 font-mono tracking-tight">
                {showBalance ? formatXAF(balance.balance) : "• • • • •"}
              </span>
              <span className="text-base font-bold text-gray-400">{balance.currency === "USD" ? "XAF" : balance.currency}</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-gray-300 font-mono tracking-tight">
                {showBalance ? "-- . ---" : "• • • • •"}
              </span>
              <span className="text-base font-bold text-gray-300">XAF</span>
            </div>
          )}

          {balance && (
            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-[#8DC63F]" />
              {balance.ownerName}
            </p>
          )}
          {error && (
            <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {error}
            </p>
          )}
        </div>

        {/* Code Entry Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-[#143024]" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-1">
              SAISISSEZ VOTRE CODE À 10 CHIFFRES ICI
            </span>
            {enteredCode.length > 0 && (
              <button onClick={clearCode} className="text-[10px] text-gray-400 hover:text-red-400 font-bold transition-colors flex items-center gap-1">
                <Edit2 className="w-3 h-3" /> Effacer
              </button>
            )}
          </div>

          {/* 10 individual digit boxes */}
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
                  ${digit ? "border-[#143024] bg-[#eaf3ec] text-[#143024]" : "border-gray-200 bg-gray-50 text-gray-300"}
                  focus:border-[#8DC63F] focus:bg-white focus:shadow-[0_0_0_3px_rgba(141,198,63,0.15)]
                  ${checking ? "opacity-50 pointer-events-none" : ""}
                `}
                placeholder="×"
              />
            ))}
          </div>

          {checking && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
              <div className="w-3.5 h-3.5 border-2 border-[#8DC63F] border-t-transparent rounded-full animate-spin" />
              Vérification en cours…
            </div>
          )}

          {isComplete && !checking && !balance && !error && (
            <button
              onClick={() => checkBalance(enteredCode)}
              className="mt-3 w-full bg-[#143024] text-white text-sm font-bold rounded-xl py-3 hover:bg-[#1e4a30] transition-colors"
            >
              Vérifier le solde
            </button>
          )}
        </div>

        {/* Historique row */}
        <button className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 hover:bg-gray-50 active:scale-[0.99] transition-all">
          <div className="w-9 h-9 rounded-full bg-[#eaf3ec] flex items-center justify-center">
            <History className="w-4 h-4 text-[#143024]" />
          </div>
          <span className="font-black text-gray-800 uppercase tracking-wide text-sm flex-1 text-left">HISTORIQUE</span>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </button>

        {/* Recent transactions if balance loaded */}
        {balance && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Compte vérifié</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#eaf3ec] flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-[#143024]" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{balance.ownerName}</p>
                <p className="text-xs text-gray-400 font-mono">{balance.code}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="font-black text-[#143024]">{formatXAF(balance.balance)}</p>
                <p className="text-xs text-gray-400">{balance.currency === "USD" ? "XAF" : balance.currency}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
