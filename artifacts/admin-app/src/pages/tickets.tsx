import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, Trophy, Ticket, ChevronRight, Layers, BarChart2, RefreshCw, CheckCircle2, XCircle, Clock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Batch {
  series: string;
  generatedAt: string;
  total: number;
  available: number;
  scratched: number;
  winners: number;
}

interface TicketRow {
  id: number;
  code: string;
  status: string;
  price: number;
  series: string;
  isWinner: boolean;
  prizeAmount: number | null;
  registeredAt: string | null;
  createdAt: string;
}

const PRIZE_LABEL: Record<string, string> = {};
function prizeLabel(amount: number | null): string {
  if (!amount) return "Perdant";
  if (amount >= 50000) return "Super Gagnant";
  if (amount >= 25000) return "Très Grand Gagnant";
  if (amount >= 10000) return "Grand Gagnant";
  if (amount >= 5000)  return "Gagnant";
  return "Petit Gagnant";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return formatDate(iso);
}

async function apiFetch<T>(url: string, fallback: T): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) return fallback;
  return res.json();
}

export default function Tickets() {
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "available" | "scratched" | "winners">("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (series: string) => {
      const res = await fetch(`/api/admin/batches/${encodeURIComponent(series)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la suppression");
      return data as { deleted: number };
    },
    onSuccess: (_data, series) => {
      if (selectedSeries === series) setSelectedSeries(null);
      setDeleteConfirm(null);
      setDeleteError(null);
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/batches"] });
    },
    onError: (err: Error) => {
      setDeleteError(err.message);
      setDeleteConfirm(null);
    },
  });

  const { data: rawBatches, isFetching: loadingBatches, refetch: refetchBatches } = useQuery<Batch[]>({
    queryKey: ["/api/admin/batches"],
    queryFn: () => apiFetch<Batch[]>("/api/admin/batches", []),
    refetchInterval: 10_000,
  });
  const batches: Batch[] = Array.isArray(rawBatches) ? rawBatches : [];

  const { data: rawTicketRows, isFetching: loadingTickets } = useQuery<TicketRow[]>({
    queryKey: ["/api/admin/batches", selectedSeries],
    queryFn: () => selectedSeries ? apiFetch<TicketRow[]>(`/api/admin/batches/${encodeURIComponent(selectedSeries)}`, []) : Promise.resolve([]),
    enabled: !!selectedSeries,
    refetchInterval: 5_000,
  });
  const ticketRows: TicketRow[] = Array.isArray(rawTicketRows) ? rawTicketRows : [];

  const activeBatch = batches.find((b) => b.series === selectedSeries);

  const filtered = ticketRows.filter((t) => {
    if (filterStatus === "available") return !t.registeredAt;
    if (filterStatus === "scratched") return !!t.registeredAt && !t.isWinner;
    if (filterStatus === "winners") return !!t.registeredAt && t.isWinner;
    return true;
  });

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)] min-h-0">

      {/* Left panel — batches list */}
      <div className="w-72 shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span className="text-white font-semibold text-sm">Lots générés</span>
            <span className="text-xs text-zinc-500">({batches.length})</span>
          </div>
          <button onClick={() => refetchBatches()} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <RefreshCw className={cn("w-3.5 h-3.5", loadingBatches && "animate-spin text-indigo-400")} />
          </button>
        </div>

        {batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-600 text-sm text-center">
            <Ticket className="w-8 h-8 mb-2 opacity-30" />
            Aucun lot généré
          </div>
        ) : (
          <>
          {deleteError && (
            <div className="px-3 py-2 rounded-lg bg-red-900/30 border border-red-700/40 text-red-400 text-xs">
              {deleteError}
              <button className="ml-2 underline" onClick={() => setDeleteError(null)}>OK</button>
            </div>
          )}
          <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
            {batches.map((b) => {
              const pct = b.total > 0 ? Math.round((b.scratched / b.total) * 100) : 0;
              const isActive = selectedSeries === b.series;
              const isConfirming = deleteConfirm === b.series;
              const isDeleting = deleteMutation.isPending && deleteMutation.variables === b.series;
              return (
                <div
                  key={b.series}
                  className={cn(
                    "rounded-lg border transition-all",
                    isActive
                      ? "bg-indigo-600/20 border-indigo-500/50 shadow-sm"
                      : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                  )}
                >
                  <button
                    onClick={() => { setSelectedSeries(b.series); setDeleteConfirm(null); }}
                    className="w-full text-left px-3 pt-2.5 pb-1"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-mono font-bold text-sm">Série {b.series}</span>
                      <ChevronRight className={cn("w-3.5 h-3.5 text-zinc-500 transition-transform", isActive && "rotate-90 text-indigo-400")} />
                    </div>
                    <p className="text-zinc-500 text-xs mb-2">{formatDate(b.generatedAt)}</p>
                    <div className="flex items-center gap-2 text-xs mb-2">
                      <span className="text-zinc-400">{b.total.toLocaleString("fr-FR")} billets</span>
                      {b.winners > 0 && (
                        <span className="text-amber-400 font-medium">· {b.winners} gagnant{b.winners > 1 ? "s" : ""}</span>
                      )}
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-zinc-600 text-[10px] mt-1 mb-1">{pct}% grattés</p>
                  </button>

                  {/* Delete row */}
                  <div className="px-3 pb-2 flex items-center justify-end gap-2">
                    {isConfirming ? (
                      <>
                        <span className="text-red-400 text-[10px] flex-1">Supprimer ce lot ?</span>
                        <button
                          onClick={() => deleteMutation.mutate(b.series)}
                          disabled={isDeleting}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition-colors"
                        >
                          {isDeleting ? "..." : "OUI"}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(b.series); setDeleteError(null); }}
                        className="flex items-center gap-1 text-zinc-600 hover:text-red-400 transition-colors text-[10px]"
                        title="Supprimer ce lot"
                      >
                        <Trash2 className="w-3 h-3" />
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>

      {/* Right panel — ticket list */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {!selectedSeries ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600">
            <BarChart2 className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">Sélectionnez un lot pour voir ses billets</p>
          </div>
        ) : (
          <>
            {/* Batch header stats */}
            {activeBatch && (
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total", value: activeBatch.total.toLocaleString("fr-FR"), icon: Ticket, color: "text-zinc-300" },
                  { label: "Disponibles", value: activeBatch.available.toLocaleString("fr-FR"), icon: Clock, color: "text-blue-400" },
                  { label: "Grattés", value: activeBatch.scratched.toLocaleString("fr-FR"), icon: CheckCircle2, color: "text-purple-400" },
                  { label: "Gagnants", value: activeBatch.winners.toLocaleString("fr-FR"), icon: Trophy, color: "text-amber-400" },
                ].map((s) => (
                  <Card key={s.label} className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-3 flex items-center gap-2">
                      <s.icon className={cn("w-5 h-5 shrink-0", s.color)} />
                      <div>
                        <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
                        <p className="text-zinc-500 text-xs">{s.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Filter tabs */}
            <div className="flex items-center gap-1">
              {(["all", "available", "scratched", "winners"] as const).map((f) => {
                const labels = { all: "Tous", available: "Disponibles", scratched: "Grattés perdants", winners: "Gagnants" };
                return (
                  <button
                    key={f}
                    onClick={() => setFilterStatus(f)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      filterStatus === f
                        ? "bg-indigo-600 text-white"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    )}
                  >
                    {labels[f]}
                  </button>
                );
              })}
              <div className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500">
                <RefreshCw className={cn("w-3 h-3", loadingTickets && "animate-spin text-indigo-400")} />
                {filtered.length.toLocaleString("fr-FR")} billet{filtered.length > 1 ? "s" : ""}
              </div>
            </div>

            {/* Ticket table */}
            <Card className="bg-zinc-900 border-zinc-800 flex-1 overflow-hidden">
              <div className="overflow-y-auto h-full">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
                    <XCircle className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">Aucun billet dans ce filtre</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 z-10">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">#</th>
                        <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Code</th>
                        <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Statut</th>
                        <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Résultat</th>
                        <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Gratté le</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {filtered.map((t, i) => (
                        <tr key={t.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-2.5 text-zinc-600 text-xs">{i + 1}</td>
                          <td className="px-4 py-2.5 font-mono text-white text-sm tracking-wider">{t.code}</td>
                          <td className="px-4 py-2.5">
                            {!t.registeredAt ? (
                              <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10 text-[10px]">
                                Disponible
                              </Badge>
                            ) : t.isWinner ? (
                              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                                🏆 Gagnant
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-zinc-500 border-zinc-700 text-[10px]">
                                Gratté
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {t.registeredAt ? (
                              t.isWinner ? (
                                <span className="text-amber-400 text-xs font-semibold">
                                  {prizeLabel(t.prizeAmount)} — {formatCurrency(t.prizeAmount ?? 0)}
                                </span>
                              ) : (
                                <span className="text-zinc-600 text-xs">Perdant</span>
                              )
                            ) : (
                              <span className="text-zinc-700 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-zinc-500 text-xs">
                            {t.registeredAt ? relativeTime(t.registeredAt) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
