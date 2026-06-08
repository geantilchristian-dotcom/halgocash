import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, Clock, CheckCircle, User, Store, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".");
}

interface WithdrawalRow {
  id: number;
  clerkId: string;
  clerkName: string;
  amount: number;
  token: string;
  status: string;
  paidByVendorId: number | null;
  paidByVendorName: string | null;
  paidAt: string | null;
  createdAt: string;
}

export default function WithdrawalsAdmin() {
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");

  const { data: rows = [], isLoading } = useQuery<WithdrawalRow[]>({
    queryKey: ["/api/admin/withdrawals"],
    queryFn: async () => {
      const res = await fetch("/api/admin/withdrawals", { credentials: "include" });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const filtered = rows.filter((r) => filter === "all" || r.status === filter);
  const totalPending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0);
  const totalPaid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Retraits joueurs</h2>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total demandes</CardTitle>
            <ArrowDownLeft className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{rows.length}</div></CardContent>
        </Card>
        <Card className="border-yellow-500/20">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">En attente</CardTitle>
            <Clock className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{rows.filter(r => r.status === "pending").length}</div>
            <p className="text-xs text-muted-foreground">{formatFC(totalPending)} FC à verser</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payés</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{rows.filter(r => r.status === "paid").length}</div>
            <p className="text-xs text-muted-foreground">{formatFC(totalPaid)} FC versés</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "pending", "paid"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {f === "all" ? "Tous" : f === "pending" ? "En attente" : "Payés"}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>Aucun retrait{filter !== "all" ? ` ${filter === "pending" ? "en attente" : "payé"}` : ""}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((w) => (
            <div key={w.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${w.status === "paid" ? "bg-green-500/15" : "bg-yellow-500/15"}`}>
                {w.status === "paid"
                  ? <CheckCircle className="w-4 h-4 text-green-600" />
                  : <Clock className="w-4 h-4 text-yellow-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-sm truncate">{w.clerkName}</span>
                  <Badge variant={w.status === "paid" ? "default" : "secondary"} className="shrink-0 text-[10px]">
                    {w.status === "paid" ? "Payé" : "En attente"}
                  </Badge>
                </div>
                {w.paidByVendorName && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Store className="w-3 h-3" />
                    <span>Payé par {w.paidByVendorName}</span>
                    {w.paidAt && <span>· {new Date(w.paidAt).toLocaleString("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}</span>}
                  </div>
                )}
                {!w.paidByVendorName && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Demandé {new Date(w.createdAt).toLocaleString("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-base">{formatFC(w.amount)}</p>
                <p className="text-xs text-muted-foreground">FC</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
