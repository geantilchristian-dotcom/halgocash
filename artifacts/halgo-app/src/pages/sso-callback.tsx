import { AuthenticateWithRedirectCallback } from "@clerk/react";
import { Loader2 } from "lucide-react";

export default function SsoCallbackPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center"
      style={{ background: "linear-gradient(160deg, #0a2e14 0%, #0f3d1c 100%)" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-end leading-none">
          <span className="text-[36px] font-black text-white tracking-tight">HALGO</span>
        </div>
        <div className="flex items-center -mt-3">
          <span className="text-[36px] font-black italic text-[#3aab3a] tracking-tight">CASH</span>
          <span className="text-[28px] font-black text-[#F5C518]">⚡</span>
        </div>
        <Loader2 className="w-8 h-8 animate-spin text-[#3aab3a] mt-2" />
        <p className="text-white/50 text-sm">Connexion en cours…</p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
