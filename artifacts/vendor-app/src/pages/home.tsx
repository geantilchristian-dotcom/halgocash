import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "../components/layout/app-layout";
import { useAuth } from "@/lib/auth-context";
import { Ticket, TrendingUp, CheckCircle2, Clock, ArrowDownLeft, Loader2, AlertCircle, PackageCheck, X } from "lucide-react";

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

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl p-4 bg-white border border-border shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-black" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
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

  return (
    <AppLayout>
      <div className="space-y-5">

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
              {/* Header */}
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
                  /* ── Success state ── */
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
                    <button
                      onClick={closeReceiveModal}
                      className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] bg-green-500 text-white"
                    >
                      FERMER
                    </button>
                  </>
                ) : (
                  /* ── Confirm state ── */
                  <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm font-bold text-amber-800">
                        {stats.pendingReceptionTickets} billet{stats.pendingReceptionTickets > 1 ? "s" : ""} vous ont été assignés par l'administrateur.
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        En confirmant, vous accusez réception de ces billets dans votre stock.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={closeReceiveModal}
                        className="py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-muted text-muted-foreground active:scale-[0.98] transition-all"
                      >
                        ANNULER
                      </button>
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

        {/* Greeting */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Point de vente</p>
          <h1 className="text-2xl font-black mt-0.5">{stats.vendorName}</h1>
          <p className="text-sm text-muted-foreground">{stats.location}</p>
        </div>

        {/* Tickets overview */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Tickets assignés</p>
          {/* Progress bar */}
          <div className="rounded-2xl bg-white border border-border shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{stats.soldTickets} vendus</span>
              <span className="text-sm text-muted-foreground">{stats.totalTickets} total</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${soldPct}%`, background: "linear-gradient(90deg, #F5C518, #d4a017)" }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="font-black text-lg text-green-600">{stats.soldTickets}</p>
                <p className="text-muted-foreground font-semibold">Vendus</p>
              </div>
              <div>
                <p className="font-black text-lg text-blue-600">{stats.availableTickets}</p>
                <p className="text-muted-foreground font-semibold">Disponibles</p>
              </div>
              <div>
                <p className="font-black text-lg text-purple-600">{stats.scratchedTickets}</p>
                <p className="text-muted-foreground font-semibold">Grattés</p>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Revenus attendus"
            value={`${formatFC(stats.expectedRevenue)} FC`}
            accent="#22c55e"
          />
          <StatCard
            label="Revenus collectés"
            value={`${formatFC(stats.collectedRevenue)} FC`}
            accent="#3b82f6"
            sub={stats.expectedRevenue > 0 ? `${Math.round((stats.collectedRevenue / stats.expectedRevenue) * 100)}% collecté` : undefined}
          />
        </div>

        {/* Withdrawals processed */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Retraits traités par vous</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white border border-yellow-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-yellow-500" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">En attente</p>
              </div>
              <p className="text-xl font-black text-yellow-600">{stats.pendingWithdrawals}</p>
              <p className="text-xs text-muted-foreground">{formatFC(stats.pendingAmount)} FC</p>
            </div>
            <div className="rounded-2xl bg-white border border-green-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Payés</p>
              </div>
              <p className="text-xl font-black text-green-600">{stats.paidWithdrawals}</p>
              <p className="text-xs text-muted-foreground">{formatFC(stats.paidAmount)} FC</p>
            </div>
          </div>
        </div>

        {/* Recent withdrawals */}
        {recentWithdrawals.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Derniers retraits payés</p>
            <div className="space-y-2">
              {recentWithdrawals.slice(0, 5).map((w) => (
                <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-border">
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
      </div>
    </AppLayout>
  );
}
