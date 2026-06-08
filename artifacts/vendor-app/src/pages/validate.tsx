import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "../components/layout/app-layout";
import { useAuth } from "@/lib/auth-context";
import {
  Search, Trophy, Ticket, CheckCircle2, Clock, AlertCircle, Loader2, Star,
} from "lucide-react";

interface TicketRow {
  id: number;
  code: string;
  series: string;
  price: string;
  isWinner: boolean;
  prizeAmount: string | null;
  registeredAt: string | null;
  createdAt: string;
}

interface TicketsResponse {
  tickets: TicketRow[];
}

type Filter = "all" | "available" | "scratched" | "winners";

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".");
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function prizeLabel(amount: string | null): string {
  if (!amount) return "Perdant";
  const n = parseFloat(amount);
  if (n >= 50000) return "Super Gagnant 🏆";
  if (n >= 25000) return "Très Grand Gagnant";
  if (n >= 10000) return "Grand Gagnant";
  if (n >= 5000) return "Gagnant";
  return "Remboursé";
}

export default function Validate() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const prevScratchedIds = useRef<Set<number>>(new Set());

  const { data, isLoading } = useQuery<TicketsResponse>({
    queryKey: ["/api/vendor/tickets", filter],
    queryFn: async () => {
      const res = await fetch(`/api/vendor/tickets?filter=${filter}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    refetchInterval: 5_000,
    enabled: !!user?.vendorId,
  });

  const tickets = data?.tickets ?? [];

  // Detect newly scratched tickets and flash them
  useEffect(() => {
    const scratched = new Set(tickets.filter((t) => t.registeredAt).map((t) => t.id));
    const newIds = [...scratched].filter((id) => !prevScratchedIds.current.has(id));
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (newIds.length > 0 && prevScratchedIds.current.size > 0) {
      setFlashIds(new Set(newIds));
      timer = setTimeout(() => setFlashIds(new Set()), 4000);
    }
    prevScratchedIds.current = scratched;
    return () => { if (timer !== undefined) clearTimeout(timer); };
  }, [tickets]);

  const filtered = tickets.filter((t) => {
    if (!search) return true;
    return t.code.toLowerCase().includes(search.toLowerCase());
  });

  const totalAvailable = tickets.filter((t) => !t.registeredAt).length;
  const totalScratched = tickets.filter((t) => t.registeredAt).length;
  const totalWinners   = tickets.filter((t) => t.isWinner).length;

  const FILTERS: { key: Filter; label: string; count: number; color: string }[] = [
    { key: "all",       label: "Tous",        count: tickets.length,  color: "bg-zinc-800 text-white"       },
    { key: "available", label: "Disponibles", count: totalAvailable,  color: "bg-blue-600 text-white"       },
    { key: "scratched", label: "Grattés",     count: totalScratched,  color: "bg-zinc-600 text-white"       },
    { key: "winners",   label: "Gagnants",    count: totalWinners,    color: "bg-amber-500 text-black"      },
  ];

  if (!user?.vendorId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground" />
          <p className="font-bold text-muted-foreground">Compte vendeur non configuré.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">

        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">Mes Billets</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Mis à jour toutes les 5 secondes</p>
          </div>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-center">
            <p className="text-2xl font-black text-blue-700">{totalAvailable}</p>
            <p className="text-[10px] font-bold uppercase text-blue-500 tracking-wide mt-0.5">Disponibles</p>
          </div>
          <div className="rounded-xl bg-zinc-100 border border-zinc-200 p-3 text-center">
            <p className="text-2xl font-black text-zinc-700">{totalScratched}</p>
            <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-wide mt-0.5">Grattés</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
            <p className="text-2xl font-black text-amber-600">{totalWinners}</p>
            <p className="text-[10px] font-bold uppercase text-amber-500 tracking-wide mt-0.5">Gagnants</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                filter === f.key
                  ? f.color
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {f.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                filter === f.key ? "bg-white/20" : "bg-background"
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            placeholder="Rechercher un code…"
            className="w-full pl-8 pr-3 py-2 text-sm font-mono rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Ticket list */}
        {isLoading && tickets.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
            <Ticket className="w-10 h-10 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground font-semibold">Aucun billet trouvé</p>
          </div>
        ) : (
          <div className="space-y-2 pb-2">
            {filtered.map((ticket) => {
              const isScratched = !!ticket.registeredAt;
              const isWinner    = ticket.isWinner;
              const isFlashing  = flashIds.has(ticket.id);
              const price       = parseFloat(ticket.price);

              return (
                <div
                  key={ticket.id}
                  className={`rounded-xl border p-3 transition-all duration-500 ${
                    isFlashing
                      ? "border-green-400 bg-green-50 shadow-md shadow-green-200"
                      : isWinner
                      ? "border-amber-300 bg-amber-50"
                      : isScratched
                      ? "border-zinc-200 bg-zinc-50"
                      : "border-border bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Code + series */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base tracking-widest">
                          {ticket.code}
                        </span>
                        {isFlashing && (
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full bg-green-500 text-white animate-pulse">
                            NOUVEAU
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                        Série <span className="font-black">{ticket.series}</span>
                        {" · "}
                        <span className="font-black">{formatFC(price)} FC</span>
                      </p>
                    </div>

                    {/* Status badge */}
                    <div className="shrink-0 text-right">
                      {isWinner ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-full bg-amber-500 text-black">
                          <Star className="w-3 h-3" />
                          Gagnant
                        </span>
                      ) : isScratched ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-full bg-zinc-600 text-white">
                          <CheckCircle2 className="w-3 h-3" />
                          Gratté
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-full bg-blue-600 text-white">
                          <Clock className="w-3 h-3" />
                          Disponible
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom info */}
                  {isScratched && ticket.registeredAt && (
                    <div className={`mt-2 pt-2 border-t flex items-center justify-between ${
                      isWinner ? "border-amber-200" : "border-zinc-200"
                    }`}>
                      {isWinner ? (
                        <span className="flex items-center gap-1 text-xs font-black text-amber-700">
                          <Trophy className="w-3.5 h-3.5" />
                          {prizeLabel(ticket.prizeAmount)}
                          {ticket.prizeAmount && (
                            <span className="ml-1 text-amber-600">
                              — {formatFC(parseFloat(ticket.prizeAmount))} FC
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500 font-medium">Perdant</span>
                      )}
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {relativeTime(ticket.registeredAt)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
