import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "../components/layout/app-layout";
import { useAuth } from "@/lib/auth-context";
import { ArrowDownLeft, Loader2, AlertCircle, Clock, CheckCircle2 } from "lucide-react";

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".");
}

interface Withdrawal {
  id: number;
  clerkName: string;
  amount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

export default function Historique() {
  const { user } = useAuth();

  const { data: withdrawals = [], isLoading, error } = useQuery<Withdrawal[]>({
    queryKey: ["/api/vendor/withdrawals/all"],
    queryFn: async () => {
      const res = await fetch("/api/vendor/withdrawals", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
    enabled: !!user?.vendorId,
  });

  return (
    <AppLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="text-center pt-1 pb-2">
          <h1 className="text-lg font-black uppercase tracking-wide text-gray-800">Historique</h1>
          <p className="text-[11px] text-gray-400 font-semibold mt-0.5">Retraits traités par vous</p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-7 h-7 animate-spin text-green-600" />
          </div>
        )}

        {(error || (!isLoading && withdrawals.length === 0)) && (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
            <AlertCircle className="w-9 h-9 text-gray-300" />
            <p className="text-sm font-semibold text-gray-400">Aucun retrait enregistré.</p>
          </div>
        )}

        {!isLoading && withdrawals.length > 0 && (
          <div className="space-y-2">
            {withdrawals.map((w) => {
              const isPaid = w.status === "paid";
              return (
                <div
                  key={w.id}
                  className="flex items-center gap-3 p-3.5 rounded-xl shadow-sm"
                  style={{
                    background: "#ffffff",
                    border: `1.5px solid ${isPaid ? "rgba(34,197,94,0.2)" : "rgba(234,179,8,0.25)"}`,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: isPaid ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.12)" }}
                  >
                    {isPaid
                      ? <CheckCircle2 className="w-4.5 h-4.5 text-green-600" style={{ width: 18, height: 18 }} />
                      : <Clock className="w-4.5 h-4.5 text-yellow-600" style={{ width: 18, height: 18 }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate text-gray-800">{w.clerkName}</p>
                    <p className="text-[10px] text-gray-400 font-semibold">
                      {new Date(w.paidAt ?? w.createdAt).toLocaleString("fr-FR", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-black text-sm ${isPaid ? "text-green-600" : "text-yellow-600"}`}>
                      {formatFC(w.amount)} FC
                    </p>
                    <span
                      className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                      style={{
                        background: isPaid ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.12)",
                        color: isPaid ? "#16a34a" : "#ca8a04",
                      }}
                    >
                      {isPaid ? "Payé" : "En attente"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
