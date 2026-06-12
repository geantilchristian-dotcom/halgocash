import { useState, useCallback } from "react";
import { useSignUp } from "@clerk/react/legacy";
import { useLocation } from "wouter";
import { Loader2, Eye, EyeOff, AlertCircle, Mail, Lock, User, CheckCircle2 } from "lucide-react";

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

  const inputStyle = {
    width: "100%", height: "3rem",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "0.75rem",
    paddingRight: "1rem",
    color: "#fff", fontSize: "0.875rem",
    outline: "none", boxSizing: "border-box" as const,
    transition: "border-color 0.2s",
  };

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

      <div className="relative z-10 w-full max-w-sm mx-auto px-5">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
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
            color: "rgba(255,255,255,0.3)", fontSize: "0.6rem",
            fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase",
          }}>Rapide · Sécurisé · Fiable</p>
        </div>

        {/* Carte */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "1.5rem",
          padding: "2rem 1.5rem",
          backdropFilter: "blur(20px)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}>

          {step === "form" ? (
            <>
              <h2 style={{
                color: "#fff", fontSize: "1.5rem",
                fontWeight: 800, marginBottom: "0.25rem", letterSpacing: "-0.02em",
              }}>Créer un compte</h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                Rejoignez halgoCash gratuitement
              </p>

              {error && (
                <div style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: "0.75rem", padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                  display: "flex", alignItems: "flex-start", gap: "0.5rem",
                }}>
                  <AlertCircle style={{ width: 15, height: 15, color: "#f87171", flexShrink: 0, marginTop: 2 }} />
                  <span style={{ color: "#fca5a5", fontSize: "0.8rem", lineHeight: 1.5 }}>{error}</span>
                </div>
              )}

              <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                {/* Prénom */}
                <div>
                  <label style={{
                    display: "block", color: "rgba(255,255,255,0.45)",
                    fontSize: "0.7rem", fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.4rem",
                  }}>Prénom</label>
                  <div style={{ position: "relative" }}>
                    <User style={{
                      position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)",
                      width: 15, height: 15, color: "rgba(255,255,255,0.25)",
                    }} />
                    <input
                      type="text" placeholder="Jean"
                      value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      required
                      style={{ ...inputStyle, paddingLeft: "2.5rem" }}
                      onFocus={e => (e.currentTarget.style.borderColor = "rgba(141,198,63,0.5)")}
                      onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                    />
                  </div>
                </div>

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
                      type="email" placeholder="votre@email.com"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      required autoComplete="email"
                      style={{ ...inputStyle, paddingLeft: "2.5rem" }}
                      onFocus={e => (e.currentTarget.style.borderColor = "rgba(141,198,63,0.5)")}
                      onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                    />
                  </div>
                </div>

                {/* Mot de passe */}
                <div>
                  <label style={{
                    display: "block", color: "rgba(255,255,255,0.45)",
                    fontSize: "0.7rem", fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.4rem",
                  }}>Mot de passe</label>
                  <div style={{ position: "relative" }}>
                    <Lock style={{
                      position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)",
                      width: 15, height: 15, color: "rgba(255,255,255,0.25)",
                    }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 caractères"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      required autoComplete="new-password" minLength={8}
                      style={{ ...inputStyle, paddingLeft: "2.5rem", paddingRight: "3rem" }}
                      onFocus={e => (e.currentTarget.style.borderColor = "rgba(141,198,63,0.5)")}
                      onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                    />
                    <button
                      type="button" onClick={() => setShowPassword(!showPassword)}
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

                <button
                  type="submit"
                  disabled={!isLoaded || loading}
                  style={{
                    width: "100%", height: "3rem",
                    background: loading ? "rgba(141,198,63,0.4)"
                      : "linear-gradient(135deg, #5a9e1a 0%, #8DC63F 50%, #6db82a 100%)",
                    border: "none", borderRadius: "0.875rem",
                    color: "#071a0b", fontSize: "0.9rem", fontWeight: 800,
                    cursor: loading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                    marginTop: "0.25rem",
                    boxShadow: "0 4px 20px rgba(141,198,63,0.3)",
                    transition: "all 0.2s",
                  }}
                >
                  {loading && <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />}
                  Créer mon compte
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Étape vérification */}
              <div style={{
                width: "3.5rem", height: "3.5rem", borderRadius: "50%",
                background: "rgba(141,198,63,0.15)",
                border: "1px solid rgba(141,198,63,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "1rem",
              }}>
                <CheckCircle2 style={{ width: 24, height: 24, color: "#8DC63F" }} />
              </div>

              <h2 style={{
                color: "#fff", fontSize: "1.4rem",
                fontWeight: 800, marginBottom: "0.25rem", letterSpacing: "-0.02em",
              }}>Vérifiez votre email</h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                Code envoyé à <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{email}</span>
              </p>

              {error && (
                <div style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: "0.75rem", padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                  display: "flex", alignItems: "flex-start", gap: "0.5rem",
                }}>
                  <AlertCircle style={{ width: 15, height: 15, color: "#f87171", flexShrink: 0, marginTop: 2 }} />
                  <span style={{ color: "#fca5a5", fontSize: "0.8rem", lineHeight: 1.5 }}>{error}</span>
                </div>
              )}

              <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{
                    display: "block", color: "rgba(255,255,255,0.45)",
                    fontSize: "0.7rem", fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.4rem",
                  }}>Code de vérification</label>
                  <input
                    type="text" placeholder="• • • • • •"
                    value={code} onChange={(e) => setCode(e.target.value)}
                    required maxLength={6}
                    style={{
                      width: "100%", height: "4rem",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "0.75rem",
                      paddingLeft: "1rem", paddingRight: "1rem",
                      color: "#fff", fontSize: "2rem", fontWeight: 700,
                      letterSpacing: "0.5em", textAlign: "center",
                      outline: "none", boxSizing: "border-box",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = "rgba(141,198,63,0.5)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!isLoaded || loading}
                  style={{
                    width: "100%", height: "3rem",
                    background: loading ? "rgba(141,198,63,0.4)"
                      : "linear-gradient(135deg, #5a9e1a 0%, #8DC63F 50%, #6db82a 100%)",
                    border: "none", borderRadius: "0.875rem",
                    color: "#071a0b", fontSize: "0.9rem", fontWeight: 800,
                    cursor: loading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                    boxShadow: "0 4px 20px rgba(141,198,63,0.3)",
                    transition: "all 0.2s",
                  }}
                >
                  {loading && <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />}
                  Confirmer
                </button>

                <button
                  type="button"
                  onClick={() => setStep("form")}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.35)", fontSize: "0.8rem", textAlign: "center",
                    padding: "0.25rem",
                  }}
                >
                  ← Modifier l'email
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{
          color: "rgba(255,255,255,0.35)", fontSize: "0.85rem",
          textAlign: "center", marginTop: "1.5rem",
        }}>
          {step === "form" ? (
            <>Déjà un compte ?{" "}
              <a href="/sign-in" style={{ color: "#8DC63F", fontWeight: 700, textDecoration: "none" }}>
                Se connecter
              </a>
            </>
          ) : (
            <>Pas reçu le code ?{" "}
              <a href="#" style={{ color: "#8DC63F", fontWeight: 700, textDecoration: "none" }}>
                Renvoyer
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
