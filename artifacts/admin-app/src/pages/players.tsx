import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users2, Search, Star, Award, Shield } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import PlayerDetailDrawer from "@/components/player-detail-drawer";

interface Player {
  clerkId: string;
  playerId: string;
  referralCode: string;
  referredByCode: string | null;
  referralCount: number;
  referralLevel: string;
  referralTickets: number;
  activatedTickets: number;
  totalWinnings: number;
  createdAt: string;
}

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".");
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const LEVEL_CONFIG: Record<string, { color: string; bg: string; icon: typeof Star }> = {
  "Débutant": { color: "text-zinc-400",   bg: "bg-zinc-800/60 border-zinc-700",       icon: Star  },
  "Bronze":   { color: "text-amber-600",  bg: "bg-amber-900/20 border-amber-800/40",  icon: Award },
  "Argent":   { color: "text-zinc-300",   bg: "bg-zinc-700/30 border-zinc-600/40",    icon: Award },
  "Or":       { color: "text-yellow-400", bg: "bg-yellow-900/20 border-yellow-700/40", icon: Award },
  "Platine":  { color: "text-sky-400",    bg: "bg-sky-900/20 border-sky-700/40",      icon: Shield },
};

function LevelBadge({ level, count }: { level: string; count: number }) {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG["Débutant"]!;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {level}
      {count > 0 && <span className="opacity-70">· {count}</span>}
    </span>
  );
}

export default function PlayersPage() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [selectedPlayer, setSelectedPlayer] = useState<{ clerkId: string; displayId: string } | null>(null);

  const { data: players = [], isLoading } = useQuery<Player[]>({
    queryKey: ["/api/admin/players"],
    queryFn: async () => {
      const res = await fetch("/api/admin/players", { credentials: "include" });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const levels = ["Débutant", "Bronze", "Argent", "Or", "Platine"];
  const filtered = players.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.playerId.toLowerCase().includes(q) || p.referralCode.toLowerCase().includes(q);
    const matchLevel = levelFilter === "all" || p.referralLevel === levelFilter;
    return matchSearch && matchLevel;
  });

  const totalWinnings = players.reduce((s, p) => s + p.totalWinnings, 0);
  const totalTickets  = players.reduce((s, p) => s + p.activatedTickets, 0);
  const levelCounts   = levels.reduce<Record<string, number>>((acc, l) => {
    acc[l] = players.filter((p) => p.referralLevel === l).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users2 className="w-6 h-6 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Joueurs inscrits</h1>
          <p className="text-zinc-400 text-sm">Cliquez sur un joueur pour voir son profil complet</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total joueurs",    value: players.length,               color: "text-white" },
          { label: "Gains distribués", value: formatFC(totalWinnings) + " FC", color: "text-yellow-400" },
          { label: "Tickets grattés",  value: totalTickets,                 color: "text-emerald-400" },
          { label: "Parrains actifs",  value: players.filter(p => p.referralCount > 0).length, color: "text-indigo-400" },
        ].map(s => (
          <Card key={s.label} className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-4 pb-4">
              <p className="text-zinc-400 text-xs uppercase tracking-wider">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="Rechercher par ID joueur…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setLevelFilter("all")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${levelFilter === "all" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
              >
                Tous ({players.length})
              </button>
              {levels.map((l) => {
                const cfg = LEVEL_CONFIG[l]!;
                const Icon = cfg.icon;
                return (
                  <button
                    key={l}
                    onClick={() => setLevelFilter(l)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${levelFilter === l ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                  >
                    <Icon className="w-3 h-3" />
                    {l} ({levelCounts[l] ?? 0})
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-zinc-500">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">Aucun joueur trouvé</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">ID Joueur</TableHead>
                  <TableHead className="text-zinc-400">Niveau parrainage</TableHead>
                  <TableHead className="text-zinc-400 text-center">Filleuls</TableHead>
                  <TableHead className="text-zinc-400 text-center">Billets reçus</TableHead>
                  <TableHead className="text-zinc-400 text-center">Tickets grattés</TableHead>
                  <TableHead className="text-zinc-400 text-right">Gains totaux</TableHead>
                  <TableHead className="text-zinc-400">Inscrit le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow
                    key={p.clerkId}
                    className="border-zinc-800 hover:bg-zinc-800/60 cursor-pointer transition-colors"
                    onClick={() => setSelectedPlayer({ clerkId: p.clerkId, displayId: p.playerId })}
                  >
                    <TableCell>
                      <div>
                        <span className="font-mono font-bold text-white text-sm">{p.playerId}</span>
                        {p.referredByCode && (
                          <p className="text-zinc-500 text-xs mt-0.5">
                            Parrainé par: <span className="font-mono">{p.referredByCode.slice(0,3)+"-"+p.referredByCode.slice(3)}</span>
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <LevelBadge level={p.referralLevel} count={p.referralCount} />
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-bold text-indigo-300">{p.referralCount}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={p.referralTickets > 0 ? "font-bold text-emerald-400" : "text-zinc-500"}>{p.referralTickets}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-bold text-zinc-300">{p.activatedTickets}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.totalWinnings > 0 ? (
                        <span className="font-bold text-yellow-400">{formatFC(p.totalWinnings)} FC</span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-zinc-400 text-xs">{formatDate(p.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Player detail drawer */}
      {selectedPlayer && (
        <PlayerDetailDrawer
          open={!!selectedPlayer}
          clerkId={selectedPlayer.clerkId}
          displayId={selectedPlayer.displayId}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
