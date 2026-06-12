import { useState, useEffect, useCallback } from "react";
import { useSignIn } from "@clerk/react/legacy";
import { useAuth } from "@clerk/react";
import { useLocation } from "wouter";
import { Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    const t = setTimeout(() => {
      if (!isLoaded) setClerkTimedOut(true);
    }, 12000);
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
      const result = await clerkTimeout(
        signIn.create({ identifier: email, password })
      );
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
      await clerkTimeout(
        signIn.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: `${window.location.origin}/sso-callback`,
          redirectUrlComplete: "/app",
        })
      );
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
    <div className="min-h-dvh bg-[#0a1f0f] flex flex-col">
      {/* Header vert foncé avec logo */}
      <div className="bg-gradient-to-b from-[#061a0c] to-[#0a2e14] px-6 pt-16 pb-24 flex flex-col items-center relative overflow-hidden">
        {/* Blobs décoratifs */}
        <div style={{
          position: "absolute", top: "-10%", right: "-10%",
          width: 280, height: 280, borderRadius: "50%",
          background: "radial-gradient(circle, #15803d 0%, transparent 70%)",
          filter: "blur(50px)", opacity: 0.25,
        }} />
        <div style={{
          position: "absolute", bottom: "0%", left: "-8%",
          width: 220, height: 220, borderRadius: "50%",
          background: "radial-gradient(circle, #166534 0%, transparent 70%)",
          filter: "blur(45px)", opacity: 0.2,
        }} />

        {/* Logo */}
        <div className="relative z-10 flex items-baseline gap-0 mb-2">
          <span style={{
            fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif",
            fontWeight: 900, fontStyle: "italic",
            fontSize: "3rem", color: "#ffffff",
            letterSpacing: "-0.02em", lineHeight: 1,
            textShadow: "0 4px 24px rgba(255,255,255,0.15)",
          }}>halgo</span>
          <span style={{
            fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif",
            fontWeight: 900, fontStyle: "italic",
            fontSize: "3rem", color: "#8DC63F",
            letterSpacing: "-0.02em", lineHeight: 1,
            textShadow: "0 4px 24px rgba(141,198,63,0.4)",
          }}>Cash</span>
        </div>
        <p className="relative z-10 text-white/40 text-[10px] font-bold tracking-[0.25em] uppercase">
          Rapide · Sécurisé · Fiable
        </p>
      </div>

      {/* Carte formulaire qui monte */}
      <div className="bg-[#f5f7f5] -mt-10 rounded-t-[2rem] flex-1 px-5 pt-7 pb-10 shadow-xl">
        <h2 className="text-2xl font-black text-gray-900 mb-1">Connexion</h2>
        <p className="text-sm text-gray-400 mb-6">Accédez à votre compte joueur</p>

        {clerkTimedOut && (
          <Alert variant="destructive" className="mb-4 rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Le service d'authentification ne répond pas. Vérifiez votre connexion internet.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4 rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Bouton Google */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={!isLoaded || loadingGoogle || loadingEmail}
          className="w-full h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center gap-3 mb-4 font-semibold text-gray-700 text-sm shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {loadingGoogle ? (
            <Loader2 className="w-4 h-4 animate-spin" />
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

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">ou</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Email</label>
            <Input
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="rounded-xl h-12 border-gray-200 bg-white focus-visible:ring-[#8DC63F] focus-visible:border-[#143024] text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Mot de passe</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="rounded-xl h-12 border-gray-200 bg-white focus-visible:ring-[#8DC63F] focus-visible:border-[#143024] pr-12 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!isLoaded || loadingEmail || loadingGoogle}
            className="w-full h-12 bg-[#143024] hover:bg-[#1e4a30] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
          >
            {loadingEmail && <Loader2 className="w-4 h-4 animate-spin" />}
            Se connecter
          </button>
        </form>

        <p className="text-sm text-gray-400 text-center mt-6">
          Pas encore de compte ?{" "}
          <a href="/sign-up" className="text-[#143024] font-bold hover:underline">
            Créer un compte
          </a>
        </p>
      </div>
    </div>
  );
}
