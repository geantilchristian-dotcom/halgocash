import { useQuery } from "@tanstack/react-query";
import { useGetStats } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket, DollarSign, Trophy, Users, AlertCircle, Activity, Wifi } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface OnlineUser {
  clerkId: string;
  name: string;
  lastSeen: string;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  return `il y a ${Math.floor(diff / 3600)}h`;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useGetStats();

  const { data: onlineUsers = [], refetch: refetchOnline } = useQuery<OnlineUser[]>({
    queryKey: ["/api/admin/online-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/online-users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
  });

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
  if (!stats) return (
    <div className="text-destructive flex items-center">
      <AlertCircle className="mr-2" /> Impossible de charger les statistiques
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Tableau de bord</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenus totaux</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tickets vendus</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTicketsSold.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prix distribués</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{formatCurrency(stats.totalPrizesPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendeurs actifs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeVendors}</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Draw */}
      {stats.activeDraw && (
        <Card className="border-primary/50 shadow-sm overflow-hidden">
          <div className="bg-primary/10 px-6 py-3 border-b border-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Activity className="h-4 w-4" /> Tirage actif #{stats.activeDraw.drawNumber}
            </div>
            <div className="text-sm text-primary/80">
              {new Date(stats.activeDraw.scheduledAt).toLocaleDateString("fr-FR")}
            </div>
          </div>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Jackpot</div>
                <div className="text-3xl font-bold">{formatCurrency(stats.activeDraw.jackpotAmount)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Cagnotte</div>
                <div className="text-2xl font-semibold text-muted-foreground">{formatCurrency(stats.activeDraw.prizePool)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Tickets vendus</div>
                <div className="text-2xl font-semibold text-muted-foreground">{stats.activeDraw.totalTicketsSold.toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Online Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-green-500" />
            <CardTitle className="text-base">Utilisateurs en ligne</CardTitle>
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/15 text-green-400 border border-green-500/30">
              {onlineUsers.length}
            </span>
          </div>
          <button
            onClick={() => refetchOnline()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Actualiser
          </button>
        </CardHeader>
        <CardContent>
          {onlineUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun utilisateur en ligne pour le moment
            </p>
          ) : (
            <div className="space-y-2">
              {onlineUsers.map((u) => (
                <div key={u.clerkId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                    <span className="text-sm font-medium">{u.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{u.clerkId.slice(-6)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(u.lastSeen)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
