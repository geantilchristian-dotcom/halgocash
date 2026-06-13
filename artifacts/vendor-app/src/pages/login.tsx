import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
      const message =
        (err as { data?: { error?: string } })?.data?.error ??
        "Email ou mot de passe incorrect";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Title */}
        <h1 className="text-3xl font-black text-gray-900 text-center mb-8">
          Bienvenue
        </h1>

        {/* Error */}
        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">
              Adresse Email
            </label>
            <input
              type="text"
              placeholder="votre.nom@exemple.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-800 placeholder:text-gray-400 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-800 placeholder:text-gray-400 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-green-600"
            />
            <span className="text-sm text-gray-600">Se souvenir de moi</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-3.5 text-base font-bold text-white bg-green-600 hover:bg-green-700 active:scale-[0.98] disabled:opacity-70 transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Se connecter
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8">
          © 2026 Halgo Cash · Tous droits réservés
        </p>
      </div>
    </div>
  );
}
