import { useGetStats } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket, DollarSign, Trophy, Users, AlertCircle, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetStats();

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!stats) return <div className="text-destructive flex items-center"><AlertCircle className="mr-2" /> Failed to load stats</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">System Overview</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tickets Sold</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTicketsSold.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prizes Paid</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{formatCurrency(stats.totalPrizesPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Vendors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeVendors}</div>
          </CardContent>
        </Card>
      </div>

      {stats.activeDraw && (
        <Card className="border-primary/50 shadow-sm overflow-hidden">
          <div className="bg-primary/10 px-6 py-3 border-b border-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Activity className="h-4 w-4" /> Active Draw #{stats.activeDraw.drawNumber}
            </div>
            <div className="text-sm text-primary/80">Scheduled: {formatDate(stats.activeDraw.scheduledAt)}</div>
          </div>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Jackpot</div>
                <div className="text-3xl font-bold">{formatCurrency(stats.activeDraw.jackpotAmount)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Prize Pool</div>
                <div className="text-2xl font-semibold text-muted-foreground">{formatCurrency(stats.activeDraw.prizePool)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Tickets Sold</div>
                <div className="text-2xl font-semibold text-muted-foreground">{stats.activeDraw.totalTicketsSold.toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
