import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useListVendors, useCreateVendor, getListVendorsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Loader2, User, KeyRound, ShieldCheck, Plus, Store } from "lucide-react";

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

  // Admin credentials
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");

  // Vendor creation
  const [vendorName, setVendorName] = useState("");
  const [vendorLocation, setVendorLocation] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [showVendorForm, setShowVendorForm] = useState(false);

  const { data: vendors } = useListVendors();
  const createVendor = useCreateVendor();

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

  const handleCreateVendor = () => {
    if (!vendorName.trim()) return;
    createVendor.mutate({ data: { name: vendorName, location: vendorLocation, phone: vendorPhone } }, {
      onSuccess: () => {
        setVendorName(""); setVendorLocation(""); setVendorPhone("");
        setShowVendorForm(false);
        queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        toast({ title: "Vendeur créé avec succès" });
      },
      onError: (err: Error) => {
        toast({ title: "Erreur", description: err.message, variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
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

      {/* Vendor management */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Store className="w-4 h-4 text-zinc-400" />
                Gestion des vendeurs
              </CardTitle>
              <CardDescription className="text-zinc-400 mt-1">
                Créer et gérer les comptes vendeurs
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowVendorForm(!showVendorForm)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Nouveau vendeur
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showVendorForm && (
            <div className="p-4 rounded-lg bg-zinc-800/60 border border-zinc-700 space-y-3">
              <p className="text-zinc-300 text-sm font-semibold">Créer un compte vendeur</p>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">Nom du vendeur *</Label>
                  <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)}
                    placeholder="Jean Mwamba" className="bg-zinc-700 border-zinc-600 text-white text-sm h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">Localisation</Label>
                  <Input value={vendorLocation} onChange={(e) => setVendorLocation(e.target.value)}
                    placeholder="Kinshasa, Gombe" className="bg-zinc-700 border-zinc-600 text-white text-sm h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">Téléphone</Label>
                  <Input value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)}
                    placeholder="+243 81X XXX XXX" className="bg-zinc-700 border-zinc-600 text-white text-sm h-9" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleCreateVendor} disabled={createVendor.isPending || !vendorName.trim()}
                  className="bg-green-700 hover:bg-green-600 text-white">
                  {createVendor.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                  Créer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowVendorForm(false)}
                  className="text-zinc-400 hover:text-white">
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {/* Vendor list */}
          {!vendors || vendors.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-4">Aucun vendeur enregistré</p>
          ) : (
            <div className="space-y-2">
              {vendors.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
                  <div>
                    <p className="text-white text-sm font-medium">{v.name}</p>
                    <p className="text-zinc-400 text-xs">{v.location ?? "—"} {v.phone ? `· ${v.phone}` : ""}</p>
                  </div>
                  <Badge variant={v.status === "active" ? "default" : "secondary"} className="text-xs">
                    {v.status === "active" ? "Actif" : "Inactif"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
