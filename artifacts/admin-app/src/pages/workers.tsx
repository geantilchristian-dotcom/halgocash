import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Eye, EyeOff, Copy, Check, AlertCircle, MapPin, Phone, Ticket, TrendingUp, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".");
}

interface Worker {
  userId: number;
  username: string;
  email: string;
  isSuspended: boolean;
  vendorId: number;
  vendorName: string;
  vendorLocation: string;
  vendorPhone: string | null;
  vendorStatus: string;
  totalTickets: number;
  totalScratched: number;
  totalRevenue: number;
  createdAt: string;
}

interface CreatedWorker extends Worker {
  password: string;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function Workers() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newWorker, setNewWorker] = useState<CreatedWorker | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({ vendorName: "", location: "", phone: "", username: "", email: "", password: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: workers = [], isLoading } = useQuery<Worker[]>({
    queryKey: ["/api/admin/workers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/workers", { credentials: "include" });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/admin/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vendorName: data.vendorName, location: data.location, phone: data.phone || undefined, username: data.username, email: data.email, password: data.password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      return json as CreatedWorker;
    },
    onSuccess: (data) => {
      setNewWorker(data);
      setShowCreate(false);
      setForm({ vendorName: "", location: "", phone: "", username: "", email: "", password: "" });
      void qc.invalidateQueries({ queryKey: ["/api/admin/workers"] });
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.vendorName || !form.location || !form.username || !form.email || !form.password) {
      setFormError("Tous les champs obligatoires doivent être remplis");
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Annuaire Vendeurs</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm transition-all hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Nouveau vendeur
        </button>
      </div>

      {/* Credentials card after creation */}
      {newWorker && (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 text-green-600 font-bold">
                <Check className="w-5 h-5" />
                Compte créé — Communiquez ces identifiants au vendeur
              </div>
              <button onClick={() => setNewWorker(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-background rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1 font-bold uppercase tracking-wider">Vendeur</p>
                <p className="font-bold">{newWorker.vendorName}</p>
                <p className="text-muted-foreground text-xs">{newWorker.vendorLocation}</p>
              </div>
              <div className="bg-background rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1 font-bold uppercase tracking-wider">Identifiant</p>
                <div className="flex items-center">
                  <span className="font-mono font-bold">{newWorker.username}</span>
                  <CopyButton value={newWorker.username} />
                </div>
                <div className="flex items-center mt-1">
                  <span className="font-mono text-xs text-muted-foreground">{newWorker.email}</span>
                  <CopyButton value={newWorker.email} />
                </div>
              </div>
              <div className="bg-background rounded-lg p-3 col-span-2">
                <p className="text-xs text-muted-foreground mb-1 font-bold uppercase tracking-wider">Mot de passe (affiché une seule fois)</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-lg tracking-wider">
                    {showPwd ? newWorker.password : "•".repeat(newWorker.password.length)}
                  </span>
                  <button onClick={() => setShowPwd(!showPwd)} className="text-muted-foreground">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <CopyButton value={newWorker.password} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create form modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">Nouveau vendeur</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom du point de vente *</label>
                  <input value={form.vendorName} onChange={(e) => setForm(f => ({ ...f, vendorName: e.target.value }))}
                    placeholder="Ex: Boutique Lemba" className="w-full mt-1 px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Localisation *</label>
                  <input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Ex: Kinshasa, Lemba" className="w-full mt-1 px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Téléphone</label>
                  <input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+243 8XX XXX XXXX" className="w-full mt-1 px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom d'utilisateur *</label>
                  <input value={form.username} onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="vendeur_lemba" className="w-full mt-1 px-3 py-2.5 rounded-lg border text-sm font-mono outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mot de passe *</label>
                  <input type="text" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Halgo@2024!" className="w-full mt-1 px-3 py-2.5 rounded-lg border text-sm font-mono outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="vendeur@halgo.cd" className="w-full mt-1 px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              {formError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />{formError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 rounded-lg border font-semibold text-sm">Annuler</button>
                <button type="submit" disabled={createMutation.isPending}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Créer le compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Workers list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : workers.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Users className="w-10 h-10" />
            <p className="font-semibold">Aucun vendeur enregistré</p>
            <p className="text-sm">Créez votre premier compte vendeur avec le bouton ci-dessus.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workers.map((w) => (
            <Card key={w.userId} className={w.isSuspended ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{w.vendorName}</CardTitle>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="w-3 h-3" />{w.vendorLocation}
                    </div>
                    {w.vendorPhone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Phone className="w-3 h-3" />{w.vendorPhone}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={w.vendorStatus === "active" ? "default" : "secondary"}>
                      {w.vendorStatus === "active" ? "Actif" : "Inactif"}
                    </Badge>
                    {w.isSuspended && <Badge variant="destructive">Suspendu</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/40 rounded-lg py-2">
                    <p className="text-xs text-muted-foreground">Tickets</p>
                    <p className="font-bold text-sm">{w.totalTickets}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg py-2">
                    <p className="text-xs text-muted-foreground">Grattés</p>
                    <p className="font-bold text-sm">{w.totalScratched}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg py-2">
                    <p className="text-xs text-muted-foreground">Revenus</p>
                    <p className="font-bold text-sm">{formatFC(w.totalRevenue)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border">
                  <div className="flex items-center gap-1 font-mono">
                    <span className="font-semibold text-foreground">{w.username}</span>
                    <CopyButton value={w.username} />
                  </div>
                  <span>Depuis {new Date(w.createdAt).toLocaleDateString("fr-FR")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
