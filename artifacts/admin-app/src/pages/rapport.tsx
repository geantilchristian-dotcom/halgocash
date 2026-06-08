import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, User, Ticket, Trophy, TrendingDown, Clock, CheckCircle2, XCircle, ChevronRight, BarChart2, Search, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface Account {
  clerkId: string;
  name: string;
  totalTickets: number;
  winnerTickets: number;
  totalWithdrawals: number;
  paidAmount: number;
  pendingAmount: number;
  lastActivity: string | null;
}

interface Withdrawal {
  id: number;
  clerkId: string;
  clerkName: string;
  amount: string;
  token: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

interface ScannedTicket {
  id: number;
  code: string;
  series: string;
  isWinner: boolean;
  prizeAmount: string | null;
  registeredAt: string;
}

interface AccountDetail {
  clerkId: string;
  name: string;
  withdrawals: Withdrawal[];
  tickets: ScannedTicket[];
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) throw new Error("Erreur réseau");
  return res.json() as Promise<T>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
      <CheckCircle2 className="w-3 h-3" /> Payé
    </span>
  );
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
      <Clock className="w-3 h-3" /> En attente
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
      <XCircle className="w-3 h-3" /> {status}
    </span>
  );
}

function AccountDetailView({ account, onBack }: { account: Account; onBack: () => void }) {
  const { data, isLoading } = useQuery<AccountDetail>({
    queryKey: ["/api/admin/rapport", account.clerkId],
    queryFn: () => apiFetch(`/api/admin/rapport/${account.clerkId}`),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
      </div>

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-700 flex items-center justify-center shrink-0">
          <User className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{account.name}</h2>
          <p className="text-zinc-400 text-sm font-mono">{account.clerkId}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-center">
          <p className="text-xs text-zinc-500 mb-1">Tickets scannés</p>
          <p className="text-xl font-black text-white">{account.totalTickets}</p>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-center">
          <p className="text-xs text-zinc-500 mb-1">Tickets gagnants</p>
          <p className="text-xl font-black text-amber-400">{account.winnerTickets}</p>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-center">
          <p className="text-xs text-zinc-500 mb-1">Retraits payés</p>
          <p className="text-lg font-black text-green-400">{formatFC(account.paidAmount)}</p>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-center">
          <p className="text-xs text-zinc-500 mb-1">En attente</p>
          <p className="text-lg font-black text-amber-400">{formatFC(account.pendingAmount)}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <>
          {/* Withdrawal history */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-indigo-400" />
                Mouvements de retrait
                <span className="ml-auto text-xs font-normal text-zinc-500">
                  {data?.withdrawals.length ?? 0} opération{(data?.withdrawals.length ?? 0) !== 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.withdrawals.length ? (
                <p className="text-zinc-500 text-sm text-center py-6">Aucun retrait pour ce compte</p>
              ) : (
                <div className="space-y-2">
                  {data.withdrawals.map((w) => (
                    <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={w.status} />
                          <span className="text-white font-bold text-sm">{formatFC(parseFloat(w.amount))}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-zinc-500 text-xs">Demandé : {formatDate(w.createdAt)}</span>
                          {w.paidAt && (
                            <span className="text-green-500/70 text-xs">Payé : {formatDate(w.paidAt)}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-zinc-600 text-[10px] font-mono ml-3 shrink-0">{w.token.slice(0, 8)}…</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scanned tickets */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Ticket className="w-4 h-4 text-zinc-400" />
                Tickets scannés
                <span className="ml-auto text-xs font-normal text-zinc-500">
                  {data?.tickets.length ?? 0} ticket{(data?.tickets.length ?? 0) !== 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.tickets.length ? (
                <p className="text-zinc-500 text-sm text-center py-6">Aucun ticket</p>
              ) : (
                <div className="space-y-1.5">
                  {data.tickets.map((t) => (
                    <div key={t.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${t.isWinner ? "bg-amber-950/30 border-amber-800/40" : "bg-zinc-800/30 border-zinc-700/40"}`}>
                      <div>
                        <span className="font-mono font-black text-sm text-white">{t.code}</span>
                        <span className="text-zinc-500 text-xs ml-2">· Série {t.series}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.isWinner ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <Trophy className="w-3 h-3" />
                            {t.prizeAmount ? formatFC(parseFloat(t.prizeAmount)) : "Gagnant"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-medium">Perdant</span>
                        )}
                        <span className="text-zinc-600 text-xs">{timeAgo(t.registeredAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function Rapport() {
  const [selected, setSelected] = useState<Account | null>(null);
  const [search, setSearch] = useState("");

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["/api/admin/rapport"],
    queryFn: () => apiFetch("/api/admin/rapport"),
    refetchInterval: 30_000,
  });

  if (selected) {
    return <AccountDetailView account={selected} onBack={() => setSelected(null)} />;
  }

  const filtered = accounts.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.clerkId.includes(search),
  );

  const totalAccounts = accounts.length;
  const totalScanned  = accounts.reduce((s, a) => s + a.totalTickets, 0);
  const totalPaid     = accounts.reduce((s, a) => s + a.paidAmount, 0);
  const totalPending  = accounts.reduce((s, a) => s + a.pendingAmount, 0);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        <BarChart2 className="w-6 h-6 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Rapport</h1>
          <p className="text-zinc-400 text-sm">Comptes joueurs et mouvements de retrait</p>
        </div>
      </div>

      {/* Summary */}
      {!isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
            <p className="text-xs text-zinc-500 mb-1">Comptes actifs</p>
            <p className="text-2xl font-black text-white">{totalAccounts}</p>
          </div>
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
            <p className="text-xs text-zinc-500 mb-1">Tickets scannés</p>
            <p className="text-2xl font-black text-white">{totalScanned.toLocaleString("fr-FR")}</p>
          </div>
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
            <p className="text-xs text-zinc-500 mb-1">Retraits payés</p>
            <p className="text-lg font-black text-green-400">{formatFC(totalPaid)}</p>
          </div>
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
            <p className="text-xs text-zinc-500 mb-1">En attente</p>
            <p className="text-lg font-black text-amber-400">{formatFC(totalPending)}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou code…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm placeholder:text-zinc-600 outline-none focus:border-indigo-600 transition-colors"
        />
      </div>

      {/* Account list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-zinc-500">
          <User className="w-10 h-10" />
          <p className="font-semibold">
            {search ? "Aucun résultat" : "Aucun compte enregistré"}
          </p>
          {!search && (
            <p className="text-sm text-zinc-600">Les comptes apparaissent dès qu'un joueur scanne son premier ticket.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((account) => (
            <button
              key={account.clerkId}
              onClick={() => setSelected(account)}
              className="w-full text-left rounded-xl bg-zinc-900 border border-zinc-800 p-4 hover:border-indigo-700 hover:bg-zinc-800/60 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 group-hover:bg-indigo-600/20 group-hover:border-indigo-700 transition-colors">
                  <User className="w-4 h-4 text-zinc-400 group-hover:text-indigo-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm truncate">{account.name}</span>
                    {account.winnerTickets > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        <Trophy className="w-2.5 h-2.5" />
                        {account.winnerTickets} lot{account.winnerTickets > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-500 text-xs font-mono mt-0.5">{account.clerkId}</p>
                </div>

                <div className="shrink-0 flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-white text-sm font-semibold">{account.totalTickets} ticket{account.totalTickets !== 1 ? "s" : ""}</p>
                    {account.totalWithdrawals > 0 ? (
                      <p className="text-xs text-zinc-500">{account.totalWithdrawals} retrait{account.totalWithdrawals !== 1 ? "s" : ""}</p>
                    ) : (
                      <p className="text-xs text-zinc-600">Aucun retrait</p>
                    )}
                  </div>
                  {account.pendingAmount > 0 && (
                    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] hidden md:inline-flex">
                      {formatFC(account.pendingAmount)} en attente
                    </Badge>
                  )}
                  {account.lastActivity && (
                    <p className="text-zinc-600 text-xs hidden lg:block">{timeAgo(account.lastActivity)}</p>
                  )}
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 transition-colors shrink-0" />
                </div>
              </div>

              {/* Mobile: second row */}
              <div className="flex items-center gap-3 mt-2 sm:hidden">
                <span className="text-zinc-400 text-xs">{account.totalTickets} tickets</span>
                {account.totalWithdrawals > 0 && (
                  <span className="text-zinc-500 text-xs">· {account.totalWithdrawals} retraits</span>
                )}
                {account.pendingAmount > 0 && (
                  <span className="text-amber-400 text-xs font-semibold ml-auto">{formatFC(account.pendingAmount)} en attente</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
