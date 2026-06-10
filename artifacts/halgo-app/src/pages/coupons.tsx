import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { CheckCircle, XCircle, Clock, Ticket, Trophy, Plus, X, Loader2, ScanLine } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { QrScanner } from "@/components/qr-scanner";

type TicketStatus = "available" | "sold" | "validated" | "claimed" | "expired";

interface CouponItem {
  id: number;
  code: string;
  status: TicketStatus;
  price: number;
  series: string;
  drawId: number | null;
  drawNumber: number | null;
  isWinner: boolean;
  prizeAmount: number | null;
  registeredAt: string | null;
  soldAt: string | null;
}

type Filter = "tous" | "gagnant" | "perdant";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n).replace(/\s/g, ".");
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Erreur reseau");
  return body;
}

export default function Coupons() {
  const { isLoaded, isSignedIn } = useUser();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("tous");
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const handleScanResult = (raw: string) => {
    setShowScanner(false);
    // QR codes contain either a URL (?code=XXXXXXXXXX) or a raw 10-digit code
    let code = raw.trim();
    try {
      const url = new URL(raw);
      const param = url.searchParams.get("code");
      if (param) code = param;
    } catch { /* not a URL — use raw value */ }
    code = code.replace(/\D/g, "").slice(0, 10);
    if (code.length === 10) {
      setNewCode(code);
      setShowAdd(true);
      setAddError(null);
      registerMutation.mutate(code);
    } else {
      setNewCode(code);
      setShowAdd(true);
      setAddError("QR invalide — vérifiez le code ci-dessous.");
    }
  };

  const { data: tickets = [], isLoading } = useQuery<CouponItem[]>({
    queryKey: ["/api/coupons"],
    queryFn: () => apiFetch("/api/coupons"),
    enabled: isLoaded && isSignedIn,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const registerMutation = useMutation({
    mutationFn: (code: string) =>
      apiFetch("/api/coupons/register", { method: "POST", body: JSON.stringify({ code }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      setNewCode("");
      setShowAdd(false);
      setAddError(null);
    },
    onError: (err: Error) => {
      setAddError(err.message);
    },
  });

  const handleRegister = () => {
    setAddError(null);
    const trimmed = newCode.trim().replace(/\D/g, "");
    if (trimmed.length !== 10) {
      setAddError("Le code doit contenir exactement 10 chiffres");
      return;
    }
    registerMutation.mutate(trimmed);
  };

  const filtered = tickets.filter((t) => {
    if (filter === "gagnant") return t.isWinner;
    if (filter === "perdant") return !t.isWinner;
    return true;
  });

  const totalWinners = tickets.filter((t) => t.isWinner).length;
  const totalPrize   = tickets.filter((t) => t.prizeAmount).reduce((s, t) => s + (t.prizeAmount ?? 0), 0);

  const page = isDark ? "bg-[#080f0a]" : "bg-[#f4f6f4]";
  const card = isDark ? "bg-[#0f2418] border-white/10" : "bg-white border-gray-100";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub  = isDark ? "text-gray-400" : "text-gray-500";

  const filterBtns: { key: Filter; label: string }[] = [
    { key: "tous",    label: "Tous"        },
    { key: "gagnant", label: "Gagnants"    },
    { key: "perdant", label: "Non gagnants"},
  ];

  return (
    <div className={`min-h-dvh transition-colors ${page}`}>
      {/* QR Scanner overlay */}
      {showScanner && (
        <QrScanner onResult={handleScanResult} onClose={() => setShowScanner(false)} />
      )}

      {/* Header */}
      <div
        className="px-5 pt-10 pb-14"
        style={{ background: "linear-gradient(135deg, #0f3d1c 0%, #1a5c2a 100%)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-black text-2xl uppercase tracking-wider">MES COUPONS</h1>
            <p className="text-white/60 text-sm mt-0.5">Historique de vos tickets de loterie</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
              style={{ background: "rgba(58,171,58,0.2)", color: "#3aab3a", border: "1px solid rgba(58,171,58,0.3)" }}
            >
              <ScanLine className="w-4 h-4" />
              Scanner
            </button>
            <button
              onClick={() => { setShowAdd(true); setAddError(null); setNewCode(""); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
              style={{ background: "rgba(245,197,24,0.2)", color: "#F5C518", border: "1px solid rgba(245,197,24,0.3)" }}
            >
              <Plus className="w-4 h-4" />
              Ajouter
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.08)" }}>
            <p className="text-white/50 text-[9px] font-bold uppercase tracking-wider text-center">Tickets</p>
            <p className="text-white font-black text-xl text-center">{tickets.length}</p>
          </div>
          <div className="flex-1 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-center gap-1">
              <Trophy className="w-3 h-3 text-[#F5C518]" />
              <p className="text-white/50 text-[9px] font-bold uppercase tracking-wider">Gagnants</p>
            </div>
            <p className="text-[#F5C518] font-black text-xl text-center">{totalWinners}</p>
          </div>
          <div className="flex-1 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.08)" }}>
            <p className="text-white/50 text-[9px] font-bold uppercase tracking-wider text-center">Total gagne</p>
            <p className="text-[#8DC63F] font-black text-sm leading-tight text-center">
              {formatFC(totalPrize)}<span className="text-[9px] text-white/40 ml-0.5">FC</span>
            </p>
          </div>
        </div>
      </div>

      {/* Add coupon modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div
            className={`relative w-full max-w-sm rounded-t-3xl p-6 pb-10 transition-colors ${isDark ? "bg-[#0f2418]" : "bg-white"}`}
            style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.4)" }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5" />
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-base font-black uppercase tracking-wider ${text}`}>AJOUTER UN COUPON</h2>
              <button onClick={() => setShowAdd(false)}
                className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
                <X className={`w-4 h-4 ${sub}`} />
              </button>
            </div>
            <p className={`text-sm mb-4 ${sub}`}>
              Entrez le code a 10 chiffres de votre ticket. Chaque coupon ne peut etre enregistre qu'une seule fois.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              placeholder="0000000000"
              value={newCode}
              onChange={(e) => { setNewCode(e.target.value.replace(/\D/g, "").slice(0, 10)); setAddError(null); }}
              className={`w-full px-4 py-3 rounded-xl text-center font-mono font-bold text-xl tracking-[0.25em] outline-none border-2 transition-all ${
                isDark
                  ? "bg-black/30 border-white/15 text-white focus:border-[#3aab3a]"
                  : "bg-gray-50 border-gray-200 text-gray-900 focus:border-[#3aab3a]"
              }`}
            />
            {addError && (
              <p className="text-red-400 text-xs mt-2 text-center">{addError}</p>
            )}
            <button
              onClick={handleRegister}
              disabled={registerMutation.isPending || newCode.length !== 10}
              className="w-full mt-4 py-3.5 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #0f3d1c, #1a5c2a)", color: "#fff" }}
            >
              {registerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Enregistrer le coupon
            </button>
          </div>
        </div>
      )}

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
                } ${filter === key ? "text-white" : isDark ? "text-gray-500" : "text-gray-400"}`}
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
        {isLoading ? (
          <div className={`rounded-2xl p-10 text-center border transition-colors ${card}`}>
            <Loader2 className={`w-8 h-8 mx-auto mb-3 animate-spin ${sub}`} />
            <p className={`text-sm ${sub}`}>Chargement...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`rounded-2xl p-10 text-center border transition-colors ${card}`}>
            <Ticket className={`w-10 h-10 mx-auto mb-3 ${sub}`} />
            <p className={`font-bold text-sm ${text}`}>Aucun coupon</p>
            <p className={`text-xs mt-1 ${sub}`}>
              {tickets.length === 0
                ? "Achetez un ticket et enregistrez son code ici."
                : "Aucun coupon dans cette categorie."}
            </p>
          </div>
        ) : (
          filtered.map((ticket) => {
            const isWinner    = ticket.isWinner;
            const isPending   = ticket.status === "available" || ticket.status === "sold";
            const iconColor   = isWinner ? "#22c55e" : isPending ? "#F5C518" : "#ef4444";
            const iconBg      = isWinner
              ? (isDark ? "#14532d" : "#f0fdf4")
              : isPending ? (isDark ? "#422006" : "#fffbeb") : (isDark ? "#450a0a" : "#fef2f2");
            const StatusIcon  = isWinner ? CheckCircle : isPending ? Clock : XCircle;
            const statusLabel = isWinner ? "Gagnant" : isPending ? "En attente" : "Non gagnant";
            const drawLabel   = ticket.drawNumber ? `TIRAGE #${String(ticket.drawNumber).padStart(3, "0")}` : "Sans tirage";

            return (
              <div key={ticket.id} className={`rounded-2xl p-4 shadow-sm border transition-colors ${card}`}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
                    <StatusIcon className="w-5 h-5" style={{ color: iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`font-black text-sm font-mono ${text}`}>{ticket.code}</span>
                      {ticket.prizeAmount !== null && (
                        <span
                          className="text-xs font-black px-2 py-0.5 rounded-full"
                          style={{ background: "linear-gradient(135deg, #F5C518, #d4a017)", color: "#0f3d1c" }}
                        >
                          +{formatFC(ticket.prizeAmount)} FC
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${sub}`}>{drawLabel}</span>
                      <span className={`text-[10px] ${sub}`}>·</span>
                      <span className={`text-[10px] ${sub}`}>{formatDate(ticket.registeredAt)}</span>
                    </div>
                    <span
                      className="mt-1.5 inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: iconBg, color: iconColor }}
                    >
                      {statusLabel}
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
