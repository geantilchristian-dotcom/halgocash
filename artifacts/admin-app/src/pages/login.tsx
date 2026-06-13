import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(identifier, password);
      if (user.role !== "admin") {
        setError("Accès réservé aux administrateurs");
        return;
      }
      setLocation("/");
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? "Identifiants incorrects";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">Halgo Cash</p>
            <p className="text-zinc-400 text-xs tracking-widest uppercase">Control Room</p>
          </div>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-xl">Administration</CardTitle>
            <CardDescription className="text-zinc-400">
              Accès réservé au personnel autorisé
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert className="bg-red-950 border-red-800 text-red-300">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Identifier — no placeholder hint */}
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm">Identifiant</Label>
                <Input
                  type="text"
                  placeholder="••••••••••"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-indigo-500"
                  autoComplete="username"
                  required
                />
              </div>

              {/* Password with toggle */}
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm">Mot de passe</Label>
                <div className="relative">
                  <Input
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-indigo-500 pr-10"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mot de passe oublié */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowForgot((v) => !v)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Mot de passe oublié ?
                </button>
                {showForgot && (
                  <p className="mt-2 text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5">
                    Contactez le responsable technique Halgo Cash pour réinitialiser votre mot de passe.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                disabled={loading || !identifier || !password}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Accéder au tableau de bord
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Discrete footer — no credentials */}
        <p className="text-center text-zinc-600 text-xs mt-4">
          Accès sécurisé · Halgo Cash © 2025
        </p>
      </div>
    </div>
  );
}
