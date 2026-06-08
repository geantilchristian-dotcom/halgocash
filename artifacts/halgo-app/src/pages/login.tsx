import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ email, password });
      setLocation("/");
    } catch (err: unknown) {
      const message = (err as { data?: { error?: string } })?.data?.error ?? "Identifiant ou mot de passe incorrect";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#f4f6f4] flex flex-col">
      {/* Dark green header */}
      <div className="bg-[#143024] px-6 pt-14 pb-20 flex flex-col items-center">
        {/* Logo */}
        <div className="flex items-baseline gap-0 mb-2 leading-none">
          <span className="text-[42px] font-black text-white tracking-tight">HALGO</span>
          <span className="text-[42px] font-black text-[#8DC63F] tracking-tight ml-2">CASH</span>
          <span className="text-[36px] font-black text-[#8DC63F] ml-1">›</span>
        </div>
        <p className="text-white/50 text-[10px] font-semibold tracking-[0.2em] uppercase">
          RAPIDE · SÉCURISÉ · FIABLE
        </p>
      </div>

      {/* Form card floating up */}
      <div className="bg-[#f4f6f4] -mt-8 rounded-t-3xl flex-1 px-5 pt-6 pb-8">
        <h2 className="text-2xl font-black text-gray-900 mb-1">Connexion</h2>
        <p className="text-sm text-gray-400 mb-6">Accédez à votre compte joueur</p>

        {error && (
          <Alert variant="destructive" className="mb-4 rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Email</label>
            <Input
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-xl h-12 border-gray-200 bg-white focus-visible:ring-[#8DC63F] focus-visible:border-[#143024]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Mot de passe</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl h-12 border-gray-200 bg-white focus-visible:ring-[#8DC63F] focus-visible:border-[#143024] pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#143024] hover:bg-[#1e4a30] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Se connecter
          </button>
        </form>

        <p className="text-sm text-gray-400 text-center mt-6">
          Pas encore de compte ?{" "}
          <Link href="/register" className="text-[#143024] font-bold hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
