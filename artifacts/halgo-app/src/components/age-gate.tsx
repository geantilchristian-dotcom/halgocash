import { useState, useEffect } from "react";
import { Shield, AlertTriangle } from "lucide-react";

const STORAGE_KEY = "halgo_age_confirmed";

export function AgeGate({ children }: { children: React.ReactNode }) {
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      setConfirmed(v === "1");
    } catch {
      setConfirmed(true);
    }
  }, []);

  if (confirmed === null) return null;

  if (confirmed) return <>{children}</>;

  if (declined) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center" style={{ background: "#0b1612" }}>
        <AlertTriangle style={{ width: 48, height: 48, color: "#ef4444", marginBottom: 16 }} />
        <p className="text-white font-black text-xl uppercase">Accès refusé</p>
        <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.5)" }}>
          Halgo Cash est réservé aux personnes majeures (+18 ans).
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6" style={{ background: "#0b1612" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-baseline gap-0 justify-center">
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 900, fontSize: "2.2rem", color: "#ffffff", fontStyle: "italic" }}>halgo</span>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 900, fontSize: "2.2rem", color: "#8DC63F", fontStyle: "italic" }}>Cash</span>
          </div>
        </div>

        <div className="rounded-3xl p-6 text-center" style={{ background: "#0f1f14", border: "1px solid rgba(141,198,63,0.2)" }}>
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4"
            style={{ background: "rgba(141,198,63,0.15)", border: "1px solid rgba(141,198,63,0.3)" }}>
            <Shield style={{ width: 28, height: 28, color: "#8DC63F" }} />
          </div>

          <p className="text-white font-black text-lg uppercase tracking-wide">Vérification d'âge</p>
          <p className="text-[13px] mt-2 mb-5 leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>
            Halgo Cash est un service de loterie réservé aux personnes majeures.
            Vous devez avoir <strong style={{ color: "#fff" }}>18 ans ou plus</strong> pour accéder à cette plateforme.
          </p>

          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Quel est votre âge ?</p>
            <button
              onClick={() => { try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ } setConfirmed(true); }}
              className="w-full py-4 rounded-2xl font-black text-[15px] uppercase tracking-widest transition-all active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg,#1a6b2f,#22a84a)", color: "#fff", boxShadow: "0 4px 20px rgba(34,168,74,0.35)" }}
            >
              J'ai 18 ans ou plus
            </button>
            <button
              onClick={() => setDeclined(true)}
              className="w-full py-3 rounded-2xl font-semibold text-[13px] uppercase tracking-wide"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              J'ai moins de 18 ans
            </button>
          </div>

          <p className="text-[9px] mt-4 leading-snug" style={{ color: "rgba(255,255,255,0.2)" }}>
            En poursuivant, vous confirmez être majeur et acceptez notre politique de jeu responsable.
          </p>
        </div>
      </div>
    </div>
  );
}
