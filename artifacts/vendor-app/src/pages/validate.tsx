import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "../components/layout/app-layout";
import { useAuth } from "@/lib/auth-context";
import { Search, Trophy, Ticket, CheckCircle2, Clock, AlertCircle, Loader2, Star, Zap, QrCode, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

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
  totalAvailable: number;
  totalScratched: number;
  totalWinners: number;
}

type Filter = "all" | "available" | "scratched" | "winners";

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".");
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function prizeLabel(amount: string | null): string {
  if (!amount) return "Perdant";
  const n = parseFloat(amount);
  if (n >= 50000) return "Super Gagnant";
  if (n >= 25000) return "Très Grand Gagnant";
  if (n >= 10000) return "Grand Gagnant";
  if (n >= 5000) return "Gagnant";
  return "Remboursé";
}

const FILTER_CFG: { key: Filter; label: string; bg: string; text: string }[] = [
  { key: "all",       label: "Tous",        bg: "#1f2937", text: "#fff"     },
  { key: "available", label: "Disponibles", bg: "#2563eb", text: "#fff"     },
  { key: "scratched", label: "Grattés",     bg: "#6b7280", text: "#fff"     },
  { key: "winners",   label: "Gagnants",    bg: "#F5C518", text: "#0a1f0e"  },
];

