import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Loader2, User, KeyRound, ShieldCheck } from "lucide-react";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Erreur réseau");
  }
  return res.json();
}

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");

  const identMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/admin/credentials", {
        method: "PUT",
        body: JSON.stringify({ username, email }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
      toast({ title: "Identifiants mis à jour", description: `Nouvel identifiant: ${data.username}` });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const pwMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/admin/credentials", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Mot de passe modifié avec succès" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    if (newPassword !== confirmPassword) {
      setPwError("Les mots de passe ne correspondent pas");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    pwMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-6 h-6 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Paramètres admin</h1>
          <p className="text-zinc-400 text-sm">Gérer vos identifiants de connexion</p>
        </div>
      </div>

      {/* Current info */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            Compte actuel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-700 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-white font-semibold">{user?.username}</p>
              <p className="text-zinc-400 text-sm">{user?.email}</p>
            </div>
            <span className="ml-auto px-2 py-0.5 rounded bg-indigo-600/20 text-indigo-300 border border-indigo-700 text-xs font-medium">
              Administrateur
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Change identifier */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <User className="w-4 h-4 text-zinc-400" />
            Modifier l'identifiant
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Changer le nom d'utilisateur et l'email utilisés pour la connexion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); identMutation.mutate(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Nom d'utilisateur</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="bg-zinc-800 border-zinc-700 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@halgo.cash"
                className="bg-zinc-800 border-zinc-700 text-white"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={identMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              {identMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Enregistrer les modifications
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-zinc-400" />
            Modifier le mot de passe
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Le mot de passe doit contenir au moins 8 caractères
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {pwError && (
              <Alert className="bg-red-950 border-red-800 text-red-300">
                <AlertDescription>{pwError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Mot de passe actuel</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-zinc-800 border-zinc-700 text-white"
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Nouveau mot de passe</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-zinc-800 border-zinc-700 text-white"
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Confirmer le nouveau mot de passe</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-zinc-800 border-zinc-700 text-white"
                required
                autoComplete="new-password"
              />
            </div>
            <Button
              type="submit"
              disabled={pwMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              {pwMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Modifier le mot de passe
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
