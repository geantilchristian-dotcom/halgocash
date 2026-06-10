import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, CheckCircle, XCircle, Clock, Eye, Loader2, ChevronDown } from "lucide-react";

interface KycRow {
  id: number;
  clerkId: string;
  fullName: string;
  birthDate: string;
  idType: string;
  idNumber: string;
  status: string;
  adminNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: "En attente",  color: "text-amber-400 bg-amber-500/10 border-amber-500/20",  icon: <Clock className="w-3.5 h-3.5" /> },
  approved: { label: "Approuvé",   color: "text-green-400 bg-green-500/10 border-green-500/20",  icon: <CheckCircle className="w-3.5 h-3.5" /> },
  rejected: { label: "Refusé",     color: "text-red-400 bg-red-500/10 border-red-500/20",        icon: <XCircle className="w-3.5 h-3.5" /> },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function KycAdmin() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [selected, setSelected] = useState<KycRow | null>(null);
  const [note, setNote] = useState("");

  const { data = [], isLoading } = useQuery<KycRow[]>({
    queryKey: ["/api/admin/kyc", filter],
    queryFn: async () => {
      const url = filter === "all" ? "/api/admin/kyc" : `/api/admin/kyc?status=${filter}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Erreur");
      return r.json();
    },
    refetchInterval: 15000,
  });

  const review = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: number; status: string; adminNote: string }) => {
      const r = await fetch(`/api/admin/kyc/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, adminNote }),
      });
      if (!r.ok) throw new Error("Erreur");
      return r.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["/api/admin/kyc"] });
      setSelected(null);
      setNote("");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6" /> Vérification KYC</h1>
        <p className="text-sm text-muted-foreground mt-1">Examinez et approuvez les dossiers d'identité des joueurs</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(["pending", "approved", "rejected", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize border transition-colors ${filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border bg-muted hover:bg-muted/80"}`}>
            {f === "all" ? "Tous" : f === "pending" ? "En attente" : f === "approved" ? "Approuvés" : "Refusés"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Nom</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">Date naissance</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">Pièce</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Statut</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden lg:table-cell">Soumis le</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucun dossier trouvé</td></tr>
            ) : data.map(row => {
              const s = STATUS_LABELS[row.status] ?? STATUS_LABELS["pending"]!;
              return (
                <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{row.fullName}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{row.birthDate}</td>
                  <td className="px-4 py-3 uppercase text-xs text-muted-foreground hidden md:table-cell">{row.idType}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.color}`}>
                      {s.icon}{s.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{fmt(row.submittedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setSelected(row); setNote(row.adminNote ?? ""); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-secondary hover:bg-secondary/80 transition-colors">
                      <Eye className="w-3.5 h-3.5" /> Examiner
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-background rounded-2xl border w-full max-w-md shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-lg">{selected.fullName}</h2>
                <p className="text-xs text-muted-foreground">Soumis le {fmt(selected.submittedAt)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-md hover:bg-muted transition-colors">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Date de naissance", selected.birthDate],
                ["Type de pièce", selected.idType.toUpperCase()],
                ["Numéro de pièce", selected.idNumber],
                ["ID Clerk", selected.clerkId.slice(0, 18) + "…"],
              ].map(([label, val]) => (
                <div key={label} className="rounded-lg bg-muted/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <p className="font-medium font-mono text-[13px]">{val}</p>
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Note admin (optionnel)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                className="w-full rounded-lg border bg-muted/20 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary resize-none" placeholder="Motif de refus ou note…" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => review.mutate({ id: selected.id, status: "approved", adminNote: note })}
                disabled={review.isPending}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white disabled:opacity-60 transition-colors">
                {review.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Approuver
              </button>
              <button onClick={() => review.mutate({ id: selected.id, status: "rejected", adminNote: note })}
                disabled={review.isPending}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 transition-colors">
                {review.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Refuser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
