import { useState, useEffect, useCallback } from "react";
import { X, Loader2, CheckCircle, AlertCircle, Smartphone } from "lucide-react";

const NETWORKS = [
  { id: "VODACOM_MPESA", label: "M-Pesa", color: "#E40613", prefix: "+24381" },
  { id: "AIRTEL_MONEY",  label: "Airtel Money", color: "#FF0000", prefix: "+24399" },
  { id: "ORANGE_MONEY",  label: "Orange Money", color: "#FF6600", prefix: "+24384" },
] as const;

type Step = "form" | "pending" | "success" | "error";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: (amount: number, currency: string) => void;
}

export function MobileMoneyModal({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "CDF">("USD");
  const [phone, setPhone] = useState("+243");
  const [network, setNetwork] = useState<string>("VODACOM_MPESA");
  const [chargeId, setChargeId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("form");
        setAmount("");
        setPhone("+243");
        setNetwork("VODACOM_MPESA");
        setChargeId(null);
        setMessage("");
        setErrorMsg("");
        setPollCount(0);
      }, 300);
    }
  }, [open]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setStep("pending");

    try {
      const res = await fetch("/api/payments/mobile-money/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency,
          phone,
          network,
        }),
      });
      const data = await res.json() as { chargeId?: string; status?: string; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur serveur");
      setChargeId(data.chargeId ?? null);
      setMessage(data.message ?? "Confirmez sur votre téléphone.");
      setPollCount(0);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
      setStep("error");
    }
  }, [amount, currency, phone, network]);

  // Polling du statut
  useEffect(() => {
    if (step !== "pending" || !chargeId) return;
    if (pollCount >= 24) { // 2 minutes max
      setErrorMsg("Délai dépassé. Vérifiez votre téléphone et réessayez.");
      setStep("error");
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/payments/mobile-money/status/${chargeId}`, { credentials: "include" });
        const data = await res.json() as { status?: string; amount?: number; currency?: string };
        if (data.status === "successful" || data.status === "success" || data.status === "completed") {
          setStep("success");
          onSuccess?.(parseFloat(amount), currency);
        } else if (data.status === "failed" || data.status === "cancelled") {
          setErrorMsg("Paiement refusé ou annulé.");
          setStep("error");
        } else {
          setPollCount((c) => c + 1);
        }
      } catch {
        setPollCount((c) => c + 1);
      }
    }, 5000);
    return () => clearTimeout(t);
  }, [step, chargeId, pollCount, amount, currency, onSuccess]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%", maxWidth: 480,
          background: "linear-gradient(160deg, #040d06 0%, #071a0b 60%, #0b2614 100%)",
          borderRadius: "1.5rem 1.5rem 0 0",
          padding: "1.5rem 1.25rem 2.5rem",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <Smartphone style={{ width: 20, height: 20, color: "#8DC63F" }} />
            <span style={{ color: "#fff", fontWeight: 800, fontSize: "1rem" }}>Recharger via Mobile Money</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 4 }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* ── FORMULAIRE ── */}
        {step === "form" && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Réseau */}
            <div>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Réseau</p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {NETWORKS.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setNetwork(n.id)}
                    style={{
                      flex: 1, padding: "0.625rem 0.25rem",
                      borderRadius: "0.75rem",
                      border: network === n.id ? `2px solid ${n.color}` : "1px solid rgba(255,255,255,0.1)",
                      background: network === n.id ? `${n.color}18` : "rgba(255,255,255,0.04)",
                      color: network === n.id ? n.color : "rgba(255,255,255,0.5)",
                      fontWeight: 700, fontSize: "0.72rem",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Devise */}
            <div>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Devise</p>
              <div style={{ display: "flex", borderRadius: "0.75rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                {(["USD", "CDF"] as const).map((c) => (
                  <button key={c} type="button" onClick={() => setCurrency(c)}
                    style={{
                      flex: 1, padding: "0.6rem",
                      background: currency === c ? "#8DC63F" : "rgba(255,255,255,0.04)",
                      color: currency === c ? "#0a1f0e" : "rgba(255,255,255,0.5)",
                      fontWeight: 800, fontSize: "0.8rem",
                      border: "none", cursor: "pointer", transition: "all 0.15s",
                    }}
                  >{c}</button>
                ))}
              </div>
            </div>

            {/* Montant */}
            <div>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Montant</p>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", fontWeight: 700, fontSize: "0.875rem" }}>
                  {currency === "USD" ? "$" : "FC"}
                </span>
                <input
                  type="number" min="1" step="any" placeholder="0.00" required
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  style={{
                    width: "100%", height: "3rem", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "0.75rem", paddingLeft: "2.25rem", paddingRight: "1rem",
                    color: "#fff", fontSize: "1rem", fontWeight: 700, outline: "none",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(141,198,63,0.5)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>
            </div>

            {/* Téléphone */}
            <div>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Numéro de téléphone</p>
              <input
                type="tel" placeholder="+243810000000" required
                value={phone} onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: "100%", height: "3rem", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0.75rem", padding: "0 1rem",
                  color: "#fff", fontSize: "0.9rem", outline: "none",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(141,198,63,0.5)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              />
              <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.68rem", marginTop: "0.35rem" }}>Format : +243 suivi de 9 chiffres</p>
            </div>

            <button
              type="submit"
              style={{
                width: "100%", height: "3rem", marginTop: "0.25rem",
                background: "linear-gradient(135deg, #5a9e1a 0%, #8DC63F 50%, #6db82a 100%)",
                border: "none", borderRadius: "0.875rem",
                color: "#071a0b", fontWeight: 800, fontSize: "0.9rem",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                boxShadow: "0 4px 20px rgba(141,198,63,0.3)",
              }}
            >
              Initier le paiement
            </button>
          </form>
        )}

        {/* ── EN ATTENTE ── */}
        {step === "pending" && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <Loader2 style={{ width: 48, height: 48, color: "#8DC63F", margin: "0 auto 1rem" }} className="animate-spin" />
            <p style={{ color: "#fff", fontWeight: 800, fontSize: "1.05rem", marginBottom: "0.5rem" }}>En attente de confirmation</p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.82rem", lineHeight: 1.6, maxWidth: 280, margin: "0 auto" }}>
              {message || "Vérifiez votre téléphone et confirmez le paiement."}
            </p>
            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.7rem", marginTop: "1.5rem" }}>
              Vérification automatique toutes les 5 secondes…
            </p>
          </div>
        )}

        {/* ── SUCCÈS ── */}
        {step === "success" && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <CheckCircle style={{ width: 48, height: 48, color: "#8DC63F", margin: "0 auto 1rem" }} />
            <p style={{ color: "#8DC63F", fontWeight: 800, fontSize: "1.1rem", marginBottom: "0.5rem" }}>Paiement confirmé !</p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>
              {amount} {currency} ajoutés à votre compte.
            </p>
            <button
              onClick={onClose}
              style={{
                marginTop: "1.5rem", padding: "0.75rem 2rem",
                background: "#8DC63F", border: "none", borderRadius: "0.875rem",
                color: "#0a1f0e", fontWeight: 800, cursor: "pointer", fontSize: "0.9rem",
              }}
            >
              Fermer
            </button>
          </div>
        )}

        {/* ── ERREUR ── */}
        {step === "error" && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <AlertCircle style={{ width: 48, height: 48, color: "#f87171", margin: "0 auto 1rem" }} />
            <p style={{ color: "#f87171", fontWeight: 800, fontSize: "1rem", marginBottom: "0.5rem" }}>Échec du paiement</p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.82rem", marginBottom: "1.5rem" }}>{errorMsg}</p>
            <button
              onClick={() => setStep("form")}
              style={{
                padding: "0.75rem 2rem",
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "0.875rem", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem",
              }}
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
