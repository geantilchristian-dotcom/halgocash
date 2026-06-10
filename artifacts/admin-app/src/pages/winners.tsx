import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Leader {
  rank: number;
  clerkId: string;
  playerId: string;
  totalWinnings: number;
  winningTickets: number;
  bestPrize: number;
}

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".");
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
      style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", boxShadow: "0 0 16px rgba(245,158,11,0.5)" }}>
      <Trophy className="w-5 h-5 text-white" />
    </div>
  );
  if (rank === 2) return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
      style={{ background: "linear-gradient(135deg,#94a3b8,#64748b)", boxShadow: "0 0 12px rgba(148,163,184,0.4)" }}>
      <Medal className="w-5 h-5 text-white" />
    </div>
  );
  if (rank === 3) return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
      style={{ background: "linear-gradient(135deg,#b45309,#92400e)", boxShadow: "0 0 12px rgba(180,83,9,0.4)" }}>
      <Medal className="w-5 h-5 text-white" />
    </div>
  );
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-zinc-800 border border-zinc-700">
      <span className="text-zinc-400 font-bold text-sm">{rank}</span>
    </div>
  );
}

function PodiumCard({ leader }: { leader: Leader }) {
  const isGold   = leader.rank === 1;
  const isSilver = leader.rank === 2;
  const isBronze = leader.rank === 3;
  const borderColor = isGold ? "rgba(245,158,11,0.5)" : isSilver ? "rgba(148,163,184,0.4)" : "rgba(180,83,9,0.4)";
  const glowColor   = isGold ? "rgba(245,158,11,0.15)" : isSilver ? "rgba(148,163,184,0.1)" : "rgba(180,83,9,0.1)";
  const amtColor    = isGold ? "text-yellow-400" : isSilver ? "text-zinc-300" : "text-amber-700";

  return (
    <Card className={`border ${isGold ? "border-yellow-700/50 bg-yellow-950/20" : isSilver ? "border-zinc-600/50 bg-zinc-800/30" : "border-amber-900/50 bg-amber-950/10"}`}
      style={{ boxShadow: `0 0 24px ${glowColor}` }}>
      <CardContent className="pt-5 pb-5 flex flex-col items-center gap-3 text-center">
        <RankBadge rank={leader.rank} />
        <div>
          <p className="font-mono font-black text-white text-lg tracking-wider">{leader.playerId}</p>
          <p className={`font-black text-2xl mt-1 ${amtColor}`}>{formatFC(leader.totalWinnings)} <span className="text-base font-bold">FC</span></p>
        </div>
        <div className="flex gap-4 text-xs">
          <div className="text-center">
            <p className="text-zinc-500 uppercase tracking-wider">Tickets</p>
            <p className="font-bold text-zinc-300">{leader.winningTickets}</p>
          </div>
          <div className="text-center">
            <p className="text-zinc-500 uppercase tracking-wider">Meilleur gain</p>
            <p className="font-bold text-zinc-300">{formatFC(leader.bestPrize)} FC</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WinnersPage() {
  const { data: leaders = [], isLoading } = useQuery<Leader[]>({
    queryKey: ["/api/admin/winners/leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/admin/winners/leaderboard", { credentials: "include" });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const top3   = leaders.slice(0, 3);
  const rest   = leaders.slice(3);
  const total  = leaders.reduce((s, l) => s + l.totalWinnings, 0);
  const tickets = leaders.reduce((s, l) => s + l.winningTickets, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 text-yellow-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Classement des gagnants</h1>
          <p className="text-zinc-400 text-sm">Classement par gains cumulés</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-4">
            <p className="text-zinc-400 text-xs uppercase tracking-wider">Gagnants</p>
            <p className="text-2xl font-bold text-white mt-1">{leaders.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-4">
            <p className="text-zinc-400 text-xs uppercase tracking-wider">Total distribué</p>
            <p className="text-xl font-bold text-yellow-400 mt-1">{formatFC(total)} FC</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-4">
            <p className="text-zinc-400 text-xs uppercase tracking-wider">Tickets gagnants</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{tickets}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-zinc-500">Chargement du classement…</div>
      ) : leaders.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Aucun gagnant pour l'instant</p>
          <p className="text-sm mt-1">Le classement se remplira dès que des tickets gagnants seront activés</p>
        </div>
      ) : (
        <>
          {/* Podium top 3 */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Silver on left (if 3), Gold center, Bronze right */}
              {top3.length === 3 ? [top3[1]!, top3[0]!, top3[2]!].map(l => <PodiumCard key={l.rank} leader={l} />) :
               top3.map(l => <PodiumCard key={l.rank} leader={l} />)}
            </div>
          )}

          {/* Rest of ranking */}
          {rest.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left px-4 py-3 text-zinc-400 font-medium text-xs uppercase tracking-wider w-16">Rang</th>
                      <th className="text-left px-4 py-3 text-zinc-400 font-medium text-xs uppercase tracking-wider">ID Joueur</th>
                      <th className="text-right px-4 py-3 text-zinc-400 font-medium text-xs uppercase tracking-wider">Gains totaux</th>
                      <th className="text-center px-4 py-3 text-zinc-400 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Tickets gagnants</th>
                      <th className="text-right px-4 py-3 text-zinc-400 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Meilleur gain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((l) => (
                      <tr key={l.rank} className="border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <RankBadge rank={l.rank} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-white">{l.playerId}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-yellow-400">{formatFC(l.totalWinnings)} FC</span>
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <span className="text-zinc-300 font-semibold">{l.winningTickets}</span>
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <span className="text-zinc-400">{formatFC(l.bestPrize)} FC</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