export default function Validate() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const prevScratchedIds = useRef<Set<number>>(new Set());
  const [expandedQr, setExpandedQr] = useState<number | null>(null);

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

  // Use server-side totals (accurate, not limited by pagination)
  const totalAvailable = data?.totalAvailable ?? tickets.filter((t) => !t.registeredAt).length;
  const totalScratched  = data?.totalScratched  ?? tickets.filter((t) => t.registeredAt).length;
  const totalWinners    = data?.totalWinners    ?? tickets.filter((t) => t.isWinner).length;

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

  const filtered = tickets.filter((t) =>
    !search || t.code.toLowerCase().includes(search.toLowerCase())
  );

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
      <div className="space-y-3">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-black uppercase tracking-tight text-gray-800">Mes Billets</h1>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.25)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Live</span>
            {isLoading && <Loader2 className="w-3 h-3 animate-spin text-green-600 ml-0.5" style={{ width: 12, height: 12 }} />}
          </div>
        </div>

        {/* ── Summary strip — 3 saturated cards ── */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-3 text-center shadow-sm"
            style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", boxShadow: "0 3px 12px rgba(37,99,235,0.35)" }}>
            <p className="text-2xl font-black text-white leading-none">{totalAvailable}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide text-white/70 mt-0.5">Disponibles</p>
          </div>
          <div className="rounded-xl p-3 text-center shadow-sm"
            style={{ background: "linear-gradient(135deg, #4b5563, #374151)", boxShadow: "0 3px 12px rgba(75,85,99,0.3)" }}>
            <p className="text-2xl font-black text-white leading-none">{totalScratched}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide text-white/70 mt-0.5">Grattés</p>
          </div>
          <div className="rounded-xl p-3 text-center shadow-sm"
            style={{ background: "linear-gradient(135deg, #F5C518, #d4a017)", boxShadow: "0 3px 12px rgba(245,197,24,0.4)" }}>
            <p className="text-2xl font-black text-black/90 leading-none">{totalWinners}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide text-black/60 mt-0.5">Gagnants</p>
          </div>
        </div>

        {/* ── Filter tabs + Search on same row ── */}
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 overflow-x-auto flex-1">
            {FILTER_CFG.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all"
                  style={active
                    ? { background: f.bg, color: f.text, boxShadow: `0 2px 8px ${f.bg}55` }
                    : { background: "#e5e7eb", color: "#6b7280" }
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Search ── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" style={{ width: 14, height: 14 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            placeholder="Rechercher un code…"
            className="w-full pl-8 pr-3 py-2 text-sm font-mono rounded-xl border-0 outline-none focus:ring-2 focus:ring-green-500/30 transition-all"
            style={{ background: "#f3f4f6", color: "#111827" }}
          />
        </div>

        {/* ── Ticket list ── */}
        {isLoading && tickets.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <Ticket className="w-9 h-9 text-gray-300" />
            <p className="text-sm text-gray-400 font-semibold">Aucun billet trouvé</p>
          </div>
        ) : (
          <div className="space-y-2 pb-2">
            {filtered.map((ticket) => {
              const isScratched = !!ticket.registeredAt;
              const isWinner    = ticket.isWinner;
              const isFlashing  = flashIds.has(ticket.id);
              const price       = parseFloat(ticket.price);

              let leftBorder = "#e5e7eb";
              if (isFlashing) leftBorder = "#22c55e";
              else if (isWinner) leftBorder = "#F5C518";
              else if (isScratched) leftBorder = "#9ca3af";
              else leftBorder = "#3b82f6";

              let cardBg = "#ffffff";
              if (isFlashing) cardBg = "#f0fdf4";
              else if (isWinner) cardBg = "#fffbeb";
              else if (isScratched) cardBg = "#f9fafb";

              const qrUrl = `${window.location.origin}/app?code=${ticket.code}`;
              const showQr = expandedQr === ticket.id;

              return (
                <div
                  key={ticket.id}
                  className="rounded-xl overflow-hidden shadow-sm transition-all duration-500"
                  style={{
                    background: cardBg,
                    borderLeft: `4px solid ${leftBorder}`,
                    border: `1px solid #f0f0f0`,
                    borderLeftWidth: 4,
                    borderLeftColor: leftBorder,
                  }}
                >
                  <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                    {/* Left: code + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-[15px] tracking-widest text-gray-900">
                          {ticket.code}
                        </span>
                        {isFlashing && (
                          <span className="flex items-center gap-0.5 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-green-500 text-white animate-pulse">
                            <Zap style={{ width: 9, height: 9 }} />NEW
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                        Série <span className="text-gray-600 font-black">{ticket.series}</span>
                        {" · "}
                        <span className="font-black text-gray-700">{formatFC(price)} FC</span>
                        {isScratched && ticket.registeredAt && (
                          <span className="text-gray-400"> · {relativeTime(ticket.registeredAt)}</span>
                        )}
                      </p>
                    </div>

                    {/* Right: QR toggle (available only) + badge + prize */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {!isScratched && (
                        <button
                          onClick={() => setExpandedQr(showQr ? null : ticket.id)}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-all"
                          style={showQr
                            ? { background: "#0f3d1c", color: "#fff" }
                            : { background: "#e5e7eb", color: "#374151" }
                          }
                        >
                          {showQr ? <X style={{ width: 10, height: 10 }} /> : <QrCode style={{ width: 10, height: 10 }} />}
                          {showQr ? "Fermer" : "QR"}
                        </button>
                      )}
                      {isWinner ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                            style={{ background: "#F5C518", color: "#0a1f0e" }}>
                            <Star style={{ width: 10, height: 10 }} />
                            Gagnant
                          </span>
                          {ticket.prizeAmount && (
                            <span className="text-[11px] font-black text-amber-700">
                              +{formatFC(parseFloat(ticket.prizeAmount))} FC
                            </span>
                          )}
                        </>
                      ) : isScratched ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-500 text-white">
                          <CheckCircle2 style={{ width: 10, height: 10 }} />
                          Gratté
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white">
                          <Clock style={{ width: 10, height: 10 }} />
                          Disponible
                        </span>
                      )}
                      {isWinner && ticket.prizeAmount && (
                        <span className="text-[9px] text-amber-600 font-bold">
                          <Trophy style={{ width: 9, height: 9, display: "inline", marginRight: 2 }} />
                          {prizeLabel(ticket.prizeAmount)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* QR code panel — shown when toggled */}
                  {showQr && (
                    <div className="flex flex-col items-center gap-2 px-3 py-4 border-t border-gray-100"
                      style={{ background: "#f9fafb" }}>
                      <div className="p-3 bg-white rounded-xl shadow-sm">
                        <QRCodeSVG value={qrUrl} size={160} level="M" />
                      </div>
                      <p className="text-[10px] text-gray-400 font-semibold text-center">
                        Le client scanne ce code pour activer le billet
                      </p>
                      <p className="font-mono text-[11px] font-black text-gray-600 tracking-widest">{ticket.code}</p>
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
