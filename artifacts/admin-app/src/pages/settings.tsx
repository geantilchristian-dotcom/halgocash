import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Loader2, User, KeyRound, ShieldCheck, Trash2, AlertTriangle, X } from "lucide-react";

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

  // Reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const RESET_WORD = "VIDER";

  const resetMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/admin/reset", { method: "DELETE" }),
    onSuccess: (data: { deletedTickets: number; deletedWithdrawals: number }) => {
      setShowResetModal(false);
      setResetConfirmText("");
      // Invalidate only data queries — not auth/me (would trigger logout redirect)
      void queryClient.invalidateQueries({ queryKey: ["/api/admin"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/draws"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Stock vidé avec succès",
        description: `${data.deletedTickets} billets et ${data.deletedWithdrawals} retraits supprimés.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur lors de la réinitialisation", description: err.message, variant: "destructive" });
    },
  });

  // Admin credentials
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
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      toast({ title: "Mot de passe modifié avec succès" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    if (newPassword !== confirmPassword) { setPwError("Les mots de passe ne correspondent pas"); return; }
    if (newPassword.length < 8) { setPwError("Le mot de passe doit contenir au moins 8 caractères"); return; }
    pwMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Reset confirmation modal ── */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-red-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-900/40 border border-red-700 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Vider tout le stock</p>
                  <p className="text-xs text-zinc-400">Action irréversible</p>
                </div>
              </div>
              <button onClick={() => { setShowResetModal(false); setResetConfirmText(""); }}
                className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors">
                <X className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="rounded-lg bg-red-950/50 border border-red-800/60 p-3 space-y-1.5">
                <p className="text-red-300 font-semibold text-sm flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Cette action va supprimer définitivement :
                </p>
                <ul className="text-red-400/80 text-xs space-y-1 pl-5 list-disc">
                  <li>Tous les billets (tous les lots, toutes les séries)</li>
                  <li>Tous les retraits en attente et payés</li>
                  <li>Tous les historiques d'activation joueurs</li>
                </ul>
                <p className="text-red-400 text-xs font-bold mt-1">
                  Aucune annulation possible après confirmation.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs">
                  Tapez <span className="font-black text-red-400 font-mono">{RESET_WORD}</span> pour confirmer
                </Label>
                <Input
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                  placeholder={RESET_WORD}
                  className="bg-zinc-800 border-zinc-700 text-white font-mono font-bold"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  variant="ghost"
                  className="flex-1 text-zinc-400 hover:text-white border border-zinc-700"
                  onClick={() => { setShowResetModal(false); setResetConfirmText(""); }}
                  disabled={resetMutation.isPending}
                >
                  Annuler
                </Button>
                <Button
                  className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold disabled:opacity-40"
                  disabled={resetConfirmText !== RESET_WORD || resetMutation.isPending}
                  onClick={() => resetMutation.mutate()}
                >
                  {resetMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Suppression…</>
                    : <><Trash2 className="w-4 h-4 mr-2" />Vider le stock</>
                  }
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <SettingsIcon className="w-6 h-6 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Paramètres</h1>
          <p className="text-zinc-400 text-sm">Gérer votre compte et les vendeurs</p>
        </div>
      </div>

      {/* Current account info */}
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
          <form onSubmit={(e) => { e.preventDefault(); identMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Nom d'utilisateur</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="admin" className="bg-zinc-800 border-zinc-700 text-white" required />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@halgo.cash" className="bg-zinc-800 border-zinc-700 text-white" required />
            </div>
            <Button type="submit" disabled={identMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
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
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••" className="bg-zinc-800 border-zinc-700 text-white"
                required autoComplete="current-password" />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Nouveau mot de passe</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••" className="bg-zinc-800 border-zinc-700 text-white"
                required autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Confirmer le nouveau mot de passe</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••" className="bg-zinc-800 border-zinc-700 text-white"
                required autoComplete="new-password" />
            </div>
            <Button type="submit" disabled={pwMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
              {pwMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Modifier le mot de passe
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Danger Zone ── */}
      <Card className="bg-zinc-900 border-red-800/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-red-400 text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Zone Danger
          </CardTitle>
          <CardDescription className="text-zinc-500">
            Ces actions sont irréversibles. Utilisez avec extrême prudence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-red-950/20 border border-red-900/40">
            <div>
              <p className="text-white text-sm font-semibold">Vider tout le stock</p>
              <p className="text-zinc-400 text-xs mt-1">
                Supprime l'intégralité des billets (tous les lots et séries) ainsi que
                tous les retraits en attente et payés. Les soldes joueurs sont remis à zéro.
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-red-800 hover:bg-red-700 text-white border border-red-700 font-semibold"
              onClick={() => setShowResetModal(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Vider le stock
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
