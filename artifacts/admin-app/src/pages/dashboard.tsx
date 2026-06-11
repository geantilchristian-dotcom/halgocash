import { useQuery } from "@tanstack/react-query";
import { useGetStats } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import {
  Ticket, TrendingUp, Trophy, Users, Users2, AlertCircle, Wifi,
  Star, LayoutGrid, ArrowDownLeft, Shield, MessageSquare,
  TrendingDown, Zap, RefreshCw, ChevronRight, Clock, BarChart2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

interface OnlineUser {
  clerkId: string;
  name: string;
  lastSeen: string;
}

interface PendingCounts {
  pendingWithdrawals: number;
  pendingKyc: number;
  unreadSupport: number;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

function KpiCard({
  label, value, sub, icon: Icon, accent = "zinc", trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "green" | "yellow" | "indigo" | "blue" | "zinc" | "red";
  trend?: "up" | "down" | "neutral";
}) {
  const colors = {
    green:  { bg: "bg-green-500/10 border-green-500/20",  icon: "text-green-400",  val: "text-green-400"  },
    yellow: { bg: "bg-yellow-500/10 border-yellow-500/20",icon: "text-yellow-400", val: "text-yellow-400" },
    indigo: { bg: "bg-indigo-500/10 border-indigo-500/20",icon: "text-indigo-400", val: "text-white"      },
    blue:   { bg: "bg-blue-500/10 border-blue-500/20",    icon: "text-blue-400",   val: "text-blue-400"   },
    zinc:   { bg: "bg-zinc-800/60 border-zinc-700/50",    icon: "text-zinc-400",   val: "text-white"      },
    red:    { bg: "bg-red-500/10 border-red-500/20",      icon: "text-red-400",    val: "text-red-400"    },
  };
  const c = colors[accent];
  return (
    <div className={`rounded-xl border p-4 ${c.bg} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-zinc-900/50`}>
          <Icon className={`w-3.5 h-3.5 ${c.icon}`} />
        </div>
      </div>
      <div>
        <p className={`text-2xl font-black tracking-tight ${c.val}`}>{value}</p>
        {sub && <p className="text-[11px] text-zinc-600 mt-0.5">{sub}</p>}
      </div>
      {trend && (
        <div className="flex items-center gap-1">
          {trend === "up"   && <TrendingUp   className="w-3 h-3 text-green-500" />}
          {trend === "down" && <TrendingDown className="w-3 h-3 text-red-500"   />}
          {trend === "neutral" && <Clock className="w-3 h-3 text-zinc-600" />}
        </div>
      )}
    </div>
  );
}

function AlertCard({
  label, count, href, icon: Icon, color,
}: {
  label: string;
  count: number;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: "red" | "amber" | "blue";
}) {
  const colors = {
    red:   { ring: "border-red-500/30 bg-red-500/5 hover:bg-red-500/10",   badge: "bg-red-500 text-white",   icon: "text-red-400"   },
    amber: { ring: "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10", badge: "bg-amber-500 text-white",icon: "text-amber-400" },
    blue:  { ring: "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10",  badge: "bg-blue-500 text-white", icon: "text-blue-400"  },
  };
  const c = colors[color];
  return (
    <Link href={href}>
      <div className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${c.ring}`}>
        <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-zinc-200 truncate">{label}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            {count === 0 ? "Aucun en attente" : `${count} en attente`}
          </p>
        </div>
        {count > 0 ? (
          <span className={`min-w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${c.badge}`}>
            {count > 99 ? "99+" : count}
          </span>
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
        )}
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading, refetch } = useGetStats({
    query: { queryKey: [], refetchInterval: 8_000 },
  });

  const { data: onlineUsers = [], refetch: refetchOnline } = useQuery<OnlineUser[]>({
    queryKey: ["/api/admin/online-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/online-users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 20_000,
  });

  const { data: counts } = useQuery<PendingCounts>({
    queryKey: ["/api/admin/pending-counts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/pending-counts", { credentials: "include" });
      if (!res.ok) return { pendingWithdrawals: 0, pendingKyc: 0, unreadSupport: 0 };
      return res.json();
    },
    refetchInterval: 20_000,
  });

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );

  if (!stats) return (
    <div className="flex items-center gap-2 text-red-400 p-6 rounded-xl border border-red-500/20 bg-red-500/5">
      <AlertCircle className="w-5 h-5 shrink-0" />
      <p className="font-medium">Impossible de charger les statistiques</p>
    </div>
  );

  const totalTickets = (stats.totalTicketsSold ?? 0) + (stats.totalAvailable ?? 0);
  const scratchRate = totalTickets > 0
    ? Math.round(((stats.totalTicketsSold ?? 0) / totalTickets) * 100)
    : 0;
  const netMargin = (stats.totalRevenue ?? 0) - (stats.totalPrizesPaid ?? 0);
  const marginRate = (stats.totalRevenue ?? 0) > 0
    ? Math.round((netMargin / (stats.totalRevenue ?? 1)) * 100)
    : 0;

  const totalAlerts = (counts?.pendingWithdrawals ?? 0) + (counts?.pendingKyc ?? 0) + (counts?.unreadSupport ?? 0);

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Hero revenue block */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/60 via-zinc-900 to-zinc-950 p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.12),transparent_60%)]" />
        <div className="relative">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-none">Vue financière</h1>
                <p className="text-[10px] text-zinc-500 mt-0.5">Mise à jour en temps réel</p>
              </div>
            </div>
            <button
              onClick={() => void refetch()}
              className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Revenus bruts</p>
              <p className="text-3xl font-black text-white tracking-tight">
                {formatCurrency(stats.totalRevenue ?? 0)}
              </p>
              <p className="text-[10px] text-zinc-600 mt-1">Prix des tickets grattés</p>
            </div>
            <div className="border-l border-zinc-800 pl-4">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Lots distribués</p>
              <p className="text-3xl font-black text-yellow-400 tracking-tight">
                − {formatCurrency(stats.totalPrizesPaid ?? 0)}
              </p>
              <p className="text-[10px] text-zinc-600 mt-1">Gains versés aux joueurs</p>
            </div>
            <div className="border-l border-zinc-800 pl-4">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Marge nette</p>
              <p className={`text-3xl font-black tracking-tight ${netMargin >= 0 ? "text-green-400" : "text-red-400"}`}>
                {formatCurrency(netMargin)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-700"
                    style={{ width: `${Math.max(0, Math.min(100, marginRate))}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-green-400 shrink-0">{marginRate}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Grattés"
          value={(stats.totalTicketsSold ?? 0).toLocaleString("fr-FR")}
          sub={`${scratchRate}% du stock`}
          icon={Ticket}
          accent="indigo"
        />
        <KpiCard
          label="Disponibles"
          value={(stats.totalAvailable ?? 0).toLocaleString("fr-FR")}
          sub="Non grattés"
          icon={LayoutGrid}
          accent="zinc"
        />
        <KpiCard
          label="Gagnants"
          value={(stats.recentWinners ?? 0).toLocaleString("fr-FR")}
          sub="Tickets activés"
          icon={Star}
          accent="yellow"
        />
        <KpiCard
          label="Vendeurs actifs"
          value={stats.activeVendors ?? 0}
          sub="Points de vente"
          icon={Users}
          accent="blue"
        />
        <KpiCard
          label="En ligne"
          value={onlineUsers.length}
          sub="Joueurs actifs"
          icon={Wifi}
          accent={onlineUsers.length > 0 ? "green" : "zinc"}
        />
        <KpiCard
          label="Alertes"
          value={totalAlerts}
          sub="Actions requises"
          icon={AlertCircle}
          accent={totalAlerts > 0 ? "red" : "zinc"}
        />
      </div>

      {/* Taux grattage visual */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Progression du stock
          </p>
          <span className="text-xs font-bold text-indigo-400">{scratchRate}% écoulé</span>
        </div>
        <div className="h-3 rounded-full bg-zinc-800 overflow-hidden relative">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-700"
            style={{ width: `${scratchRate}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-600 mt-1.5">
          <span>{(stats.totalTicketsSold ?? 0).toLocaleString("fr-FR")} grattés</span>
          <span>{totalTickets.toLocaleString("fr-FR")} total</span>
        </div>
      </div>

      {/* Two-column: actions requises + joueurs en ligne */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Actions requises */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className={`w-4 h-4 ${totalAlerts > 0 ? "text-red-400" : "text-zinc-600"}`} />
            <h3 className="text-sm font-semibold text-zinc-200">Actions requises</h3>
            {totalAlerts > 0 && (
              <span className="ml-auto text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                {totalAlerts} en attente
              </span>
            )}
          </div>
          <div className="space-y-2">
            <AlertCard
              label="Retraits joueurs"
              count={counts?.pendingWithdrawals ?? 0}
              href="/withdrawals"
              icon={ArrowDownLeft}
              color="amber"
            />
            <AlertCard
              label="Vérification KYC"
              count={counts?.pendingKyc ?? 0}
              href="/kyc"
              icon={Shield}
              color="red"
            />
            <AlertCard
              label="Support joueurs"
              count={counts?.unreadSupport ?? 0}
              href="/support"
              icon={MessageSquare}
              color="blue"
            />
          </div>
        </div>

        {/* Joueurs en ligne */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${onlineUsers.length > 0 ? "bg-green-500 animate-pulse" : "bg-zinc-700"}`} />
              <h3 className="text-sm font-semibold text-zinc-200">Joueurs en ligne</h3>
            </div>
            <span className="ml-auto text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
              {onlineUsers.length}
            </span>
            <button
              onClick={() => refetchOnline()}
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          {onlineUsers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-zinc-600">
              <Wifi className="w-8 h-8" />
              <p className="text-xs">Aucun joueur en ligne</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {onlineUsers.map((u) => (
                <div
                  key={u.clerkId}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/30"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  <span className="text-sm text-zinc-200 font-medium flex-1 truncate">{u.name}</span>
                  <span className="text-[10px] font-mono text-zinc-600 shrink-0">{u.clerkId.slice(-4)}</span>
                  <span className="text-[10px] text-zinc-600 shrink-0">{timeAgo(u.lastSeen)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Nav: stats summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/tickets",    label: "Historique tickets", sub: `${(stats.totalTicketsSold ?? 0).toLocaleString("fr-FR")} lots grattés`, icon: Ticket    },
          { href: "/players",    label: "Joueurs inscrits",   sub: "Voir le registre complet",             icon: Users2    },
          { href: "/winners",    label: "Classement gagnants",sub: `${(stats.recentWinners ?? 0)} gagnants actifs`, icon: Trophy   },
          { href: "/rapport",    label: "Rapport financier",  sub: "Transactions détaillées",              icon: BarChart2 },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-800/60 hover:border-zinc-700 transition-all cursor-pointer group">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 group-hover:bg-indigo-600/20 group-hover:border-indigo-600/30 transition-colors">
                <item.icon className="w-3.5 h-3.5 text-zinc-500 group-hover:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-300 truncate">{item.label}</p>
                <p className="text-[10px] text-zinc-600 truncate mt-0.5">{item.sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
