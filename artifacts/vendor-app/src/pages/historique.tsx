import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "../components/layout/app-layout";
import { useAuth } from "@/lib/auth-context";
import {
  Loader2, AlertCircle, CheckCircle2,
  Phone, MapPin, Calendar, ChevronDown, ChevronUp, User,
} from "lucide-react";

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
  clientPostNom: string | null;
  clientPhone: string | null;
  clientAge: string | null;
  clientAddress: string | null;
}

export default function Historique() {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: withdrawals = [], isLoading, error } = useQuery<Withdrawal[]>({
    queryKey: ["/api/vendor/withdrawals"],
    queryFn: async () => {
      const res = await fetch("/api/vendor/withdrawals", { credentials: "include" });
      if (!res.ok) return [];
      return res.json() as Promise<Withdrawal[]>;
    },
    refetchInterval: 30_000,
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const hasProfile = (w: Withdrawal) =>
    !!(w.clientPhone || w.clientAge || w.clientAddress || w.clientPostNom);

  return (
    <AppLayout>
      <div className="space-y-4">

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
              const isOpen = expanded === w.id;
              const profile = hasProfile(w);

              return (
                <div
                  key={w.id}
                  className="rounded-xl shadow-sm overflow-hidden"
                  style={{
                    background: "#ffffff",
                    border: `1.5px solid ${isPaid ? "rgba(34,197,94,0.2)" : "rgba(234,179,8,0.25)"}`,
                  }}
                >
                  {/* Ligne principale */}
                  <div className="flex items-center gap-3 p-3.5">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: isPaid ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.12)" }}
                    >
                      <CheckCircle2
                        style={{ width: 18, height: 18 }}
                        className={isPaid ? "text-green-600" : "text-yellow-600"}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate text-gray-800">{w.clerkName}</p>
                      {w.clientPostNom && (
                        <p className="text-[10px] text-gray-400 font-semibold truncate">
                          Post-nom : {w.clientPostNom}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 font-semibold">
                        {new Date(w.paidAt ?? w.createdAt).toLocaleString("fr-FR", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
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

                    {profile && (
                      <button
                        onClick={() => setExpanded(isOpen ? null : w.id)}
                        className="ml-1 p-1 rounded-full text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                      >
                        {isOpen
                          ? <ChevronUp style={{ width: 16, height: 16 }} />
                          : <ChevronDown style={{ width: 16, height: 16 }} />}
                      </button>
                    )}
                  </div>

                  {/* Détails profil dépliables */}
                  {profile && isOpen && (
                    <div
                      className="border-t divide-y"
                      style={{ borderColor: "rgba(0,0,0,0.06)", background: "rgba(249,250,251,1)" }}
                    >
                      <div className="px-4 py-2 flex items-center gap-2">
                        <User style={{ width: 13, height: 13 }} className="text-gray-400 shrink-0" />
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide w-20 shrink-0">Compte</span>
                        <span className="text-xs font-bold text-gray-700">{w.clerkName}</span>
                      </div>
                      {w.clientPostNom && (
                        <div className="px-4 py-2 flex items-center gap-2">
                          <User style={{ width: 13, height: 13 }} className="text-gray-400 shrink-0" />
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide w-20 shrink-0">Post-nom</span>
                          <span className="text-xs font-bold text-gray-700">{w.clientPostNom}</span>
                        </div>
                      )}
                      {w.clientPhone && (
                        <div className="px-4 py-2 flex items-center gap-2">
                          <Phone style={{ width: 13, height: 13 }} className="text-gray-400 shrink-0" />
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide w-20 shrink-0">Téléphone</span>
                          <span className="text-xs font-bold text-gray-700">{w.clientPhone}</span>
                        </div>
                      )}
                      {w.clientAge && (
                        <div className="px-4 py-2 flex items-center gap-2">
                          <Calendar style={{ width: 13, height: 13 }} className="text-gray-400 shrink-0" />
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide w-20 shrink-0">Âge</span>
                          <span className="text-xs font-bold text-gray-700">{w.clientAge} ans</span>
                        </div>
                      )}
                      {w.clientAddress && (
                        <div className="px-4 py-2 flex items-center gap-2">
                          <MapPin style={{ width: 13, height: 13 }} className="text-gray-400 shrink-0" />
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide w-20 shrink-0">Adresse</span>
                          <span className="text-xs font-bold text-gray-700">{w.clientAddress}</span>
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
    </AppLayout>
  );
}
