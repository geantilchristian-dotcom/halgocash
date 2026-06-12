import { useState, useEffect, useCallback } from "react";
import { useSignIn } from "@clerk/react/legacy";
import { useAuth } from "@clerk/react";
import { useLocation } from "wouter";
import { Loader2, Eye, EyeOff, AlertCircle, Mail, Lock } from "lucide-react";

const TIMEOUT_MS = 15000;
function clerkTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)
    ),
  ]);
}

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [clerkTimedOut, setClerkTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { if (!isLoaded) setClerkTimedOut(true); }, 12000);
    return () => clearTimeout(t);
  }, [isLoaded]);

  useEffect(() => {
    if (isSignedIn) setLocation("/app");
  }, [isSignedIn, setLocation]);

  const handleEmailSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setError("");
    setLoadingEmail(true);
    try {
      const result = await clerkTimeout(signIn.create({ identifier: email, password }));
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setLocation("/app");
      } else {
        setError("Vérification supplémentaire requise. Réessayez.");
      }
    } catch (err: unknown) {
      if ((err as Error).message === "timeout") {
        setError("Connexion trop lente. Vérifiez votre réseau et réessayez.");
      } else {
        const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
        const msg = clerkErr?.errors?.[0]?.longMessage ?? clerkErr?.errors?.[0]?.message;
        if (msg?.includes("password") || msg?.includes("identifier")) {
          setError("Email ou mot de passe incorrect.");
        } else {
          setError(msg ?? "Une erreur est survenue. Réessayez.");
        }
      }
    } finally {
      setLoadingEmail(false);
    }
  }, [isLoaded, signIn, setActive, email, password, setLocation]);

  const handleGoogleSignIn = useCallback(async () => {
    if (!isLoaded || !signIn) return;
    setError("");
    setLoadingGoogle(true);
    try {
      await clerkTimeout(signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: "/app",
      }));
    } catch (err: unknown) {
      if ((err as Error).message === "timeout") {
        setError("Google Sign-In trop lent. Réessayez.");
      } else {
        setError("Impossible de démarrer Google Sign-In.");
      }
      setLoadingGoogle(false);
    }
  }, [isLoaded, signIn]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #040d06 0%, #071a0b 40%, #0b2614 100%)" }}>

      {/* Orbes décoratifs */}
      <div style={{
        position: "fixed", top: "-15%", right: "-10%",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, #15803d 0%, transparent 65%)",
        filter: "blur(80px)", opacity: 0.18, pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", bottom: "-10%", left: "-15%",
        width: 450, height: 450, borderRadius: "50%",
        background: "radial-gradient(circle, #8DC63F 0%, transparent 65%)",
        filter: "blur(90px)", opacity: 0.10, pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", top: "40%", left: "50%", transform: "translateX(-50%)",
        width: 600, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle, #166534 0%, transparent 70%)",
        filter: "blur(100px)", opacity: 0.12, pointerEvents: "none",
      }} />

      {/* Carte principale */}
      <div className="relative z-10 w-full max-w-sm mx-auto px-5">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-baseline gap-0 mb-1">
            <span style={{
              fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif",
              fontWeight: 900, fontStyle: "italic",
              fontSize: "3.2rem", color: "#ffffff",
              letterSpacing: "-0.03em", lineHeight: 1,
              textShadow: "0 0 40px rgba(255,255,255,0.12)",
            }}>halgo</span>
            <span style={{
              fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif",
              fontWeight: 900, fontStyle: "italic",
              fontSize: "3.2rem", color: "#8DC63F",
              letterSpacing: "-0.03em", lineHeight: 1,
              textShadow: "0 0 40px rgba(141,198,63,0.5)",
            }}>Cash</span>
          </div>
          <p style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: "0.6rem", fontWeight: 700,
            letterSpacing: "0.3em", textTransform: "uppercase",
          }}>Rapide · Sécurisé · Fiable</p>
        </div>

        {/* Carte formulaire */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "1.5rem",
          padding: "2rem 1.5rem",
          backdropFilter: "blur(20px)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}>
          <h2 style={{
            color: "#fff", fontSize: "1.5rem",
            fontWeight: 800, marginBottom: "0.25rem", letterSpacing: "-0.02em",
          }}>Connexion</h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
            Accédez à votre compte joueur
          </p>

          {(clerkTimedOut || error) && (
            <div style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              display: "flex", alignItems: "flex-start", gap: "0.5rem",
            }}>
              <AlertCircle style={{ width: 15, height: 15, color: "#f87171", flexShrink: 0, marginTop: 2 }} />
              <span style={{ color: "#fca5a5", fontSize: "0.8rem", lineHeight: 1.5 }}>
                {error || "Le service d'authentification ne répond pas. Vérifiez votre connexion."}
              </span>
            </div>
          )}

          {/* Bouton Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={!isLoaded || loadingGoogle || loadingEmail}
            style={{
              width: "100%", height: "3rem",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "0.875rem",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.625rem",
              color: "rgba(255,255,255,0.85)", fontSize: "0.875rem", fontWeight: 600,
              cursor: "pointer", marginBottom: "1.25rem",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.11)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
          >
            {loadingGoogle ? (
              <Loader2 style={{ width: 16, height: 16, color: "#8DC63F" }} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
              </svg>
            )}
            Continuer avec Google
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.75rem", fontWeight: 500 }}>ou</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          </div>

          <form onSubmit={handleEmailSignIn} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Email */}
            <div>
              <label style={{
                display: "block", color: "rgba(255,255,255,0.45)",
                fontSize: "0.7rem", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.4rem",
              }}>Email</label>
              <div style={{ position: "relative" }}>
                <Mail style={{
                  position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)",
                  width: 15, height: 15, color: "rgba(255,255,255,0.25)",
                }} />
                <input
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  style={{
                    width: "100%", height: "3rem",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "0.75rem",
                    paddingLeft: "2.5rem", paddingRight: "1rem",
                    color: "#fff", fontSize: "0.875rem",
                    outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(141,198,63,0.5)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: "0.7rem", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                }}>Mot de passe</label>
                <a href="#" style={{ color: "#8DC63F", fontSize: "0.72rem", fontWeight: 600, textDecoration: "none" }}>
                  Oublié ?
                </a>
              </div>
              <div style={{ position: "relative" }}>
                <Lock style={{
                  position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)",
                  width: 15, height: 15, color: "rgba(255,255,255,0.25)",
                }} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{
                    width: "100%", height: "3rem",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "0.75rem",
                    paddingLeft: "2.5rem", paddingRight: "3rem",
                    color: "#fff", fontSize: "0.875rem",
                    outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(141,198,63,0.5)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: "0.875rem", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            {/* Bouton connexion */}
            <button
              type="submit"
              disabled={!isLoaded || loadingEmail || loadingGoogle}
              style={{
                width: "100%", height: "3rem",
                background: loadingEmail || loadingGoogle
                  ? "rgba(141,198,63,0.4)"
                  : "linear-gradient(135deg, #5a9e1a 0%, #8DC63F 50%, #6db82a 100%)",
                border: "none", borderRadius: "0.875rem",
                color: "#071a0b", fontSize: "0.9rem", fontWeight: 800,
                cursor: loadingEmail || loadingGoogle ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                marginTop: "0.25rem",
                boxShadow: "0 4px 20px rgba(141,198,63,0.3)",
                transition: "all 0.2s", letterSpacing: "0.01em",
              }}
            >
              {loadingEmail && <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />}
              Se connecter
            </button>
          </form>
        </div>

        {/* Lien inscription */}
        <p style={{
          color: "rgba(255,255,255,0.35)", fontSize: "0.85rem",
          textAlign: "center", marginTop: "1.5rem",
        }}>
          Pas encore de compte ?{" "}
          <a href="/sign-up" style={{ color: "#8DC63F", fontWeight: 700, textDecoration: "none" }}>
            Créer un compte
          </a>
        </p>
      </div>
    </div>
  );
}
