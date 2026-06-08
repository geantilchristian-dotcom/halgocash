import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Loader2, Info } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
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

              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm">Identifiant administrateur</Label>
                <Input
                  type="text"
                  placeholder="admin"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-indigo-500"
                  autoComplete="username"
                  required
                />
                <p className="text-zinc-500 text-xs">Nom d'utilisateur ou email</p>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm">Mot de passe</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-indigo-500"
                  autoComplete="current-password"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Accéder au tableau de bord
              </Button>
            </form>

            <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
              <p className="text-zinc-500 text-xs">
                Identifiant par défaut: <span className="text-zinc-300 font-mono">admin</span>
                {" / "}
                <span className="text-zinc-300 font-mono">Halgo@2024!</span>
                <br />
                Modifiable dans Paramètres.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
