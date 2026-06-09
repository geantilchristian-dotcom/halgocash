import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff, Loader2, LogIn, User, Lock, Shield } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      className="min-h-screen w-full flex flex-col items-center justify-between"
      style={{ background: "linear-gradient(160deg, #1a3d1a 0%, #0d2410 40%, #061008 100%)" }}
    >
      {/* Top — logo */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-14 pb-6 w-full">
        {/* Logo */}
        <div className="flex flex-col items-center leading-none mb-10">
          <span
            className="font-black tracking-tight text-white"
            style={{ fontSize: 52, lineHeight: 1, textShadow: "0 2px 12px rgba(0,0,0,0.18)" }}
          >
            HALGO
          </span>
          <span
            className="font-black tracking-tight"
            style={{ fontSize: 44, lineHeight: 1, color: "#facc15", textShadow: "0 2px 8px rgba(0,0,0,0.25)" }}
          >
            CASH
          </span>
        </div>

        {/* White card */}
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl px-6 pt-7 pb-6">
          {/* Title */}
          <h2 className="text-xl font-black text-gray-900 mb-1 text-center">Connexion vendeur</h2>
          <p className="text-sm text-gray-400 mb-6 text-center">Entrez vos identifiants pour accéder à votre espace</p>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Username */}
            <div className="flex items-center gap-3 rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 py-3.5 focus-within:border-green-500 focus-within:bg-green-50/40 transition-colors">
              <User className="w-4 h-4 text-green-600 shrink-0" />
              <input
                type="text"
                placeholder="Email ou nom d'utilisateur"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none font-medium"
                required
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div className="flex items-center gap-3 rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 py-3.5 focus-within:border-green-500 focus-within:bg-green-50/40 transition-colors">
              <Lock className="w-4 h-4 text-green-600 shrink-0" />
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
                className="text-gray-400 hover:text-green-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 font-black text-sm uppercase tracking-wider text-white transition-all active:scale-[0.98] disabled:opacity-70 mt-2"
              style={{
                background: "linear-gradient(90deg, #16a34a 0%, #15803d 100%)",
                boxShadow: "0 4px 16px rgba(22,163,74,0.4)",
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              SE CONNECTER
            </button>
          </form>

          {/* Security notice */}
          <div className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3 mt-5">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-700">Accès réservé aux vendeurs Halgo Cash</p>
              <p className="text-[10px] text-gray-400">Sécurisé et confidentiel</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="pb-8 text-center">
        <p className="text-white/60 text-xs">© 2026 Halgo Cash · Tous droits réservés</p>
      </div>
    </div>
  );
}
