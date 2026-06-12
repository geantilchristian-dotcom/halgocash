import { useState, useCallback } from "react";
import { useAuth } from "@/lib/clerk-compat";
import { useQuery } from "@tanstack/react-query";
import { Ticket, CheckCircle, X, Search, Filter, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";

interface PlayerTicket {
  id: number;
  code: string;
  isWinner: boolean;
  prizeAmount: string | null;
  series: string;
  registeredAt: string;
  price: string;
}

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".");
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TicketsPage() {
  const { getToken } = useAuth();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<"all" | "win" | "lose">("all");
  const [search, setSearch] = useState("");

  const authFetch = useCallback(async (url: string) => {
    const token = await getToken().catch(() => null);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { headers, credentials: "include" });
  }, [getToken]);

  const { data: tickets = [], isLoading } = useQuery<PlayerTicket[]>({
    queryKey: ["/api/auth/tickets"],
    queryFn: async () => {
      const res = await authFetch("/api/auth/tickets");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
  });

  const filtered = tickets.filter((t) => {
    if (filter === "win" && !t.isWinner) return false;
    if (filter === "lose" && t.isWinner) return false;
    if (search && !t.code.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalWon = tickets.filter(t => t.isWinner).reduce((s, t) => s + parseFloat(t.prizeAmount ?? "0"), 0);
  const winCount = tickets.filter(t => t.isWinner).length;

  return (
    <div className="min-h-dvh pb-24" style={{ background: "#0b1612" }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-5" style={{ background: "#0f1f12" }}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate("/app")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
            <ChevronLeft style={{ width: 18, height: 18, color: "#fff" }} />
          </button>
          <div>
            <h1 className="text-white font-black text-xl uppercase tracking-wide">Mes Tickets</h1>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>{tickets.length} ticket{tickets.length !== 1 ? "s" : ""} au total</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Total", value: tickets.length, color: "#fff" },
            { label: "Gagnants", value: winCount, color: "#22c55e" },
            { label: "FC gagnés", value: formatFC(totalWon) + " FC", color: "#F5C518" },
          ].map(s => (
            <div key={s.label} className="rounded-xl px-3 py-2.5 text-center" style={{ background: "rgba(255,255,255,0.06)" }}>
              <p className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.45)" }}>{s.label}</p>
              <p className="font-black text-sm mt-0.5" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 pt-4 space-y-3">
        <div className="relative">
          <Search style={{ width: 15, height: 15, color: "rgba(255,255,255,0.35)", position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())}
            placeholder="Rechercher un code…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm font-mono outline-none"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
          />
        </div>
        <div className="flex gap-2">
          {([["all", "Tous"], ["win", "Gagnants"], ["lose", "Perdants"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className="flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all"
              style={{
                background: filter === val ? (val === "win" ? "#22c55e" : val === "lose" ? "rgba(239,68,68,0.8)" : "#F5C518") : "rgba(255,255,255,0.07)",
                color: filter === val ? (val === "win" ? "#fff" : val === "lose" ? "#fff" : "#0a1f0e") : "rgba(255,255,255,0.5)",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 mt-4 space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl h-20 animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Ticket style={{ width: 40, height: 40, color: "rgba(255,255,255,0.15)", margin: "0 auto 12px" }} />
            <p className="font-bold text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              {tickets.length === 0 ? "Aucun ticket activé pour l'instant" : "Aucun ticket trouvé"}
            </p>
          </div>
        ) : (
          filtered.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
              style={{
                background: t.isWinner ? "rgba(34,197,94,0.07)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${t.isWinner ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)"}`,
              }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: t.isWinner ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)" }}>
                {t.isWinner
                  ? <CheckCircle style={{ width: 18, height: 18, color: "#22c55e" }} />
                  : <X style={{ width: 18, height: 18, color: "rgba(255,255,255,0.3)" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono font-black text-[13px] text-white tracking-wider">{t.code}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {formatDate(t.registeredAt)} · Série {t.series}
                </p>
              </div>
              <div className="text-right shrink-0">
                {t.isWinner ? (
                  <p className="font-black text-sm" style={{ color: "#22c55e" }}>
                    +{formatFC(parseFloat(t.prizeAmount ?? "0"))} FC
                  </p>
                ) : (
                  <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.25)" }}>Perdant</p>
                )}
                <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>{parseFloat(t.price).toFixed(0)} FC</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
