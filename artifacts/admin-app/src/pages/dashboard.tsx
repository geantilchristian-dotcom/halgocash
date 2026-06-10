import { useQuery } from "@tanstack/react-query";
import { useGetStats } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket, TrendingUp, Trophy, Users, AlertCircle, Wifi, Star, LayoutGrid } from "lucide-react";
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
  const { data: stats, isLoading } = useGetStats({ query: { queryKey: [], refetchInterval: 8_000 } });

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

  const totalTickets = (stats.totalTicketsSold ?? 0) + (stats.totalAvailable ?? 0);
  const scratchRate = totalTickets > 0
    ? Math.round(((stats.totalTicketsSold ?? 0) / totalTickets) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Tableau de bord</h2>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
          Temps réel
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

        {/* Revenus */}
        <Card className="border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenus totaux</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(stats.totalRevenue ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Prix des tickets grattés
            </p>
          </CardContent>
        </Card>

        {/* Tickets grattés */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tickets grattés</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.totalTicketsSold ?? 0).toLocaleString("fr-FR")}
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Taux de grattage</span>
                <span className="font-semibold">{scratchRate}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${scratchRate}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets disponibles */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tickets disponibles</CardTitle>
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.totalAvailable ?? 0).toLocaleString("fr-FR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pas encore grattés
            </p>
          </CardContent>
        </Card>

        {/* Prix distribués */}
        <Card className="border-yellow-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prix distribués</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {formatCurrency(stats.totalPrizesPaid ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gains versés aux joueurs
            </p>
          </CardContent>
        </Card>

        {/* Gagnants */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gagnants</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.recentWinners ?? 0).toLocaleString("fr-FR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tickets gagnants activés
            </p>
          </CardContent>
        </Card>

        {/* Vendeurs actifs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendeurs actifs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeVendors ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Points de vente actifs
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Margin summary */}
      {(stats.totalRevenue ?? 0) > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Revenus bruts</p>
                <p className="text-lg font-bold">{formatCurrency(stats.totalRevenue ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Lots versés</p>
                <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                  − {formatCurrency(stats.totalPrizesPaid ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Marge nette</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency((stats.totalRevenue ?? 0) - (stats.totalPrizesPaid ?? 0))}
                </p>
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
