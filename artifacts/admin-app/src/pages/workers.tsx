import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Eye, EyeOff, Copy, Check, AlertCircle, MapPin, Phone, X, Loader2, KeyRound, Pencil, Trash2 } from "lucide-react";
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
  plainPassword: string | null;
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

function EditModal({ worker, onClose, onSaved }: { worker: Worker; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    vendorName: worker.vendorName,
    location:   worker.vendorLocation,
    phone:      worker.vendorPhone ?? "",
    username:   worker.username,
    email:      worker.email,
    password:   "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (form.vendorName !== worker.vendorName) body.vendorName = form.vendorName;
      if (form.location   !== worker.vendorLocation) body.location = form.location;
      if (form.phone      !== (worker.vendorPhone ?? "")) body.phone = form.phone;
      if (form.username   !== worker.username) body.username = form.username;
      if (form.email      !== worker.email)    body.email    = form.email;
      if (form.password)                       body.password = form.password;

      const res = await fetch(`/api/admin/workers/${worker.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      setSuccess(true);
      setTimeout(() => { onSaved(); onClose(); }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold">Modifier le vendeur</h3>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={(e) => { void handleSave(e); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom du point de vente</label>
              <input value={form.vendorName} onChange={(e) => setForm(f => ({ ...f, vendorName: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Localisation</label>
              <input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Téléphone</label>
              <input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom d'utilisateur</label>
              <input value={form.username} onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background text-sm font-mono outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nouveau mot de passe <span className="text-zinc-500 normal-case font-normal">(laisser vide = inchangé)</span></label>
              <input type="text" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Nouveau mot de passe…"
                className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background text-sm font-mono outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-sm text-emerald-500 bg-emerald-500/10 rounded-lg px-3 py-2">
              <Check className="w-4 h-4 shrink-0" />Modifications enregistrées !
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border font-semibold text-sm">Annuler</button>
            <button type="submit" disabled={saving || success}
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {success ? "Enregistré ✓" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CredentialsModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const [showPwd, setShowPwd] = useState(false);
  const pwd = worker.plainPassword ?? "—";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold">Identifiants vendeur</h3>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          {/* Vendor name */}
          <div className="rounded-xl bg-muted/50 px-4 py-3">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Vendeur</p>
            <p className="font-bold">{worker.vendorName}</p>
            <p className="text-xs text-muted-foreground">{worker.vendorLocation}</p>
          </div>

          {/* Username */}
          <div className="rounded-xl bg-muted/50 px-4 py-3">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Nom d'utilisateur</p>
            <div className="flex items-center">
              <span className="font-mono font-bold">{worker.username}</span>
              <CopyButton value={worker.username} />
            </div>
          </div>

          {/* Email */}
          <div className="rounded-xl bg-muted/50 px-4 py-3">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Email</p>
            <div className="flex items-center">
              <span className="font-mono text-sm">{worker.email}</span>
              <CopyButton value={worker.email} />
            </div>
          </div>

          {/* Password */}
          <div className="rounded-xl bg-muted/50 px-4 py-3">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Mot de passe</p>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold tracking-wider text-base">
                {showPwd ? pwd : "•".repeat(Math.max(8, pwd.length))}
              </span>
              {worker.plainPassword && (
                <>
                  <button onClick={() => setShowPwd(!showPwd)} className="text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <CopyButton value={pwd} />
                </>
              )}
              {!worker.plainPassword && (
                <span className="text-xs text-muted-foreground italic">(créé avant cette version)</span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

export default function Workers() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newWorker, setNewWorker] = useState<CreatedWorker | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [credWorker, setCredWorker] = useState<Worker | null>(null);
  const [editWorker, setEditWorker] = useState<Worker | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Worker | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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

  const deleteMutation = useMutation({
    mutationFn: async (vendorId: number) => {
      const r = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Erreur inconnue");
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["/api/admin/workers"] });
      setDeleteConfirm(null);
      setDeleteError(null);
    },
    onError: (e: Error) => setDeleteError(e.message),
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

  const q = search.toLowerCase().trim();
  const filtered = q
    ? workers.filter(w =>
        w.vendorName.toLowerCase().includes(q) ||
        w.email.toLowerCase().includes(q) ||
        w.username.toLowerCase().includes(q) ||
        (w.vendorLocation ?? "").toLowerCase().includes(q)
      )
    : workers;

  return (
    <div className="space-y-6">
      {credWorker && <CredentialsModal worker={credWorker} onClose={() => setCredWorker(null)} />}
      {editWorker && <EditModal worker={editWorker} onClose={() => setEditWorker(null)} onSaved={() => void qc.invalidateQueries({ queryKey: ["/api/admin/workers"] })} />}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Supprimer ce vendeur</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Action irréversible</p>
                </div>
              </div>
              <button onClick={() => { setDeleteConfirm(null); setDeleteError(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm mb-1">
              Supprimer <span className="font-bold">{deleteConfirm.vendorName}</span> (<span className="font-mono text-xs">{deleteConfirm.username}</span>) ?
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Le compte login sera supprimé définitivement. Les tickets non-écoulés seront annulés automatiquement.
            </p>
            {deleteError && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 mb-4 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}
                className="flex-1 py-2.5 rounded-xl border font-semibold text-sm"
              >Annuler</button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.vendorId)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-sm font-bold text-white flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher par nom, email ou username…"
        className="w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/40"
      />

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
                <p className="text-xs text-muted-foreground mb-1 font-bold uppercase tracking-wider">Mot de passe</p>
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
                <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5 space-y-1">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                  {(formError.includes("déjà pris") || formError.includes("déjà associé")) && (
                    <p className="pl-6 text-xs text-destructive/80">
                      👉 Fermez ce formulaire et cherchez le compte dans la liste ci-dessous pour modifier le mot de passe.
                    </p>
                  )}
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
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
            <Users className="w-8 h-8" />
            <p className="font-semibold">Aucun résultat pour « {search} »</p>
            <p className="text-sm">Essayez avec l'email complet ou le nom du point de vente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((w) => (
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
              <CardContent className="space-y-3">
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
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditWorker(w)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-700/50 text-zinc-300 font-bold text-xs hover:bg-zinc-700 transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      Modifier
                    </button>
                    <button
                      onClick={() => setCredWorker(w)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20 transition-colors"
                    >
                      <KeyRound className="w-3 h-3" />
                      Identifiants
                    </button>
                    <button
                      onClick={() => { setDeleteError(null); setDeleteConfirm(w); }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 font-bold text-xs hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Supprimer
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
