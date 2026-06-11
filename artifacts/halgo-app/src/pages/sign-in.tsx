import { useState } from "react";
import { useSignIn } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Loader2, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

export default function SignInPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [, setLocation] = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [remember, setRemember]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!isLoaded) { setError("Chargement en cours, réessayez dans un instant."); return; }
    if (!signIn)   { setError("Session invalide. Rechargez la page."); return; }
    if (!identifier.trim() || !password.trim()) { setError("Veuillez remplir tous les champs."); return; }
    setLoading(true);
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
        form_password_incorrect:      "Mot de passe incorrect.",
        form_identifier_not_found:    "Aucun compte trouvé avec cet identifiant.",
        too_many_requests:            "Trop de tentatives. Réessayez dans quelques minutes.",
        strategy_for_user_not_found:  "Ce compte utilise une autre méthode de connexion (ex: Google).",
        form_param_format_invalid:    "Identifiant invalide.",
        session_exists:               "Vous êtes déjà connecté(e).",
        identifier_already_signed_in: "Vous êtes déjà connecté(e).",
      };
      setError(translations[code] ?? e.errors?.[0]?.longMessage ?? e.errors?.[0]?.message ?? "Identifiant ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!isLoaded) { setError("Chargement en cours, réessayez dans un instant."); return; }
    if (!signIn)   { setError("Session invalide. Rechargez la page."); return; }
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

  return (
    <>
      <style>{`
        @keyframes si-float1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
        @keyframes si-float2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(16px)} }
        @keyframes si-in { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        .si-logo { animation: si-in 0.65s cubic-bezier(.34,1.56,.64,1) 0.05s both; }
        .si-head { animation: si-in 0.5s ease-out 0.18s both; }
        .si-card { animation: si-in 0.5s ease-out 0.28s both; }
        .si-foot { animation: si-in 0.5s ease-out 0.40s both; }
      `}</style>

      <div className="min-h-dvh flex flex-col overflow-hidden relative"
        style={{ background: "linear-gradient(160deg,#061a0c 0%,#0a2e14 38%,#0f3d1c 68%,#143d1f 100%)" }}>

        {/* Blobs décoratifs */}
        <div className="absolute -top-10 -right-10 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,#16a34a 0%,transparent 70%)", filter: "blur(60px)", animation: "si-float1 8s ease-in-out infinite", opacity: .2 }} />
        <div className="absolute bottom-20 -left-10 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,#15803d 0%,transparent 70%)", filter: "blur(55px)", animation: "si-float2 11s ease-in-out infinite 1.5s", opacity: .15 }} />

        <div className="flex-1 flex flex-col justify-center px-5 py-10 relative z-10 max-w-md mx-auto w-full">

          {/* Logo */}
          <div className="si-logo flex items-baseline justify-center mb-6" style={{ gap: "0.25em" }}>
            <span style={{
              fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
              fontWeight: 900, fontStyle: "italic",
              fontSize: "2.8rem", color: "#ffffff",
              letterSpacing: "-0.02em", lineHeight: 1,
            }}>halgo</span>
            <span style={{
              fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
              fontWeight: 900, fontStyle: "italic",
              fontSize: "2.8rem", color: "#8DC63F",
              letterSpacing: "-0.02em", lineHeight: 1,
            }}>Cash</span>
          </div>

          {/* Titre + sous-titre */}
          <div className="si-head text-center mb-7">
            <h1 style={{ color: "#fff", fontSize: "1.6rem", fontWeight: 800, marginBottom: 10, letterSpacing: "-0.01em" }}>
              Bienvenue
            </h1>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", lineHeight: 1.6, maxWidth: 300, margin: "0 auto" }}>
              Connectez-vous à votre compte HalgoCash pour accéder à votre espace en toute sécurité.
            </p>
          </div>

          {/* Carte formulaire */}
          <div className="si-card rounded-3xl p-6 mb-5"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email / téléphone */}
              <div>
                <label style={{ display: "block", color: "#ffffff", fontSize: "0.85rem", fontWeight: 700, marginBottom: 10 }}>
                  Email ou numéro de téléphone
                </label>
                <div className="flex rounded-2xl overflow-hidden"
                  style={{ border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-center w-12 shrink-0"
                    style={{ background: "#3aab3a", minHeight: 52 }}>
                    <PersonIcon />
                  </div>
                  <input
                    type="text"
                    placeholder="Ex : +243 8X XXX XXXX ou email"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setError(null); }}
                    autoComplete="username"
                    style={{
                      flex: 1, background: "transparent", border: "none", outline: "none",
                      color: "#ffffff", fontSize: "0.9rem", padding: "0 14px",
                      minHeight: 52,
                    }}
                    className="placeholder:text-white/30"
                  />
                </div>
              </div>

              {/* Mot de passe */}
              <div>
                <label style={{ display: "block", color: "#ffffff", fontSize: "0.85rem", fontWeight: 700, marginBottom: 10 }}>
                  Mot de passe
                </label>
                <div className="flex rounded-2xl overflow-hidden"
                  style={{ border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-center w-12 shrink-0"
                    style={{ background: "#3aab3a", minHeight: 52 }}>
                    <LockIcon />
                  </div>
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="Entrez votre mot de passe"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    autoComplete="current-password"
                    style={{
                      flex: 1, background: "transparent", border: "none", outline: "none",
                      color: "#ffffff", fontSize: "0.9rem", padding: "0 14px",
                      minHeight: 52,
                    }}
                    className="placeholder:text-white/30"
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    style={{ padding: "0 14px", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)" }}>
                    {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="flex justify-end mt-2">
                  <button type="button"
                    style={{ color: "#8DC63F", fontSize: "0.82rem", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                    Mot de passe oublié ?
                  </button>
                </div>
              </div>

              {/* Se souvenir de moi */}
              <label className="flex items-center gap-3 cursor-pointer" style={{ userSelect: "none" }}>
                <div
                  onClick={() => setRemember(!remember)}
                  style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                    background: remember ? "#3aab3a" : "transparent",
                    border: `2px solid ${remember ? "#3aab3a" : "rgba(255,255,255,0.35)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                  {remember && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.88rem", fontWeight: 500 }}>Se souvenir de moi</span>
              </label>

              {/* Erreur */}
              {error && (
                <div className="flex items-start gap-2.5 rounded-2xl px-4 py-3"
                  style={{ background: "rgba(239,68,68,0.09)", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span style={{ color: "#f87171", fontSize: "0.82rem", lineHeight: 1.5 }}>{error}</span>
                </div>
              )}

              {/* Bouton Se connecter */}
              <button
                type="button"
                onClick={() => { void handleSubmit(); }}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl font-bold transition-all active:scale-[0.98]"
                style={{
                  height: 56, fontSize: "1rem", letterSpacing: "0.01em",
                  background: loading ? "rgba(58,171,58,0.6)" : "linear-gradient(135deg,#3aab3a 0%,#4dc44d 100%)",
                  color: "#fff", border: "none", cursor: loading ? "default" : "pointer",
                  boxShadow: "0 4px 20px rgba(58,171,58,0.4)",
                }}>
                {loading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><span>Se connecter</span><ArrowRight className="w-5 h-5" /></>}
              </button>

              {/* Séparateur */}
              <div className="flex items-center gap-3">
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8rem", fontWeight: 600 }}>ou</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
              </div>

              {/* Bouton Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 rounded-2xl font-semibold transition-all active:scale-[0.98]"
                style={{
                  height: 56, fontSize: "0.95rem",
                  background: googleLoading ? "rgba(255,255,255,0.85)" : "#ffffff",
                  color: "#1a1a1a", border: "none", cursor: googleLoading ? "default" : "pointer",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                }}>
                {googleLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : <GoogleIcon />}
                <span>Continuer avec Google</span>
              </button>

            </form>
          </div>

          {/* Lien inscription */}
          <div className="si-foot text-center mb-6">
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>
              Pas encore de compte ?{" "}
              <Link href={`${basePath}/sign-up`}
                style={{ color: "#8DC63F", fontWeight: 700, textDecoration: "none" }}>
                S'inscrire
              </Link>
            </p>
          </div>

          {/* Badge sécurité */}
          <div className="si-foot text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8rem", fontWeight: 600 }}>Connexion sécurisée</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.75rem" }}>
              Vos données sont protégées et confidentielles.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
