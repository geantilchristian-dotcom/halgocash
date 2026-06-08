import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, Trophy, XCircle, Ticket, RefreshCw } from "lucide-react";

interface TicketItem {
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

const STATUS_FR: Record<string, string> = {
  available: "Disponible",
  sold: "Vendu",
  validated: "Validé",
  claimed: "Prix encaissé",
  expired: "Expiré",
};

function prizeLabel(amount: number | null): string {
  if (!amount) return "Perdant";
  if (amount >= 50000) return "Super Gagnant";
  if (amount >= 25000) return "Très Grand Gagnant";
  if (amount >= 10000) return "Grand Gagnant";
  if (amount >= 5000) return "Gagnant";
  return "Petit Gagnant";
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function fetchScratched(): Promise<TicketItem[]> {
  const res = await fetch("/api/tickets/scratched", { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

export default function Tickets() {
  const { data: tickets = [], dataUpdatedAt, isFetching } = useQuery<TicketItem[]>({
    queryKey: ["/api/tickets/scratched"],
    queryFn: fetchScratched,
    refetchInterval: 5_000,
  });

  const winners = tickets.filter((t) => t.isWinner);
  const totalPrizes = winners.reduce((acc, t) => acc + (t.prizeAmount ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-indigo-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Historique des billets grattés</h1>
            <p className="text-zinc-400 text-sm">Mise à jour automatique toutes les 5 secondes</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-indigo-400" : ""}`} />
          {dataUpdatedAt ? `Mis à jour ${relativeTime(new Date(dataUpdatedAt).toISOString())}` : ""}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-3">
            <Ticket className="w-8 h-8 text-indigo-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-white">{tickets.length}</p>
              <p className="text-xs text-zinc-400">Billets grattés</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-white">{winners.length}</p>
              <p className="text-xs text-zinc-400">Gagnants</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="w-8 h-8 text-zinc-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-white">{formatCurrency(totalPrizes)}</p>
              <p className="text-xs text-zinc-400">Total prix distribués</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live list */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <CardTitle className="text-sm text-zinc-300 font-medium">
              {tickets.length === 0 ? "Aucun billet gratté pour l'instant" : `${tickets.length} billet${tickets.length > 1 ? "s" : ""} — du plus récent au plus ancien`}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
              <Ticket className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Les billets grattés apparaîtront ici en temps réel</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {tickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40 transition-colors">
                  {/* Left: code + series + price */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-1.5 h-8 rounded-full shrink-0 ${t.isWinner ? "bg-amber-400" : "bg-zinc-600"}`} />
                    <div className="min-w-0">
                      <p className="text-white font-mono text-sm tracking-widest">{t.code}</p>
                      <p className="text-zinc-500 text-xs">
                        Série <span className="font-medium text-zinc-400">{t.series}</span>
                        {" · "}{formatCurrency(t.price)}
                        {" · "}{STATUS_FR[t.status] ?? t.status}
                      </p>
                    </div>
                  </div>

                  {/* Center: result badge */}
                  <div className="flex-1 flex justify-center px-2">
                    {t.isWinner ? (
                      <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold text-xs">
                        🏆 {prizeLabel(t.prizeAmount)} — {formatCurrency(t.prizeAmount ?? 0)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-zinc-500 border-zinc-700 text-xs">
                        Perdu
                      </Badge>
                    )}
                  </div>

                  {/* Right: date */}
                  <div className="text-xs text-zinc-500 shrink-0 text-right">
                    {t.registeredAt ? relativeTime(t.registeredAt) : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
