import { useState, useRef, useCallback } from "react";
import { Bell, Eye, EyeOff, Lock, ChevronRight, History, CheckCircle, AlertCircle, Copy, Phone, User } from "lucide-react";
import { useUser } from "@clerk/react";
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
  const { user } = useUser();
  const [digits, setDigits] = useState<string[]>(Array(10).fill(""));
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const enteredCode = digits.join("");
  const isComplete = enteredCode.length === 10 && !digits.includes("");

  const displayId = user ? `HG${(user.id ?? "").slice(-8).toUpperCase()}` : "HG----------";
  const displayName = user?.fullName ?? user?.username ?? "John Doe";
  const displayPhone = (user?.phoneNumbers?.[0]?.phoneNumber) ?? "+237 6 12 34 56 78";

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
    inputRefs.current[Math.min(pasted.length, 9)]?.focus();
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
    <div className="min-h-dvh bg-gray-50 flex flex-col pb-20">
      <div className="px-4 pt-4 space-y-4">

        {/* ── User Profile Card ── */}
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, #0f3d1c 0%, #1a5c2a 40%, #1e6b31 60%, #0f3d1c 100%)" }}
        >
          {/* diagonal stripe decoration */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(120deg, transparent 30%, rgba(141,198,63,0.12) 50%, transparent 70%)",
            }}
          />
          <div className="relative z-10 p-4 flex items-start justify-between">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center shrink-0">
                <User className="w-8 h-8 text-white/80" />
              </div>
              {/* Info */}
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
                  <p className="text-white/70 text-sm">{displayPhone}</p>
                </div>
              </div>
            </div>
            {/* Bell */}
            <button className="relative p-1 mt-1">
              <div className="w-10 h-10 rounded-full bg-[#F5C518] flex items-center justify-center shadow-md">
                <Bell className="w-5 h-5 text-[#0f3d1c]" />
              </div>
            </button>
          </div>
        </div>

        {/* ── HALGO CASH Logo ── */}
        <div className="bg-white rounded-2xl py-5 px-4 flex flex-col items-center shadow-sm border border-gray-100">
          <div className="flex flex-col items-center leading-none">
            <span className="text-[56px] font-black text-[#0f3d1c] tracking-tight leading-none">HALGO</span>
            <div className="flex items-center gap-1 -mt-1">
              {/* speed lines */}
              <div className="flex flex-col gap-[3px] mr-1">
                <div className="w-5 h-[3px] rounded-full bg-[#F5C518]" />
                <div className="w-3 h-[3px] rounded-full bg-[#F5C518]" />
                <div className="w-4 h-[3px] rounded-full bg-[#F5C518]" />
              </div>
              <span className="text-[56px] font-black italic text-[#3aab3a] tracking-tight leading-none">CASH</span>
            </div>
          </div>
          <p className="text-gray-400 text-[11px] font-semibold tracking-[0.2em] uppercase mt-2">
            RAPIDE • SÉCURISÉ • FIABLE
          </p>
        </div>

        {/* ── Balance Card ── */}
        <div className="bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            {/* Coin/wallet icon */}
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #F5C518, #8DC63F)" }}>
              <span className="text-2xl">💰</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">SOLDE ACTUEL</span>
                <button onClick={() => setShowBalance(!showBalance)} className="text-gray-400 hover:text-gray-600">
                  {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
              {checking ? (
                <Skeleton className="h-8 w-36 rounded-lg mt-1" />
              ) : balance ? (
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-black text-gray-900 font-mono tracking-tight">
                    {showBalance ? formatXAF(balance.balance) : "• • • • •"}
                  </span>
                  <span className="text-base font-bold text-gray-500">XAF</span>
                </div>
              ) : (
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-black text-gray-300 font-mono tracking-tight">
                    {showBalance ? "-- . ---" : "• • • • •"}
                  </span>
                  <span className="text-base font-bold text-gray-300">XAF</span>
                </div>
              )}
            </div>
          </div>
          {balance && (
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1 pl-1">
              <CheckCircle className="w-3 h-3 text-[#3aab3a]" />
              {balance.ownerName}
            </p>
          )}
          {error && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1 pl-1">
              <AlertCircle className="w-3 h-3" />
              {error}
            </p>
          )}
        </div>

        {/* ── Code Entry Card ── */}
        <div className="bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#eaf3ec] flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-[#0f3d1c]" />
            </div>
            <div className="flex-1 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-tight">
                SAISISSEZ VOTRE CODE<br />À 10 CHIFFRES ICI
              </span>
              {enteredCode.length > 0 && (
                <button onClick={clearCode} className="text-[10px] text-gray-400 hover:text-red-400 font-bold transition-colors">
                  Effacer
                </button>
              )}
            </div>
          </div>

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
                  ${digit ? "border-[#0f3d1c] bg-[#eaf3ec] text-[#0f3d1c]" : "border-gray-200 bg-white text-gray-400"}
                  focus:border-[#3aab3a] focus:bg-white focus:shadow-[0_0_0_3px_rgba(58,171,58,0.12)]
                  ${checking ? "opacity-50 pointer-events-none" : ""}
                `}
                placeholder="×"
              />
            ))}
          </div>

          {checking && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
              <div className="w-3.5 h-3.5 border-2 border-[#3aab3a] border-t-transparent rounded-full animate-spin" />
              Vérification en cours…
            </div>
          )}
          {isComplete && !checking && !balance && !error && (
            <button
              onClick={() => checkBalance(enteredCode)}
              className="mt-3 w-full bg-[#0f3d1c] text-white text-sm font-bold rounded-xl py-3 hover:bg-[#1a5c2a] active:scale-[0.99] transition-all"
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
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Compte vérifié</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#eaf3ec] flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-[#0f3d1c]" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{balance.ownerName}</p>
                <p className="text-xs text-gray-400 font-mono">{balance.code}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="font-black text-[#0f3d1c]">{formatXAF(balance.balance)}</p>
                <p className="text-xs text-gray-400">XAF</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
