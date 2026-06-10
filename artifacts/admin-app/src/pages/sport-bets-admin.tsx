import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trophy, RefreshCw, CheckCircle, XCircle, Clock, Loader2, TrendingUp } from "lucide-react";

interface SportBet {
  id: number;
  clerkId: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  betType: string;
  amount: string;
  odds: string;
  potentialWin: string;
  status: string;
  settledAt: string | null;
  createdAt: string;
  competition?: string;
}

interface SettleResult {
  ok: boolean;
  settled: number;
  errors: number;
  skipped: number;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "En attente", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: <Clock className="w-3.5 h-3.5" /> },
  won:     { label: "Gagné",      color: "text-green-400 bg-green-500/10 border-green-500/20", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  lost:    { label: "Perdu",      color: "text-red-400 bg-red-500/10 border-red-500/20",       icon: <XCircle className="w-3.5 h-3.5" /> },
};

const BET_TYPE: Record<string, string> = { home: "Victoire domicile", draw: "Match nul", away: "Victoire extérieur" };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".") + " FC";
}

export default function SportBetsAdmin() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "won" | "lost">("all");
  const [settleResult, setSettleResult] = useState<SettleResult | null>(null);

  const { data: bets = [], isLoading } = useQuery<SportBet[]>({
    queryKey: ["/api/admin/sport/bets", filter],
    queryFn: async () => {
      const url = filter === "all" ? "/api/admin/sport/bets" : `/api/admin/sport/bets?status=${filter}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Erreur chargement paris");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const settle = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/sport/settle", { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error("Erreur settlement");
      return r.json() as Promise<SettleResult>;
    },
    onSuccess: (res) => {
      setSettleResult(res);
      void qc.invalidateQueries({ queryKey: ["/api/admin/sport/bets"] });
    },
  });

  // Stats
  const total = bets.length;
  const pending = bets.filter(b => b.status === "pending").length;
  const won = bets.filter(b => b.status === "won").length;
  const totalWagered = bets.filter(b => b.status !== "cancelled").reduce((s, b) => s + parseFloat(b.amount), 0);
  const totalPaid = bets.filter(b => b.status === "won").reduce((s, b) => s + parseFloat(b.potentialWin), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-500/10">
            <Trophy className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Paris Sportifs</h1>
            <p className="text-sm text-white/40">Gestion et règlement des paris</p>
          </div>
        </div>
        <button
          onClick={() => settle.mutate()}
          disabled={settle.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#1a6b2f,#22a84a)", color: "#fff" }}
        >
          {settle.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
          Régler maintenant
        </button>
      </div>

      {/* Settlement result banner */}
      {settleResult && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
          settleResult.errors > 0 ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-green-500/10 border-green-500/20 text-green-400"
        }`}>
          <CheckCircle className="w-4 h-4 shrink-0" />
          {settleResult.settled} pari(s) réglé(s) · {settleResult.skipped} ignoré(s) · {settleResult.errors} erreur(s)
          <button onClick={() => setSettleResult(null)} className="ml-auto text-white/30 hover:text-white/60">✕</button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total paris", value: total, icon: <TrendingUp className="w-4 h-4" />, color: "#8DC63F" },
          { label: "En attente", value: pending, icon: <Clock className="w-4 h-4" />, color: "#f59e0b" },
          { label: "Gagnés",     value: won,     icon: <CheckCircle className="w-4 h-4" />, color: "#22c55e" },
          { label: "FC distribués", value: fFC(totalPaid), icon: <Trophy className="w-4 h-4" />, color: "#F5C518" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border p-4" style={{ background: "#0f1f12", borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2 mb-1" style={{ color: s.color }}>
              {s.icon}
              <span className="text-xs font-semibold uppercase tracking-wide">{s.label}</span>
            </div>
            <p className="text-xl font-black text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
        {(["all", "pending", "won", "lost"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all"
            style={{
              background: filter === f ? "#22a84a" : "transparent",
              color: filter === f ? "#fff" : "rgba(255,255,255,0.4)",
            }}
          >
            {{ all: "Tous", pending: "En attente", won: "Gagnés", lost: "Perdus" }[f]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden border" style={{ background: "#0f1f12", borderColor: "rgba(255,255,255,0.07)" }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-green-400" />
          </div>
        ) : bets.length === 0 ? (
          <div className="text-center py-16 text-white/30 text-sm">Aucun pari trouvé</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Match", "Mise", "Cote", "Gain potentiel", "Type", "Statut", "Date"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bets.map((bet) => {
                  const meta = STATUS_META[bet.status] ?? STATUS_META.pending;
                  return (
                    <tr key={bet.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white text-xs">{bet.homeTeam} vs {bet.awayTeam}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{fmt(bet.matchDate)}</p>
                      </td>
                      <td className="px-4 py-3 font-bold text-white">{fFC(parseFloat(bet.amount))}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: "#F5C518" }}>{parseFloat(bet.odds).toFixed(2)}×</td>
                      <td className="px-4 py-3 font-bold text-green-400">{fFC(parseFloat(bet.potentialWin))}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{BET_TYPE[bet.betType] ?? bet.betType}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${meta.color}`}>
                          {meta.icon}{meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{fmt(bet.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
        Règlement automatique toutes les heures · Paris TIMED et SCHEDULED acceptés · Winnings crédités en FC
      </p>
    </div>
  );
}
