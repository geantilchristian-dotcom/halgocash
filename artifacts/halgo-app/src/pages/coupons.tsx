import { useState } from "react";
import { CheckCircle, XCircle, Clock, Ticket, Trophy } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

type TicketStatus = "gagné" | "non_gagné" | "en_attente";

interface CouponItem {
  id: string;
  code: string;
  date: string;
  drawNumber: string;
  status: TicketStatus;
  prize: number | null;
}

/* Mock data — will be replaced by real API */
const MOCK: CouponItem[] = [
  { id: "1", code: "HC-004-012", date: "2026-06-07", drawNumber: "TIRAGE #047", status: "gagné",      prize: 75000  },
  { id: "2", code: "HC-003-088", date: "2026-06-06", drawNumber: "TIRAGE #046", status: "non_gagné",  prize: null   },
  { id: "3", code: "HC-003-044", date: "2026-06-05", drawNumber: "TIRAGE #045", status: "non_gagné",  prize: null   },
  { id: "4", code: "HC-002-017", date: "2026-06-04", drawNumber: "TIRAGE #044", status: "gagné",      prize: 50000  },
  { id: "5", code: "HC-002-008", date: "2026-06-03", drawNumber: "TIRAGE #043", status: "non_gagné",  prize: null   },
  { id: "6", code: "HC-001-031", date: "2026-06-02", drawNumber: "TIRAGE #042", status: "en_attente", prize: null   },
  { id: "7", code: "HC-001-019", date: "2026-06-01", drawNumber: "TIRAGE #041", status: "non_gagné",  prize: null   },
  { id: "8", code: "HC-001-005", date: "2026-05-31", drawNumber: "TIRAGE #040", status: "gagné",      prize: 25000  },
];

type Filter = "tous" | "gagné" | "non_gagné";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatXAF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n).replace(/\s/g, ".");
}

export default function Coupons() {
  const { isDark } = useTheme();
  const [filter, setFilter] = useState<Filter>("tous");

  const filtered = MOCK.filter((t) => filter === "tous" || t.status === filter);

  const totalGagné  = MOCK.filter((t) => t.status === "gagné").length;
  const totalPrix   = MOCK.filter((t) => t.prize).reduce((s, t) => s + (t.prize ?? 0), 0);

  const page  = isDark ? "bg-[#080f0a]" : "bg-[#f4f6f4]";
  const card  = isDark ? "bg-[#0f2418] border-white/10" : "bg-white border-gray-100";
  const text  = isDark ? "text-white" : "text-gray-900";
  const sub   = isDark ? "text-gray-400" : "text-gray-500";

  const statusInfo = {
    gagné:      { icon: CheckCircle, color: "#22c55e",  bg: isDark ? "#14532d" : "#f0fdf4", label: "Gagné"       },
    non_gagné:  { icon: XCircle,     color: "#ef4444",  bg: isDark ? "#450a0a" : "#fef2f2", label: "Non gagné"   },
    en_attente: { icon: Clock,       color: "#F5C518",  bg: isDark ? "#422006" : "#fffbeb", label: "En attente"  },
  };

  const filterBtns: { key: Filter; label: string }[] = [
    { key: "tous",       label: "Tous"        },
    { key: "gagné",      label: "Gagnants"    },
    { key: "non_gagné",  label: "Non gagnants"},
  ];

  return (
    <div className={`min-h-dvh transition-colors ${page}`}>
      {/* Header */}
      <div
        className="px-5 pt-10 pb-14"
        style={{ background: "linear-gradient(135deg, #0f3d1c 0%, #1a5c2a 100%)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Ticket className="w-5 h-5 text-[#F5C518]" />
          <h1 className="text-white font-black text-2xl uppercase tracking-wider">MES COUPONS</h1>
        </div>
        <p className="text-white/60 text-sm">Historique de tous vos tickets de loterie</p>

        {/* Stats */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.08)" }}>
            <p className="text-white/50 text-[9px] font-bold uppercase tracking-wider">Tickets joués</p>
            <p className="text-white font-black text-xl">{MOCK.length}</p>
          </div>
          <div className="flex-1 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-1">
              <Trophy className="w-3 h-3 text-[#F5C518]" />
              <p className="text-white/50 text-[9px] font-bold uppercase tracking-wider">Gagnants</p>
            </div>
            <p className="text-[#F5C518] font-black text-xl">{totalGagné}</p>
          </div>
          <div className="flex-1 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.08)" }}>
            <p className="text-white/50 text-[9px] font-bold uppercase tracking-wider">Total gagné</p>
            <p className="text-[#8DC63F] font-black text-sm leading-tight">{formatXAF(totalPrix)}<span className="text-[9px] text-white/40 ml-0.5">XAF</span></p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="-mt-5 mx-4 mb-4">
        <div className={`rounded-2xl shadow-sm border overflow-hidden transition-colors ${card}`}>
          <div className="flex">
            {filterBtns.map(({ key, label }, i) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-wide transition-all ${
                  i > 0 ? `border-l ${isDark ? "border-white/10" : "border-gray-100"}` : ""
                } ${
                  filter === key
                    ? "text-white"
                    : isDark ? "text-gray-500" : "text-gray-400"
                }`}
                style={filter === key ? { background: "linear-gradient(135deg, #0f3d1c, #1a5c2a)" } : {}}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ticket list */}
      <div className="mx-4 space-y-2 pb-6">
        {filtered.length === 0 ? (
          <div className={`rounded-2xl p-10 text-center border transition-colors ${card}`}>
            <Ticket className={`w-10 h-10 mx-auto mb-3 ${sub}`} />
            <p className={`font-bold text-sm ${text}`}>Aucun coupon trouvé</p>
            <p className={`text-xs mt-1 ${sub}`}>Achetez votre premier ticket !</p>
          </div>
        ) : (
          filtered.map((ticket) => {
            const st = statusInfo[ticket.status];
            const Icon = st.icon;
            return (
              <div key={ticket.id} className={`rounded-2xl p-4 shadow-sm border transition-colors ${card}`}>
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: st.bg }}
                  >
                    <Icon className="w-5 h-5" style={{ color: st.color }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`font-black text-sm font-mono ${text}`}>{ticket.code}</span>
                      {ticket.prize !== null && (
                        <span
                          className="text-xs font-black px-2 py-0.5 rounded-full"
                          style={{ background: "linear-gradient(135deg, #F5C518, #d4a017)", color: "#0f3d1c" }}
                        >
                          +{formatXAF(ticket.prize)} XAF
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${sub}`}>{ticket.drawNumber}</span>
                      <span className={`text-[10px] ${sub}`}>•</span>
                      <span className={`text-[10px] ${sub}`}>{formatDate(ticket.date)}</span>
                    </div>
                    {/* Status badge */}
                    <span
                      className="mt-1.5 inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: st.bg, color: st.color }}
                    >
                      {st.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
