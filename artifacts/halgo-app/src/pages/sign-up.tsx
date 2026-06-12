import { useState, useCallback } from "react";
import { useSignUp } from "@clerk/react/legacy";
import { useLocation } from "wouter";
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";
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

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<"form" | "verify">("form");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    setError("");
    setLoading(true);
    try {
      await clerkTimeout(signUp.create({ emailAddress: email, password, firstName }));
      await clerkTimeout(signUp.prepareEmailAddressVerification({ strategy: "email_code" }));
      setStep("verify");
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(clerkErr?.errors?.[0]?.longMessage ?? clerkErr?.errors?.[0]?.message ?? "Erreur lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signUp, email, password, firstName]);

  const handleVerify = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    setError("");
    setLoading(true);
    try {
      const result = await clerkTimeout(signUp.attemptEmailAddressVerification({ code }));
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setLocation("/app");
      } else {
        setError("Vérification incomplète. Réessayez.");
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(clerkErr?.errors?.[0]?.longMessage ?? clerkErr?.errors?.[0]?.message ?? "Code incorrect.");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signUp, setActive, code, setLocation]);

  return (
    <div className="min-h-dvh bg-[#0a1f0f] flex flex-col">
      <div className="bg-gradient-to-b from-[#061a0c] to-[#0a2e14] px-6 pt-16 pb-24 flex flex-col items-center relative overflow-hidden">
        <div style={{
          position: "absolute", top: "-10%", right: "-10%",
          width: 280, height: 280, borderRadius: "50%",
          background: "radial-gradient(circle, #15803d 0%, transparent 70%)",
          filter: "blur(50px)", opacity: 0.25,
        }} />
        <div className="relative z-10 flex items-baseline gap-0 mb-2">
          <span style={{
            fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif",
            fontWeight: 900, fontStyle: "italic",
            fontSize: "3rem", color: "#ffffff",
            letterSpacing: "-0.02em", lineHeight: 1,
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

      <div className="bg-[#f5f7f5] -mt-10 rounded-t-[2rem] flex-1 px-5 pt-7 pb-10 shadow-xl">
        {step === "form" ? (
          <>
            <h2 className="text-2xl font-black text-gray-900 mb-1">Créer un compte</h2>
            <p className="text-sm text-gray-400 mb-6">Rejoignez halgoCash gratuitement</p>

            {error && (
              <Alert variant="destructive" className="mb-4 rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Prénom</label>
                <Input
                  type="text"
                  placeholder="Jean"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="rounded-xl h-12 border-gray-200 bg-white focus-visible:ring-[#8DC63F] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Email</label>
                <Input
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="rounded-xl h-12 border-gray-200 bg-white focus-visible:ring-[#8DC63F] text-sm"
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
                    autoComplete="new-password"
                    minLength={8}
                    className="rounded-xl h-12 border-gray-200 bg-white focus-visible:ring-[#8DC63F] pr-12 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={!isLoaded || loading}
                className="w-full h-12 bg-[#143024] hover:bg-[#1e4a30] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                S'inscrire
              </button>
            </form>

            <p className="text-sm text-gray-400 text-center mt-6">
              Déjà un compte ?{" "}
              <a href="/sign-in" className="text-[#143024] font-bold hover:underline">Se connecter</a>
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#8DC63F]/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-[#143024]" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900">Vérifiez votre email</h2>
                <p className="text-sm text-gray-400">Code envoyé à {email}</p>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4 rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Code de vérification</label>
                <Input
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  maxLength={6}
                  className="rounded-xl h-12 border-gray-200 bg-white focus-visible:ring-[#8DC63F] text-center text-2xl tracking-widest font-bold"
                />
              </div>
              <button
                type="submit"
                disabled={!isLoaded || loading}
                className="w-full h-12 bg-[#143024] hover:bg-[#1e4a30] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmer
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
