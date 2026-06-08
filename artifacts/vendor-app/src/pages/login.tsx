import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff, Loader2, LogIn, User, Lock, Shield, Headphones } from "lucide-react";
import { Link } from "wouter";

function GoldCoin({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="absolute rounded-full border-4 border-yellow-300/60 bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 shadow-lg"
      style={style}
    >
      <div className="w-full h-full rounded-full flex items-center justify-center">
        <span className="font-black text-yellow-600/80 select-none" style={{ fontSize: "40%" }}>₡</span>
      </div>
    </div>
  );
}

function PadlockIcon() {
  return (
    <div className="relative flex items-center justify-center mx-auto mb-1" style={{ width: 120, height: 130 }}>
      {/* Shield body */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ filter: "drop-shadow(0 8px 24px rgba(245,197,24,0.4))" }}
      >
        <svg viewBox="0 0 100 115" width="110" height="126" fill="none">
          <defs>
            <linearGradient id="shieldGold" x1="0" y1="0" x2="100" y2="115" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFE566" />
              <stop offset="50%" stopColor="#F5C518" />
              <stop offset="100%" stopColor="#D4A017" />
            </linearGradient>
            <linearGradient id="shieldHighlight" x1="0" y1="0" x2="60" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFF5A0" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#F5C518" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Main shield */}
          <path d="M50 5 L90 20 L90 55 Q90 90 50 110 Q10 90 10 55 L10 20 Z" fill="url(#shieldGold)" />
          {/* Highlight */}
          <path d="M50 10 L85 23 L85 55 Q85 86 50 105" stroke="url(#shieldHighlight)" strokeWidth="8" strokeLinecap="round" fill="none" />
        </svg>
      </div>
      {/* Padlock icon centered on shield */}
      <div className="relative z-10 mt-1">
        <div className="w-12 h-12 rounded-xl bg-white/90 flex items-center justify-center shadow-inner">
          <Lock className="w-7 h-7 text-yellow-600" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ email: identifier, password });
      setLocation("/");
    } catch (err: unknown) {
      const message = (err as { data?: { error?: string } })?.data?.error ?? "Identifiants incorrects";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-between overflow-hidden relative"
      style={{
        background: "linear-gradient(160deg, #FFE566 0%, #F5C518 35%, #FFB800 65%, #FF9F00 100%)",
      }}
    >
      {/* Dotted background pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.15) 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Floating coins */}
      <GoldCoin style={{ top: "6%", left: "6%", width: 54, height: 54, transform: "rotate(-15deg)" }} />
      <GoldCoin style={{ top: "3%", right: "8%", width: 42, height: 42, transform: "rotate(20deg)" }} />
      <GoldCoin style={{ top: "18%", right: "4%", width: 32, height: 32, transform: "rotate(-5deg)", opacity: 0.7 }} />
      <GoldCoin style={{ top: "24%", left: "3%", width: 28, height: 28, transform: "rotate(10deg)", opacity: 0.6 }} />

      {/* Top section — logo + icon */}
      <div className="relative z-10 flex flex-col items-center pt-10 pb-4 px-6 w-full">
        {/* Logo */}
        <div className="flex flex-col items-center leading-none mb-2">
          <span className="font-black tracking-tight text-[#1a1a2e]" style={{ fontSize: 46, lineHeight: 1 }}>HALGO</span>
          <div className="flex items-center gap-1 -mt-1">
            <span className="text-[#1a1a2e]/40 font-black text-xl">=</span>
            <span className="font-black tracking-tight text-white drop-shadow-sm" style={{ fontSize: 40, lineHeight: 1 }}>CASH</span>
            <span className="text-white font-black text-3xl -ml-0.5">⚡</span>
          </div>
        </div>
        <p className="text-[#1a1a2e]/70 font-semibold text-xs tracking-[0.25em] uppercase mt-1 mb-4">
          RAPIDE · SÉCURISÉ · FIABLE
        </p>

        {/* 3D Padlock */}
        <PadlockIcon />
      </div>

      {/* White card */}
      <div className="relative z-10 w-full max-w-sm mx-auto px-4 pb-4 flex-1 flex flex-col justify-center">
        <div className="bg-white rounded-3xl shadow-2xl px-6 pt-6 pb-5">
          {/* Card header */}
          <div className="flex flex-col items-center mb-5">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3 ring-4 ring-amber-200/60">
              <User className="w-6 h-6 text-amber-500" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-black text-gray-900">Bienvenue !</h2>
            <p className="text-sm text-gray-500 text-center mt-0.5">
              Connectez-vous à votre compte vendeur<br />Halgo Cash
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Username */}
            <div className="flex items-center gap-3 rounded-2xl border-2 border-gray-100 bg-amber-50/50 px-4 py-3 focus-within:border-amber-400 transition-colors">
              <User className="w-4 h-4 text-amber-400 shrink-0" />
              <input
                type="text"
                placeholder="Nom d'utilisateur"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none font-medium"
                required
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div className="flex items-center gap-3 rounded-2xl border-2 border-gray-100 bg-amber-50/50 px-4 py-3 focus-within:border-amber-400 transition-colors">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none font-medium"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-gray-400 hover:text-amber-500 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Remember me + Forgot */}
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setRemember((v) => !v)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${remember ? "bg-amber-400 border-amber-400" : "border-gray-300"}`}
                >
                  {remember && <span className="text-white text-[9px] font-black leading-none">✓</span>}
                </div>
                <span className="text-xs text-gray-500 font-medium">Se souvenir de moi</span>
              </label>
              <button type="button" className="text-xs text-amber-500 font-semibold hover:text-amber-600 transition-colors">
                Mot de passe oublié ?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-black text-sm uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-70"
              style={{
                background: "linear-gradient(90deg, #F5C518 0%, #FFB800 100%)",
                color: "#1a1a2e",
                boxShadow: "0 4px 16px rgba(245,197,24,0.45)",
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              SE CONNECTER
            </button>
          </form>

          {/* Separator */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-semibold">OU</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Security notice */}
          <div className="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-800">Accès réservé aux vendeurs Halgo Cash</p>
              <p className="text-[10px] text-gray-500">Sécurisé et confidentiel</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom help */}
      <div className="relative z-10 pb-6 pt-2 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
          <Headphones className="w-4 h-4 text-[#1a1a2e]/70" />
        </div>
        <div>
          <p className="text-xs font-black text-[#1a1a2e]">Besoin d'aide ?</p>
          <p className="text-[10px] text-[#1a1a2e]/60">
            <Link href="/register" className="hover:underline">Créer un compte</Link>
            {" · "}Contactez le support Halgo Cash
          </p>
        </div>
      </div>
    </div>
  );
}
