import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2, Smartphone } from "lucide-react";

function getOrCreateDeviceId(): string {
  const KEY = "hlg_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, password, deviceId }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Email ou mot de passe incorrect");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const displayCode = deviceId ? deviceId.slice(0, 8).toUpperCase() : "…";

  return (
    <div className="min-h-[100dvh] w-full bg-white flex flex-col justify-center px-6 py-10">
      <div className="w-full max-w-sm mx-auto">

        {/* ── Brand ─────────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <p className="text-4xl font-black tracking-tight leading-none">
            <span className="text-gray-900">halgo</span><span className="text-green-500">Cash</span>
          </p>
          <p className="text-sm font-medium text-gray-400 mt-2 tracking-widest uppercase">Espace vendeur</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-green-600"
            />
            <span className="text-sm text-gray-600">Se souvenir de moi</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-3.5 text-base font-bold text-white bg-green-600 hover:bg-green-700 active:scale-[0.98] disabled:opacity-70 transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Se connecter
          </button>
        </form>

        {/* Device ID */}
        <div className="mt-6 flex items-center gap-2.5 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
          <Smartphone className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Code appareil</p>
            <p className="text-sm font-mono font-black text-gray-700 truncate">{displayCode}</p>
          </div>
          <p className="text-[10px] text-gray-400 ml-auto shrink-0">Communiquer à l'admin</p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2026 Halgo Cash · Tous droits réservés
        </p>
      </div>
    </div>
  );
}
