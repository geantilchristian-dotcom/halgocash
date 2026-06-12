import { AuthenticateWithRedirectCallback } from "@clerk/react";
import { Loader2 } from "lucide-react";

export default function SsoCallbackPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0a2e14]">
      <div className="flex items-baseline gap-0 mb-8">
        <span style={{
          fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif",
          fontWeight: 900, fontStyle: "italic",
          fontSize: "2.5rem", color: "#ffffff",
          letterSpacing: "-0.02em",
        }}>halgo</span>
        <span style={{
          fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif",
          fontWeight: 900, fontStyle: "italic",
          fontSize: "2.5rem", color: "#8DC63F",
          letterSpacing: "-0.02em",
        }}>Cash</span>
      </div>
      <Loader2 className="w-8 h-8 animate-spin text-[#8DC63F] mb-4" />
      <p className="text-white/50 text-sm">Connexion en cours…</p>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
