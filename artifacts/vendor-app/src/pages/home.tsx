import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "../components/layout/app-layout";
import { useAuth } from "@/lib/auth-context";
import { Ticket, TrendingUp, CheckCircle2, Clock, ArrowDownLeft, Loader2, AlertCircle, PackageCheck, X, MapPin } from "lucide-react";

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".");
}

interface VendorStats {
  vendorId: number;
  vendorName: string;
  location: string;
  totalTickets: number;
  soldTickets: number;
  availableTickets: number;
  scratchedTickets: number;
  pendingReceptionTickets: number;
  expectedRevenue: number;
  collectedRevenue: number;
  pendingWithdrawals: number;
  pendingAmount: number;
  paidWithdrawals: number;
  paidAmount: number;
}

interface RecentWithdrawal {
  id: number;
  clerkName: string;
  amount: number;
  paidAt: string;
}

export default function Home() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveLoading, setReceiveLoading] = useState(false);
  const [receiveResult, setReceiveResult] = useState<number | null>(null);

  const confirmReceive = async () => {
    setReceiveLoading(true);
    try {
      const res = await fetch("/api/vendor/receive-tickets", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json() as { received: number };
      setReceiveResult(data.received);
      void queryClient.invalidateQueries({ queryKey: ["/api/vendor/stats"] });
    } catch { /* silent */ }
    setReceiveLoading(false);
  };

  const closeReceiveModal = () => {
    setShowReceiveModal(false);
    setReceiveResult(null);
  };

  const { data: stats, isLoading, error } = useQuery<VendorStats>({
    queryKey: ["/api/vendor/stats"],
    queryFn: async () => {
      const res = await fetch("/api/vendor/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Erreur stats");
      return res.json();
    },
    refetchInterval: 30_000,
    enabled: !!user?.vendorId,
  });

  const { data: recentWithdrawals = [] } = useQuery<RecentWithdrawal[]>({
    queryKey: ["/api/vendor/withdrawals"],
    queryFn: async () => {
      const res = await fetch("/api/vendor/withdrawals", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
    enabled: !!user?.vendorId,
  });

  if (!user?.vendorId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground" />
          <p className="font-bold text-muted-foreground">Compte vendeur non configuré.</p>
          <p className="text-sm text-muted-foreground">Contactez un administrateur.</p>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error || !stats) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm font-semibold text-muted-foreground">Impossible de charger les statistiques.</p>
        </div>
      </AppLayout>
    );
  }

  const soldPct = stats.totalTickets > 0
    ? Math.round((stats.soldTickets / stats.totalTickets) * 100)
    : 0;
  const collectPct = stats.expectedRevenue > 0
    ? Math.round((stats.collectedRevenue / stats.expectedRevenue) * 100)
    : 0;

  return (
    <AppLayout>
      <div className="space-y-4">

        {/* ── Réception de billets (banner) ── */}
        {stats.pendingReceptionTickets > 0 && (
          <button
            onClick={() => setShowReceiveModal(true)}
            className="w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #F5C518, #d4a017)", boxShadow: "0 4px 20px rgba(245,197,24,0.35)" }}
          >
            <div className="w-12 h-12 rounded-xl bg-black/15 flex items-center justify-center shrink-0">
              <PackageCheck className="w-6 h-6 text-black/80" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-black text-sm uppercase tracking-wide">Recevoir les billets</p>
              <p className="text-black/70 text-xs font-semibold mt-0.5">
                {stats.pendingReceptionTickets} billet{stats.pendingReceptionTickets > 1 ? "s" : ""} vous ont été assignés
              </p>
            </div>
            <div className="shrink-0 bg-black/15 text-black/80 font-black text-lg rounded-xl w-10 h-10 flex items-center justify-center">
              {stats.pendingReceptionTickets}
            </div>
          </button>
        )}

        {/* ── Modal de réception ── */}
        {showReceiveModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
            <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #F5C518, #d4a017)" }}>
                    <PackageCheck className="w-5 h-5 text-black/80" />
                  </div>
                  <div>
                    <p className="font-black text-base">Confirmation de réception</p>
                    <p className="text-xs text-muted-foreground">Billets assignés par l'admin</p>
                  </div>
                </div>
                <button onClick={closeReceiveModal} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="px-5 pb-6 space-y-4">
                {receiveResult !== null ? (
                  <>
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                        <CheckCircle2 className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <p className="font-black text-lg text-green-600">Billets reçus !</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          <span className="font-black text-foreground">{receiveResult}</span> billet{receiveResult > 1 ? "s" : ""} ajouté{receiveResult > 1 ? "s" : ""} à votre stock
                        </p>
                      </div>
                    </div>
                    <button onClick={closeReceiveModal} className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-green-500 text-white">FERMER</button>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm font-bold text-amber-800">
                        {stats.pendingReceptionTickets} billet{stats.pendingReceptionTickets > 1 ? "s" : ""} vous ont été assignés par l'administrateur.
                      </p>
                      <p className="text-xs text-amber-700 mt-1">En confirmant, vous accusez réception de ces billets dans votre stock.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={closeReceiveModal} className="py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-muted text-muted-foreground active:scale-[0.98] transition-all">ANNULER</button>
                      <button
                        onClick={confirmReceive}
                        disabled={receiveLoading}
                        className="py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
                        style={{ background: "linear-gradient(135deg, #F5C518, #d4a017)", color: "#000" }}
                      >
                        {receiveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        CONFIRMER
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Point de vente — centered single line ── */}
        <div className="text-center py-1">
          <div className="flex items-center justify-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-green-600 shrink-0" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-green-700">
              Point de vente
            </p>
            <span className="text-gray-300">·</span>
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-700">
              {stats.vendorName}{stats.location ? ` ${stats.location}` : ""}
            </p>
          </div>
        </div>

        {/* ── Revenue cards ── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Revenus attendus */}
          <div
            className="rounded-2xl p-4 shadow-sm"
            style={{ background: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)", border: "1.5px solid rgba(34,197,94,0.3)" }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-green-600" style={{ width: 14, height: 14 }} />
              <p className="text-[10px] font-bold uppercase tracking-wider text-green-700">Revenus attendus</p>
            </div>
            <p className="text-lg font-black text-green-800 leading-none">{formatFC(stats.expectedRevenue)}</p>
            <p className="text-[10px] font-semibold text-green-600 mt-0.5">FC</p>
          </div>

          {/* Revenus collectés */}
          <div
            className="rounded-2xl p-4 shadow-sm"
            style={{ background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)", border: "1.5px solid rgba(59,130,246,0.3)" }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" style={{ width: 14, height: 14 }} />
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Revenus collectés</p>
            </div>
            <p className="text-lg font-black text-blue-800 leading-none">{formatFC(stats.collectedRevenue)}</p>
            <p className="text-[10px] font-semibold text-blue-500 mt-0.5">{collectPct}% collecté</p>
          </div>
        </div>

        {/* ── Withdrawals ── */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-2xl p-4 shadow-sm"
            style={{ background: "linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)", border: "1.5px solid rgba(234,179,8,0.3)" }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-yellow-600" style={{ width: 14, height: 14 }} />
              <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-700">En attente</p>
            </div>
            <p className="text-xl font-black text-yellow-700 leading-none">{stats.pendingWithdrawals}</p>
            <p className="text-[10px] text-yellow-600 font-semibold mt-0.5">{formatFC(stats.pendingAmount)} FC</p>
          </div>
          <div
            className="rounded-2xl p-4 shadow-sm"
            style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", border: "1.5px solid rgba(34,197,94,0.25)" }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" style={{ width: 14, height: 14 }} />
              <p className="text-[10px] font-bold uppercase tracking-wider text-green-700">Payés</p>
            </div>
            <p className="text-xl font-black text-green-700 leading-none">{stats.paidWithdrawals}</p>
            <p className="text-[10px] text-green-600 font-semibold mt-0.5">{formatFC(stats.paidAmount)} FC</p>
          </div>
        </div>

        {/* ── Recent withdrawals ── */}
        {recentWithdrawals.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Derniers retraits payés</p>
            <div className="space-y-2">
              {recentWithdrawals.slice(0, 5).map((w) => (
                <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <ArrowDownLeft className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{w.clerkName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(w.paidAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <p className="font-black text-sm text-green-600 shrink-0">{formatFC(w.amount)} FC</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tickets assignés — green card at bottom ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 text-center">Tickets assignés</p>
          <div
            className="rounded-2xl p-4 space-y-3 shadow-sm"
            style={{
              background: "linear-gradient(135deg, #0f3d1c 0%, #165c28 60%, #0f3d1c 100%)",
              border: "1.5px solid rgba(141,198,63,0.3)",
            }}
          >
            {/* Progress bar */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{stats.soldTickets} vendus</span>
              <span className="text-sm text-white/50">{stats.totalTickets} total</span>
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.12)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${soldPct}%`, background: "linear-gradient(90deg, #F5C518, #8DC63F)" }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl py-2 px-1" style={{ background: "rgba(255,255,255,0.08)" }}>
                <p className="font-black text-lg text-[#8DC63F] leading-none">{stats.soldTickets}</p>
                <p className="text-[9px] font-bold uppercase tracking-wide text-white/50 mt-0.5">Vendus</p>
              </div>
              <div className="rounded-xl py-2 px-1" style={{ background: "rgba(255,255,255,0.08)" }}>
                <p className="font-black text-lg text-[#F5C518] leading-none">{stats.availableTickets}</p>
                <p className="text-[9px] font-bold uppercase tracking-wide text-white/50 mt-0.5">Disponibles</p>
              </div>
              <div className="rounded-xl py-2 px-1" style={{ background: "rgba(255,255,255,0.08)" }}>
                <p className="font-black text-lg text-white/80 leading-none">{stats.scratchedTickets}</p>
                <p className="text-[9px] font-bold uppercase tracking-wide text-white/50 mt-0.5">Grattés</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 justify-center">
              <Ticket className="w-3.5 h-3.5 text-white/30" style={{ width: 13, height: 13 }} />
              <p className="text-[9px] text-white/30 font-semibold uppercase tracking-widest">{soldPct}% écoulés</p>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
