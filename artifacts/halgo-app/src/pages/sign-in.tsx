import { useState } from "react";
import { useSignIn, useClerk } from "@clerk/react";
import { Link } from "wouter";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const logoUrl = `${import.meta.env.BASE_URL}logo-halgo-cash-nobg.png`;

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default function SignInPage() {
  const signIn = useSignIn() as any;
  const { setActive } = useClerk();

  const [phone, setPhone]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signIn.create({
        identifier: phone.includes("@") ? phone : `+243${phone.replace(/\D/g, "")}`,
        password,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
      }
    } catch (err: unknown) {
      const e = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(e.errors?.[0]?.longMessage ?? e.errors?.[0]?.message ?? "Numéro ou mot de passe incorrect");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!signIn) return;
    setGoogleLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${basePath}/sso-callback`,
        redirectUrlComplete: `${basePath}/app`,
      });
    } catch {
      setGoogleLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes mil-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: .18; }
          50%       { transform: translateY(-22px) rotate(180deg); opacity: .32; }
        }
        @keyframes mil-float2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: .12; }
          50%       { transform: translateY(18px) rotate(-120deg); opacity: .28; }
        }
        @keyframes mil-pulse-ring {
          0%   { transform: scale(0.85); opacity: .3; }
          70%  { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(0.85); opacity: 0; }
        }
        @keyframes mil-slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mil-logo-pop {
          0%   { opacity: 0; transform: scale(0.7) translateY(-10px); }
          60%  { transform: scale(1.05) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes mil-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .mil-logo   { animation: mil-logo-pop   0.7s cubic-bezier(.34,1.56,.64,1) both; }
        .mil-title  { animation: mil-slide-up   0.55s 0.2s ease-out both; }
        .mil-form   { animation: mil-slide-up   0.55s 0.35s ease-out both; }
        .mil-btn-shine {
          background-size: 200% auto;
          background-image: linear-gradient(90deg, #2563eb 0%, #3b82f6 40%, #60a5fa 60%, #2563eb 100%);
          animation: mil-shimmer 3s linear infinite;
        }
      `}</style>

      <div
        className="min-h-dvh flex flex-col overflow-hidden relative"
        style={{ background: "linear-gradient(160deg, #0a1628 0%, #0f2040 40%, #1a3060 70%, #0d1c3a 100%)" }}
      >
        {/* ── Animated floating shapes ── */}
        {[
          { w: 260, h: 260, top: "-60px", right: "-60px", anim: "mil-float 7s ease-in-out infinite", color: "#1e40af" },
          { w: 180, h: 180, bottom: "80px", left: "-50px",  anim: "mil-float2 9s ease-in-out infinite 1s", color: "#1d4ed8" },
          { w: 120, h: 120, top: "40%",    right: "10px",  anim: "mil-float 11s ease-in-out infinite 2s", color: "#2563eb" },
          { w: 90,  h: 90,  bottom: "20%", left: "20px",   anim: "mil-float2 8s ease-in-out infinite 3s", color: "#3b82f6" },
        ].map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: s.w, height: s.h,
              top: (s as any).top, right: (s as any).right,
              bottom: (s as any).bottom, left: (s as any).left,
              background: `radial-gradient(circle, ${s.color} 0%, transparent 70%)`,
              filter: "blur(30px)",
              animation: s.anim,
            }}
          />
        ))}

        {/* ── Pulsing ring behind logo ── */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "5%", left: "50%",
            transform: "translateX(-50%)",
            width: 160, height: 160,
            borderRadius: "50%",
            border: "2px solid rgba(59,130,246,0.4)",
            animation: "mil-pulse-ring 2.5s ease-out infinite",
          }}
        />

        <div className="flex-1 flex flex-col items-center px-5 pt-12 pb-8 overflow-y-auto relative z-10">

          {/* ── Logo ── */}
          <div className="mil-logo mb-5">
            <img
              src={logoUrl}
              alt="Halgo Cash"
              style={{ height: 90, width: "auto", objectFit: "contain",
                filter: "drop-shadow(0 6px 24px rgba(59,130,246,0.5)) drop-shadow(0 2px 8px rgba(0,0,0,0.6))" }}
            />
          </div>

          {/* ── Title ── */}
          <div className="mil-title text-center mb-7 w-full max-w-sm">
            <h1 className="text-2xl font-black text-white tracking-tight">Connexion</h1>
            <p className="text-sm mt-1" style={{ color: "rgba(147,197,253,0.7)" }}>
              Accédez à votre compte
            </p>
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="mil-form w-full max-w-sm space-y-4">

            {/* Phone */}
            <div>
              <label style={{ color: "rgba(147,197,253,0.7)", fontSize: 10, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: 6 }}>
                Numéro de téléphone
              </label>
              <div className="flex">
                <div className="flex items-center gap-1.5 px-3 shrink-0 rounded-l-xl"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRight: "none" }}>
                  <span style={{ fontSize: 15 }}>🇨🇩</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd" }}>+243</span>
                </div>
                <input
                  type="tel" inputMode="numeric" placeholder="8X XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  required
                  style={{
                    flex: 1, padding: "14px 14px 14px 14px",
                    borderRadius: "0 12px 12px 0",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#fff", fontSize: 14, outline: "none",
                  }}
                  onFocus={e => e.target.style.borderColor = "rgba(59,130,246,0.7)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ color: "rgba(147,197,253,0.7)", fontSize: 10, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: 6 }}>
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: "100%", padding: "14px 44px 14px 14px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#fff", fontSize: 14, outline: "none",
                  }}
                  onFocus={e => e.target.style.borderColor = "rgba(59,130,246,0.7)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "rgba(147,197,253,0.6)" }}>
                  {showPwd ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
                </button>
              </div>
              <div className="text-right mt-1.5">
                <Link href="/sign-in/forgot-password"
                  style={{ fontSize: 12, color: "#93c5fd", fontWeight: 600 }}>
                  Mot de passe oublié ?
                </Link>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ color: "#fca5a5", fontSize: 12,
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 12, padding: "10px 14px" }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !signIn || phone.length < 9 || !password}
              className="mil-btn-shine w-full py-4 rounded-xl font-black text-white text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ boxShadow: "0 4px 24px rgba(37,99,235,0.55), 0 0 0 1px rgba(255,255,255,0.1)" }}
            >
              {loading ? <Loader2 style={{ width: 20, height: 20 }} className="animate-spin" /> : "Se connecter"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
              <span style={{ fontSize: 12, color: "rgba(147,197,253,0.5)", fontWeight: 500 }}>ou</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || !signIn}
              className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#e2e8f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
            >
              {googleLoading
                ? <Loader2 style={{ width: 20, height: 20 }} className="animate-spin text-gray-300" />
                : <GoogleIcon />}
              Se connecter avec Google
            </button>

            {/* Footer */}
            <p className="text-center pt-1" style={{ fontSize: 14, color: "rgba(147,197,253,0.55)" }}>
              Pas encore de compte ?{" "}
              <Link href="/sign-up"
                style={{ color: "#60a5fa", fontWeight: 700 }}>
                Créer un compte
              </Link>
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
