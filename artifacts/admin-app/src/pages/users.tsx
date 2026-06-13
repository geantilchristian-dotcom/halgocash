import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Users as UsersIcon, Search, ShieldOff, ShieldCheck, Globe, Clock, CalendarDays, Smartphone, SmartphoneNfc } from "lucide-react";

interface AdminUser {
  id: number;
  email: string;
  username: string;
  role: string;
  isSuspended: boolean;
  isOnline: boolean;
  hasDevice: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
}

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

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  vendor: "Vendeur",
  player: "Joueur",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-indigo-600/20 text-indigo-300 border-indigo-700",
  vendor: "bg-amber-600/20 text-amber-300 border-amber-700",
  player: "bg-emerald-600/20 text-emerald-300 border-emerald-700",
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiFetch("/api/admin/users"),
    refetchInterval: 30_000,
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, isSuspended }: { id: number; isSuspended: boolean }) =>
      apiFetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isSuspended }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Compte mis à jour" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const resetDeviceMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ resetDevice: true }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Appareil réinitialisé", description: "Le vendeur peut se reconnecter depuis n'importe quel appareil." });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const filtered = users.filter((u) => {
    const matchSearch =
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const online = users.filter((u) => u.isOnline).length;
  const suspended = users.filter((u) => u.isSuspended).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UsersIcon className="w-6 h-6 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Comptes utilisateurs</h1>
          <p className="text-zinc-400 text-sm">Gestion et surveillance de tous les comptes</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-4">
            <p className="text-zinc-400 text-xs uppercase tracking-wider">Total</p>
            <p className="text-2xl font-bold text-white mt-1">{users.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-4">
            <p className="text-zinc-400 text-xs uppercase tracking-wider">En ligne</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{online}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-4">
            <p className="text-zinc-400 text-xs uppercase tracking-wider">Suspendus</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{suspended}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="Rechercher par nom ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <div className="flex gap-2">
              {["all", "admin", "vendor", "player"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    roleFilter === r
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {r === "all" ? "Tous" : ROLE_LABELS[r] ?? r}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-zinc-500">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">Aucun compte trouvé</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Utilisateur</TableHead>
                  <TableHead className="text-zinc-400">Rôle</TableHead>
                  <TableHead className="text-zinc-400">
                    <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Inscription</span>
                  </TableHead>
                  <TableHead className="text-zinc-400">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Dernière connexion</span>
                  </TableHead>
                  <TableHead className="text-zinc-400">
                    <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />IP</span>
                  </TableHead>
                  <TableHead className="text-zinc-400">Statut</TableHead>
                  <TableHead className="text-zinc-400">
                    <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" />Appareil</span>
                  </TableHead>
                  <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id} className="border-zinc-800 hover:bg-zinc-800/40">
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${u.isOnline ? "bg-emerald-400" : "bg-zinc-600"}`}
                          />
                          <span className="text-white font-medium text-sm">{u.username}</span>
                        </div>
                        <p className="text-zinc-500 text-xs ml-4">{u.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${ROLE_COLORS[u.role] ?? "bg-zinc-700 text-zinc-300 border-zinc-600"}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-xs">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-zinc-400 text-xs">{formatDate(u.lastLoginAt)}</TableCell>
                    <TableCell className="text-zinc-500 text-xs font-mono">{u.lastLoginIp ?? "—"}</TableCell>
                    <TableCell>
                      {u.isSuspended ? (
                        <Badge variant="destructive" className="text-xs">Suspendu</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-emerald-700 text-emerald-400">Actif</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {(u.role === "vendor" || u.role === "admin") ? (
                        u.hasDevice ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                            <SmartphoneNfc className="w-3.5 h-3.5" />Enregistré
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <Smartphone className="w-3.5 h-3.5" />Aucun
                          </span>
                        )
                      ) : (
                        <span className="text-zinc-700 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {u.id !== me?.id && u.role !== "admin" && (
                          <Button
                            size="sm"
                            variant={u.isSuspended ? "outline" : "destructive"}
                            className={u.isSuspended ? "border-emerald-700 text-emerald-400 hover:bg-emerald-900/20 text-xs h-7" : "text-xs h-7"}
                            onClick={() => suspendMutation.mutate({ id: u.id, isSuspended: !u.isSuspended })}
                            disabled={suspendMutation.isPending}
                          >
                            {u.isSuspended ? (
                              <><ShieldCheck className="w-3 h-3 mr-1" />Réactiver</>
                            ) : (
                              <><ShieldOff className="w-3 h-3 mr-1" />Suspendre</>
                            )}
                          </Button>
                        )}
                        {(u.role === "vendor" || u.role === "admin") && u.hasDevice && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-700 text-amber-400 hover:bg-amber-900/20 text-xs h-7"
                            onClick={() => {
                              if (confirm(`Réinitialiser l'appareil de ${u.username} ? Le prochain login enregistrera un nouvel appareil.`)) {
                                resetDeviceMutation.mutate(u.id);
                              }
                            }}
                            disabled={resetDeviceMutation.isPending}
                          >
                            <Smartphone className="w-3 h-3 mr-1" />Reset
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
