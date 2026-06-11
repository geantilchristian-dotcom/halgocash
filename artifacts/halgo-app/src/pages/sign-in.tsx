import { useState } from "react";
import { useSignIn } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Loader2, AlertCircle, Phone, Lock, ArrowRight } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function SignInPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [, setLocation] = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  /* ── Connexion email / téléphone + mot de passe ─────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signIn.create({ identifier: identifier.trim(), password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setLocation(`${basePath}/app`);
      }
    } catch (err: unknown) {
      const e = err as { errors?: { code?: string; longMessage?: string; message?: string }[] };
      const code = e.errors?.[0]?.code ?? "";
      const translations: Record<string, string> = {
        form_password_incorrect:           "Mot de passe incorrect.",
        form_identifier_not_found:         "Aucun compte trouvé avec cet identifiant.",
        too_many_requests:                 "Trop de tentatives. Réessayez dans quelques minutes.",
        strategy_for_user_not_found:       "Ce compte utilise une autre méthode de connexion (ex: Google).",
        form_param_format_invalid:         "Identifiant invalide.",
        session_exists:                    "Vous êtes déjà connecté(e).",
        identifier_already_signed_in:      "Vous êtes déjà connecté(e).",
      };
      setError(
        translations[code] ??
        e.errors?.[0]?.longMessage ??
        e.errors?.[0]?.message ??
        "Identifiant ou mot de passe incorrect."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ── Connexion Google ────────────────────────────────────────── */
  const handleGoogle = async () => {
    if (!isLoaded || !signIn) return;
    setGoogleLoading(true);
    setError(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${basePath}/sso-callback`,
        redirectUrlComplete: `${basePath}/app`,
      });
    } catch (err: unknown) {
      const e = err as { errors?: { message?: string }[] };
      setError(e.errors?.[0]?.message ?? "Erreur lors de la connexion Google.");
      setGoogleLoading(false);
    }
  };

  const inputBase =
    "w-full py-4 rounded-2xl text-white placeholder:text-white/25 text-[15px] outline-none border transition-all bg-white/[0.07] border-white/12 focus:border-[#8DC63F]/60 focus:bg-white/[0.09]";

  return (
    <>
      <style>{`
        @keyframes si-float1 {
          0%,100%{transform:translateY(0);opacity:.18}
          50%{transform:translateY(-22px);opacity:.28}
        }
        @keyframes si-float2 {
          0%,100%{transform:translateY(0);opacity:.14}
          50%{transform:translateY(18px);opacity:.22}
        }
        @keyframes si-in {
          from{opacity:0;transform:translateY(20px)}
          to{opacity:1;transform:translateY(0)}
        }
        .si-logo { animation: si-in 0.6s cubic-bezier(.34,1.56,.64,1) 0.05s both; }
        .si-head { animation: si-in 0.5s ease-out 0.18s both; }
        .si-form { animation: si-in 0.5s ease-out 0.28s both; }
        .si-foot { animation: si-in 0.5s ease-out 0.38s both; }
      `}</style>

      <div
        className="min-h-dvh flex flex-col overflow-hidden relative"
        style={{ background: "linear-gradient(160deg,#061a0c 0%,#0a2e14 38%,#0f3d1c 68%,#143d1f 100%)" }}
      >
        {/* Blobs décoratifs */}
        <div className="absolute -top-10 -right-10 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,#16a34a 0%,transparent 70%)", filter: "blur(60px)", animation: "si-float1 8s ease-in-out infinite", opacity: .18 }} />
        <div className="absolute bottom-20 -left-10 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,#15803d 0%,transparent 70%)", filter: "blur(55px)", animation: "si-float2 11s ease-in-out infinite 1.5s", opacity: .15 }} />
        <div className="absolute top-2/5 right-0 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,#22c55e 0%,transparent 70%)", filter: "blur(40px)", animation: "si-float1 14s ease-in-out infinite 3s", opacity: .12 }} />

        <div className="flex-1 flex flex-col justify-center px-6 py-10 relative z-10 max-w-md mx-auto w-full">

          {/* Logo */}
          <div className="si-logo flex items-baseline justify-center gap-0 mb-8">
            <span style={{
              fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
              fontWeight: 900, fontStyle: "italic",
              fontSize: "3rem", color: "#ffffff",
              letterSpacing: "-0.02em", lineHeight: 1,
            }}>halgo</span>
            <span style={{
              fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
              fontWeight: 900, fontStyle: "italic",
              fontSize: "3rem", color: "#8DC63F",
              letterSpacing: "-0.02em", lineHeight: 1,
            }}>Cash</span>
          </div>

          {/* Titre */}
          <div className="si-head text-center mb-8">
            <h1 style={{ color: "#fff", fontSize: "1.45rem", fontWeight: 800, letterSpacing: "-0.01em", marginBottom: 6 }}>
              Connexion
            </h1>
            <p style={{ color: "rgba(255,255,255,0.42)", fontSize: "0.875rem" }}>
              Entrez vos identifiants pour accéder à votre compte
            </p>
          </div>

          {/* Formulaire */}
          <form className="si-form space-y-4" onSubmit={handleSubmit}>

            {/* Identifiant */}
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,0.45)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                Email ou numéro de téléphone
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-white/25" />
                <input
                  type="text"
                  placeholder="+243 8X XXX XXXX ou email"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setError(null); }}
                  required
                  autoComplete="username"
                  className={`${inputBase} pl-11 pr-4`}
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Mot de passe
                </label>
                <button type="button" style={{ color: "#8DC63F", fontSize: "0.78rem", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                  Oublié ?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-white/25" />
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  required
                  autoComplete="current-password"
                  className={`${inputBase} pl-11 pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.28)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {showPwd ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
                </button>
              </div>
            </div>

            {/* Erreur */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl px-4 py-3"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span style={{ color: "#f87171", fontSize: "0.82rem", lineHeight: 1.4 }}>{error}</span>
              </div>
            )}

            {/* Bouton Se connecter */}
            <button
              type="submit"
              disabled={loading || !isLoaded || !identifier || !password}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                paddingTop: 16, paddingBottom: 16, borderRadius: 16,
                background: "linear-gradient(135deg,#3aab3a 0%,#5dc43d 100%)",
                color: "#0a2e14", fontWeight: 900, fontSize: "0.95rem", letterSpacing: "0.08em",
                textTransform: "uppercase", border: "none", cursor: loading ? "default" : "pointer",
                boxShadow: "0 4px 24px rgba(58,171,58,0.35)", transition: "all 0.2s",
                opacity: (loading || !identifier || !password) ? 0.5 : 1,
              }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Se connecter</span><ArrowRight className="w-5 h-5" /></>}
            </button>

            {/* Séparateur */}
            <div className="flex items-center gap-3 py-1">
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
              <span style={{ color: "rgba(255,255,255,0.28)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>ou</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
            </div>

            {/* Bouton Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || !isLoaded}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                paddingTop: 15, paddingBottom: 15, borderRadius: 16,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#ffffff", fontWeight: 600, fontSize: "0.92rem",
                cursor: googleLoading ? "default" : "pointer",
                transition: "all 0.2s", opacity: googleLoading ? 0.6 : 1,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.11)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
            >
              {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
              <span>Continuer avec Google</span>
            </button>
          </form>

          {/* Pied de page */}
          <div className="si-foot text-center mt-8">
            <p style={{ color: "rgba(255,255,255,0.38)", fontSize: "0.875rem" }}>
              Pas encore de compte ?{" "}
              <Link href={`${basePath}/sign-up`}
                style={{ color: "#8DC63F", fontWeight: 700, textDecoration: "none" }}>
                Inscrivez-vous
              </Link>
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
