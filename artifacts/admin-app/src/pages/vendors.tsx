import { useQuery } from "@tanstack/react-query";
import { Store, MapPin, Phone, Users, Ticket, TrendingUp, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Worker {
  userId: number;
  username: string;
  vendorId: number;
  vendorName: string;
  vendorLocation: string;
  vendorPhone: string | null;
  vendorStatus: string;
  totalTickets: number;
  totalScratched: number;
  totalRevenue: number;
  isSuspended: boolean;
}

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".");
}

export default function Vendors() {
  const { data: workers = [], isLoading } = useQuery<Worker[]>({
    queryKey: ["/api/admin/workers"],
    queryFn: async () => {
      const r = await fetch("/api/admin/workers", { credentials: "include" });
      if (!r.ok) throw new Error("Erreur");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const active   = workers.filter((w) => !w.isSuspended && w.vendorStatus === "active");
  const suspended = workers.filter((w) => w.isSuspended);
  const totalRevenue = workers.reduce((s, w) => s + w.totalRevenue, 0);
  const totalScratched = workers.reduce((s, w) => s + w.totalScratched, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-600/15 border border-indigo-600/25 flex items-center justify-center shrink-0">
          <Store className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Points de vente</h1>
          <p className="text-sm text-zinc-500">Carte géographique des revendeurs Halgo Cash</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total points",    value: workers.length,               color: "text-white",       icon: Store      },
          { label: "Actifs",          value: active.length,                color: "text-green-400",   icon: Users      },
          { label: "Tickets écoulés", value: totalScratched.toLocaleString("fr-FR"), color: "text-indigo-400", icon: Ticket },
          { label: "Revenus cumulés", value: formatFC(totalRevenue) + " FC", color: "text-yellow-400", icon: TrendingUp },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">{s.label}</p>
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
            </div>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Vendor grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : workers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-zinc-600">
          <AlertCircle className="w-10 h-10" />
          <p className="font-semibold">Aucun point de vente enregistré</p>
          <p className="text-sm text-zinc-700">Ajoutez des vendeurs depuis la section "Annuaire vendeurs"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {workers.map((w) => {
            const scratchRate = w.totalTickets > 0
              ? Math.round((w.totalScratched / w.totalTickets) * 100)
              : 0;
            const isActive = !w.isSuspended && w.vendorStatus === "active";
            return (
              <div
                key={w.vendorId}
                className={`rounded-xl border p-4 transition-all ${
                  isActive
                    ? "border-zinc-800/60 bg-zinc-900/50 hover:border-zinc-700"
                    : "border-red-500/20 bg-red-950/10 opacity-75"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-indigo-600/15 border border-indigo-600/25" : "bg-red-500/10 border border-red-500/20"}`}>
                      <Store className={`w-3.5 h-3.5 ${isActive ? "text-indigo-400" : "text-red-400"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{w.vendorName}</p>
                      <p className="text-xs text-zinc-500 truncate">{w.username}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    isActive
                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}>
                    {isActive ? "Actif" : "Suspendu"}
                  </span>
                </div>

                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <MapPin className="w-3 h-3 text-zinc-600 shrink-0" />
                    <span className="truncate">{w.vendorLocation}</span>
                  </div>
                  {w.vendorPhone && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Phone className="w-3 h-3 text-zinc-600 shrink-0" />
                      <span>{w.vendorPhone}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-center mb-3">
                  <div className="rounded-lg bg-zinc-800/40 px-2 py-1.5">
                    <p className="text-xs font-black text-indigo-400">{w.totalTickets.toLocaleString("fr-FR")}</p>
                    <p className="text-[9px] text-zinc-600 mt-0.5">Tickets</p>
                  </div>
                  <div className="rounded-lg bg-zinc-800/40 px-2 py-1.5">
                    <p className="text-xs font-black text-yellow-400">{formatFC(w.totalRevenue)} FC</p>
                    <p className="text-[9px] text-zinc-600 mt-0.5">Revenus</p>
                  </div>
                </div>

                {/* Scratch rate bar */}
                <div>
                  <div className="flex justify-between text-[9px] text-zinc-600 mb-1">
                    <span>Taux d'écoulement</span>
                    <span className="font-bold text-zinc-400">{scratchRate}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${scratchRate}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {suspended.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-red-400 px-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{suspended.length} point{suspended.length > 1 ? "s" : ""} de vente suspendu{suspended.length > 1 ? "s" : ""} · Gérez-les dans "Annuaire vendeurs"</span>
        </div>
      )}
    </div>
  );
}
