import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "../components/layout/app-layout";
import { ArrowLeft, User, TrendingDown, CheckCircle2, Clock, XCircle, ChevronRight, BarChart2, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".") + " FC";
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

interface Client {
  clerkId: string;
  name: string;
  totalWithdrawals: number;
  totalPaid: number;
  lastPaidAt: string | null;
}

interface Withdrawal {
  id: number;
  amount: string;
  status: string;
  token: string;
  paidAt: string | null;
  createdAt: string;
}

interface ClientDetail {
  clerkId: string;
  name: string;
  withdrawals: Withdrawal[];
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) throw new Error("Erreur réseau");
  return res.json() as Promise<T>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 border border-green-500/30">
      <CheckCircle2 className="w-3 h-3" /> Payé
    </span>
  );
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30">
      <Clock className="w-3 h-3" /> En attente
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 border border-red-500/30">
      <XCircle className="w-3 h-3" /> {status}
    </span>
  );
}

function ClientDetail({ client, onBack }: { client: Client; onBack: () => void }) {
  const { data, isLoading } = useQuery<ClientDetail>({
    queryKey: ["/api/vendor/rapport", client.clerkId],
    queryFn: () => apiFetch(`/api/vendor/rapport/${client.clerkId}`),
  });

  return (
    <AppLayout>
      <div className="space-y-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-black text-lg leading-none">{client.name}</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{client.clerkId}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Retraits payés</p>
            <p className="text-2xl font-black mt-0.5">{client.totalWithdrawals}</p>
          </div>
          <div className="rounded-xl bg-primary text-primary-foreground border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] font-bold uppercase opacity-70">Total payé</p>
            <p className="text-lg font-black mt-0.5">{formatFC(client.totalPaid)}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest mb-3 flex items-center gap-2">
            <TrendingDown className="w-3.5 h-3.5" /> Mouvements de retrait
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : !data?.withdrawals.length ? (
            <div className="text-center py-10 text-muted-foreground">
              <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Aucun mouvement</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={w.status} />
                      <span className="font-black text-base">{formatFC(parseFloat(w.amount))}</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs text-muted-foreground">Demandé : {formatDate(w.createdAt)}</p>
                      {w.paidAt && (
                        <p className="text-xs text-green-600 font-medium">Payé : {formatDate(w.paidAt)}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground">{w.token.slice(0, 8)}…</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function Rapport() {
  const [selected, setSelected] = useState<Client | null>(null);
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/vendor/rapport"],
    queryFn: () => apiFetch("/api/vendor/rapport"),
    refetchInterval: 30_000,
  });

  if (selected) {
    return <ClientDetail client={selected} onBack={() => setSelected(null)} />;
  }

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.clerkId.includes(search),
  );

  const totalClients = clients.length;
  const totalPaid    = clients.reduce((s, c) => s + c.totalPaid, 0);

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          <div>
            <h1 className="font-black text-xl uppercase tracking-tight">Rapport</h1>
            <p className="text-xs text-muted-foreground">Clients ayant reçu un paiement</p>
          </div>
        </div>

        {!isLoading && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Clients</p>
              <p className="text-2xl font-black">{totalClients}</p>
            </div>
            <div className="rounded-xl bg-primary text-primary-foreground border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-[10px] font-bold uppercase opacity-70">Total payé</p>
              <p className="text-lg font-black">{formatFC(totalPaid)}</p>
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-black bg-white text-sm outline-none focus:border-primary transition-colors"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <User className="w-10 h-10 opacity-30" />
            <p className="font-bold text-sm">
              {search ? "Aucun résultat" : "Aucun client pour le moment"}
            </p>
            {!search && (
              <p className="text-xs text-center max-w-48">
                Les clients apparaîtront ici quand vous aurez payé un retrait.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((client) => (
              <button
                key={client.clerkId}
                onClick={() => setSelected(client)}
                className="w-full text-left rounded-xl bg-white border-2 border-black p-3.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{client.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{client.clerkId}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-black text-sm">{formatFC(client.totalPaid)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {client.totalWithdrawals} retrait{client.totalWithdrawals !== 1 ? "s" : ""}
                      {client.lastPaidAt ? ` · ${timeAgo(client.lastPaidAt)}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
