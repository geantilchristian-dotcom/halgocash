import { useState } from "react";
import { AppLayout } from "../components/layout/app-layout";
import { QrCode, Search, CheckCircle, AlertCircle, Loader2, User, Banknote, X, Camera } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { QrScanner } from "@/components/qr-scanner";

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".");
}

interface WithdrawalInfo {
  id: number;
  clerkId: string;
  clerkName: string;
  amount: number;
  token: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

export default function ScanRetrait() {
  const { user } = useAuth();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [withdrawal, setWithdrawal] = useState<WithdrawalInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const lookup = async () => {
    const t = token.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    setWithdrawal(null);
    setPaid(false);
    try {
      const res = await fetch(`/api/withdrawals/${encodeURIComponent(t)}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Introuvable"); return; }
      setWithdrawal(data);
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const confirmPay = async () => {
    if (!withdrawal) return;
    setPaying(true);
    setError(null);
    try {
      const res = await fetch(`/api/withdrawals/${encodeURIComponent(withdrawal.token)}/pay`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur"); return; }
      setPaid(true);
      setWithdrawal({ ...withdrawal, status: "paid", paidAt: data.paidAt });
    } catch {
      setError("Erreur réseau");
    } finally {
      setPaying(false);
    }
  };

  const reset = () => {
    setToken(""); setWithdrawal(null); setError(null); setPaid(false);
  };

  const handleScanResult = (value: string) => {
    setShowScanner(false);
    const cleaned = value.trim();
    setToken(cleaned);
    setError(null);
    setWithdrawal(null);
    setPaid(false);
    // Auto-trigger lookup after scan
    setTimeout(async () => {
      if (!cleaned) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/withdrawals/${encodeURIComponent(cleaned)}`, { credentials: "include" });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? "Introuvable"); return; }
        setWithdrawal(data as WithdrawalInfo);
      } catch {
        setError("Erreur réseau");
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  if (!user?.vendorId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground font-semibold">
            Cette fonctionnalité est réservée aux vendeurs enregistrés.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* QR Scanner overlay */}
      {showScanner && (
        <QrScanner
          onResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Scanner un Retrait</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scannez le QR du joueur ou saisissez son code manuellement.
          </p>
        </div>

        {/* Scan button (big primary action) */}
        <button
          onClick={() => setShowScanner(true)}
          className="w-full h-16 rounded-2xl font-black uppercase tracking-widest text-base flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #F5C518, #d4a017)", color: "#0a1f0e" }}
        >
          <Camera className="w-6 h-6" />
          SCANNER LE QR CODE
        </button>

        {/* Separator */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">ou saisie manuelle</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Token input */}
        <div className="space-y-3">
          <div className="relative">
            <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={token}
              onChange={(e) => { setToken(e.target.value.trim()); setError(null); setWithdrawal(null); setPaid(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") void lookup(); }}
              placeholder="Collez ou saisissez le token de retrait..."
              className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 font-mono text-sm outline-none transition-all"
              style={{ borderColor: error ? "#ef4444" : "rgba(0,0,0,0.15)" }}
            />
          </div>
          <button
            onClick={lookup}
            disabled={!token.trim() || loading}
            className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 bg-black text-white disabled:opacity-40 transition-all active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Recherche..." : "RECHERCHER"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        {/* Withdrawal card */}
        {withdrawal && (
          <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: paid ? "#22c55e" : "#f5c518" }}>
            {/* Header */}
            <div className="px-5 py-3 flex items-center justify-between"
              style={{ background: paid ? "#22c55e" : "#f5c518" }}>
              <div className="flex items-center gap-2">
                {paid
                  ? <CheckCircle className="w-5 h-5 text-white" />
                  : <Banknote className="w-5 h-5 text-[#0a1f0e]" />}
                <span className="font-black uppercase tracking-wide text-sm"
                  style={{ color: paid ? "#fff" : "#0a1f0e" }}>
                  {paid ? "PAYÉ ✓" : "EN ATTENTE DE PAIEMENT"}
                </span>
              </div>
              <button onClick={reset} className="p-1 rounded-full" style={{ color: paid ? "#fff" : "#0a1f0e" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Details */}
            <div className="p-5 space-y-4 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <p className="font-black text-lg">{withdrawal.clerkName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{withdrawal.clerkId.slice(0, 16)}…</p>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-semibold">Montant à payer</span>
                <span className="text-2xl font-black text-green-600">{formatFC(withdrawal.amount)} FC</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>
                  <p className="uppercase tracking-wider font-bold mb-0.5">Statut</p>
                  <p className="font-bold text-foreground capitalize">{withdrawal.status === "paid" ? "Payé" : "En attente"}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wider font-bold mb-0.5">Demandé le</p>
                  <p className="font-bold text-foreground">{new Date(withdrawal.createdAt).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>

              {!paid && withdrawal.status !== "paid" && (
                <button
                  onClick={confirmPay}
                  disabled={paying}
                  className="w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #F5C518, #d4a017)", color: "#0a1f0e" }}
                >
                  {paying
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CheckCircle className="w-4 h-4" />}
                  {paying ? "Traitement..." : "CONFIRMER LE PAIEMENT"}
                </button>
              )}

              {(paid || withdrawal.status === "paid") && (
                <div className="text-center py-2">
                  <p className="text-green-600 font-black text-sm">✓ Paiement enregistré dans votre rapport</p>
                  {withdrawal.paidAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(withdrawal.paidAt).toLocaleString("fr-FR")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        {!withdrawal && !loading && (
          <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Comment ça marche</p>
            <ol className="text-sm space-y-1.5 text-foreground/80">
              <li className="flex gap-2"><span className="font-bold text-primary">1.</span> Le joueur génère un code QR depuis son app Halgo Cash</li>
              <li className="flex gap-2"><span className="font-bold text-primary">2.</span> Scannez son code ou copiez le token affiché</li>
              <li className="flex gap-2"><span className="font-bold text-primary">3.</span> Collez-le ci-dessus et cliquez Rechercher</li>
              <li className="flex gap-2"><span className="font-bold text-primary">4.</span> Vérifiez l'identité et confirmez le paiement en espèces</li>
            </ol>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
