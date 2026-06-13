import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Store,
  MapPin,
  Clock,
  TrendingUp,
  LockKeyhole,
  UnlockKeyhole,
  Siren,
  CheckCheck,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface VendorReport {
  vendor_id: number;
  vendor_name: string;
  location: string;
  user_id: number;
  username: string;
  total_tickets: string;
  total_usd: string;
  total_fc: string;
  last_sale_at: string | null;
  closed_at: string | null;
}

interface DailySaleDetail {
  vendor_id: number;
  unit_amount: string;
  quantity: number;
  total_amount: string;
  currency: string;
  created_at: string;
}

interface DailyReportsResponse {
  date: string;
  vendors: VendorReport[];
  details: DailySaleDetail[];
}

interface Alarm {
  id: number;
  vendor_id: number;
  vendor_name: string;
  username: string;
  message: string;
  status: string;
  triggered_at: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmt(n: number, currency: string) {
  if (currency === "FC") {
    return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".") + " FC";
  }
  return "$" + n.toFixed(2);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function VendorReports() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayDate());
  const [expandedVendor, setExpandedVendor] = useState<number | null>(null);

  const { data: reportsData, isLoading: reportsLoading } = useQuery<DailyReportsResponse>({
    queryKey: ["/api/admin/vendor-daily-reports", selectedDate],
    queryFn: async () => {
      const r = await fetch(`/api/admin/vendor-daily-reports?date=${selectedDate}`, { credentials: "include" });
      if (!r.ok) throw new Error("Erreur");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: alarms = [], isLoading: alarmsLoading } = useQuery<Alarm[]>({
    queryKey: ["/api/admin/alarms"],
    queryFn: async () => {
      const r = await fetch("/api/admin/alarms", { credentials: "include" });
      if (!r.ok) throw new Error("Erreur");
      return r.json();
    },
    refetchInterval: 15_000,
  });

  const dismissMutation = useMutation({
    mutationFn: async (alarmId: number) => {
      const r = await fetch(`/api/admin/alarms/${alarmId}/dismiss`, {
        method: "POST", credentials: "include",
      });
      if (!r.ok) throw new Error("Erreur");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/alarms"] });
    },
  });

  const vendors = reportsData?.vendors ?? [];
  const details = reportsData?.details ?? [];

  const getVendorDetails = (vendorId: number) =>
    details.filter((d) => d.vendor_id === vendorId);

  const totalTickets = vendors.reduce((s, v) => s + parseInt(v.total_tickets || "0", 10), 0);
  const totalUsd = vendors.reduce((s, v) => s + parseFloat(v.total_usd || "0"), 0);
  const totalFc  = vendors.reduce((s, v) => s + parseFloat(v.total_fc  || "0"), 0);
  const closedCount = vendors.filter((v) => !!v.closed_at).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Journée vendeurs</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Suivi en temps réel — ventes, versements et clôtures</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-8 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/vendor-daily-reports"] })}
            className="h-8 w-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Active Alarms ── */}
      {alarmsLoading ? null : alarms.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
            <Siren className="w-3.5 h-3.5 animate-pulse" /> {alarms.length} alarme{alarms.length > 1 ? "s" : ""} active{alarms.length > 1 ? "s" : ""}
          </p>
          {alarms.map((alarm) => (
            <div key={alarm.id}
              className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-600/30 flex items-center justify-center shrink-0 mt-0.5">
                <Siren className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-red-300">{alarm.vendor_name}</span>
                  <span className="text-xs text-zinc-500">@{alarm.username}</span>
                </div>
                <p className="text-xs text-zinc-300 mt-0.5">{alarm.message}</p>
                <p className="text-[10px] text-zinc-600 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {fmtDate(alarm.triggered_at)}
                </p>
              </div>
              <button
                onClick={() => dismissMutation.mutate(alarm.id)}
                disabled={dismissMutation.isPending}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300 hover:text-white hover:border-zinc-500 transition-all"
              >
                {dismissMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                Traiter
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Global summary ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Vendeurs actifs",  value: String(vendors.length),   sub: "points de vente"    },
          { label: "Tickets vendus",   value: String(totalTickets),     sub: "aujourd'hui"         },
          { label: "Total USD",        value: fmt(totalUsd, "USD"),     sub: "à verser"            },
          { label: "Journées clôt.",   value: `${closedCount}/${vendors.length}`, sub: "fermées"   },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-lg font-black text-white leading-none">{value}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Per-vendor table ── */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Détail par vendeur — {selectedDate}</p>
        </div>

        {reportsLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg bg-zinc-800" />)}
          </div>
        ) : vendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-zinc-600">
            <AlertCircle className="w-6 h-6" />
            <p className="text-sm">Aucun vendeur actif trouvé.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {vendors.map((v) => {
              const tickets   = parseInt(v.total_tickets || "0", 10);
              const usd       = parseFloat(v.total_usd || "0");
              const fc        = parseFloat(v.total_fc  || "0");
              const isClosed  = !!v.closed_at;
              const expanded  = expandedVendor === v.vendor_id;
              const vDetails  = getVendorDetails(v.vendor_id);

              return (
                <div key={v.vendor_id}>
                  <button
                    className="w-full px-5 py-4 flex items-center gap-3 hover:bg-zinc-800/40 transition-colors text-left"
                    onClick={() => setExpandedVendor(expanded ? null : v.vendor_id)}
                  >
                    {/* Status icon */}
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
                      isClosed
                        ? "bg-green-900/30 border-green-700/50"
                        : "bg-zinc-800 border-zinc-700"
                    }`}>
                      {isClosed
                        ? <LockKeyhole className="w-3.5 h-3.5 text-green-400" />
                        : <UnlockKeyhole className="w-3.5 h-3.5 text-zinc-500" />}
                    </div>

                    {/* Vendor info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-white">{v.vendor_name}</span>
                        <span className="text-[10px] text-zinc-600 font-mono">@{v.username}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500 mt-0.5">
                        <MapPin className="w-3 h-3" /> {v.location}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Store className="w-3 h-3 text-zinc-600" />
                        <span className="text-xs font-bold text-zinc-300">{tickets} ticket{tickets !== 1 ? "s" : ""}</span>
                      </div>
                      {usd > 0 && <p className="text-xs font-black text-green-400">{fmt(usd, "USD")}</p>}
                      {fc  > 0 && <p className="text-xs font-black text-green-400">{fmt(fc, "FC")}</p>}
                      {tickets === 0 && <p className="text-xs text-zinc-600">—</p>}
                    </div>

                    {/* Closed badge */}
                    {isClosed && (
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-700/40">
                        Clôturé
                      </span>
                    )}
                    {!isClosed && tickets > 0 && (
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-700/30">
                        En cours
                      </span>
                    )}
                  </button>

                  {/* Expanded detail */}
                  {expanded && (
                    <div className="px-5 pb-4 pt-1 bg-zinc-950/40">
                      {isClosed && (
                        <div className="mb-3 flex items-center gap-2 text-xs text-green-500">
                          <LockKeyhole className="w-3 h-3" />
                          Clôturé le {fmtDate(v.closed_at!)}
                        </div>
                      )}

                      {vDetails.length === 0 ? (
                        <p className="text-xs text-zinc-600 py-2">Aucune vente enregistrée ce jour.</p>
                      ) : (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Ventes du jour</p>
                          {vDetails.map((d, i) => (
                            <div key={i} className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2">
                              <div>
                                <p className="text-xs font-bold text-zinc-300">
                                  {d.quantity} ticket{d.quantity > 1 ? "s" : ""} × {fmt(parseFloat(d.unit_amount), d.currency)}
                                </p>
                                <p className="text-[10px] text-zinc-600 flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3" /> {fmtTime(d.created_at)}
                                </p>
                              </div>
                              <span className="text-xs font-black text-green-400">{fmt(parseFloat(d.total_amount), d.currency)}</span>
                            </div>
                          ))}

                          {/* Totals row */}
                          <div className="flex items-center justify-between rounded-lg bg-green-900/20 border border-green-800/30 px-3 py-2.5 mt-2">
                            <div className="flex items-center gap-1.5">
                              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                              <span className="text-xs font-black text-green-300">Total à verser</span>
                            </div>
                            <div className="text-right">
                              {usd > 0 && <p className="text-xs font-black text-green-400">{fmt(usd, "USD")}</p>}
                              {fc  > 0 && <p className="text-xs font-black text-green-400">{fmt(fc, "FC")}</p>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {totalFc > 0 && (
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-400">Total FC à verser</span>
          <span className="text-sm font-black text-green-400">{fmt(totalFc, "FC")}</span>
        </div>
      )}

    </div>
  );
}
