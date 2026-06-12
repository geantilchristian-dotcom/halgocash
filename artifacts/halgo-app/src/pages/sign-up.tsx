import { useState, useCallback } from "react";
import { useSignUp } from "@clerk/react/legacy";
import { useLocation } from "wouter";
import {
  Loader2, Eye, EyeOff, AlertCircle,
  Mail, Lock, User, Phone, MapPin, Calendar,
  CheckCircle2, ChevronRight, ChevronLeft,
} from "lucide-react";

const TIMEOUT_MS = 15000;
function clerkTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)
    ),
  ]);
}

type Step = "identity" | "contact" | "security" | "verify";

const STEPS: Step[] = ["identity", "contact", "security", "verify"];
const STEP_LABELS = ["Identité", "Contact", "Sécurité", "Vérification"];

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("identity");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Champs
  const [nom, setNom] = useState("");
  const [postNom, setPostNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [age, setAge] = useState("");
  const [adresse, setAdresse] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cgu, setCgu] = useState(false);
  const [code, setCode] = useState("");

  const stepIndex = STEPS.indexOf(step);

  const nextStep = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (step === "identity") setStep("contact");
    else if (step === "contact") setStep("security");
  }, [step]);

  const handleSignUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }
    if (!cgu) { setError("Vous devez accepter les conditions d'utilisation."); return; }
    setError("");
    setLoading(true);
    try {
      await clerkTimeout(signUp.create({
        emailAddress: email,
        password,
        firstName: prenom,
        lastName: nom,
        unsafeMetadata: { postNom, telephone, age, adresse },
      }));
      await clerkTimeout(signUp.prepareEmailAddressVerification({ strategy: "email_code" }));
      setStep("verify");
    } catch (err: unknown) {
      if ((err as Error).message === "timeout") {
        setError("Inscription trop lente. Vérifiez votre réseau et réessayez.");
        return;
      }
      const clerkErr = err as { errors?: { longMessage?: string; message?: string; code?: string }[] };
      const firstErr = clerkErr?.errors?.[0];
      if (firstErr) {
        const code = firstErr.code ?? "";
        if (code.includes("password_pwned") || code.includes("password_strength"))
          setError("Mot de passe trop faible ou compromis. Essayez un mot de passe plus sécurisé.");
        else if (code.includes("identifier_exists") || code.includes("duplicate"))
          setError("Cette adresse email est déjà utilisée. Connectez-vous à la place.");
        else if (code.includes("strategy") || code.includes("not_allowed"))
          setError("L'inscription par email n'est pas activée. Utilisez Google à la place.");
        else
          setError(firstErr.longMessage ?? firstErr.message ?? "Erreur Clerk inconnue.");
      } else {
        setError((err as Error)?.message ?? "Erreur lors de l'inscription. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signUp, email, password, confirmPassword, prenom, nom, postNom, telephone, age, adresse, cgu]);

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

  const inputStyle = (hasIcon = true): React.CSSProperties => ({
    width: "100%", height: "2.875rem",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "0.75rem",
    paddingLeft: hasIcon ? "2.5rem" : "0.875rem",
    paddingRight: "0.875rem",
    color: "#fff", fontSize: "0.875rem",
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  });

  const labelStyle: React.CSSProperties = {
    display: "block", color: "rgba(255,255,255,0.45)",
    fontSize: "0.68rem", fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.35rem",
  };

  const iconStyle: React.CSSProperties = {
    position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)",
    width: 14, height: 14, color: "rgba(255,255,255,0.25)",
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "rgba(141,198,63,0.5)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center relative overflow-hidden py-8"
      style={{ background: "linear-gradient(160deg, #040d06 0%, #071a0b 40%, #0b2614 100%)" }}>

      {/* Orbes */}
      <div style={{
        position: "fixed", top: "-15%", right: "-10%",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, #15803d 0%, transparent 65%)",
        filter: "blur(80px)", opacity: 0.15, pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", bottom: "-10%", left: "-15%",
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, #8DC63F 0%, transparent 65%)",
        filter: "blur(90px)", opacity: 0.08, pointerEvents: "none",
      }} />

      <div className="relative z-10 w-full max-w-sm mx-auto px-5">

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-baseline gap-0 mb-1">
            <span style={{
              fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif",
              fontWeight: 900, fontStyle: "italic",
              fontSize: "2.8rem", color: "#ffffff",
              letterSpacing: "-0.03em", lineHeight: 1,
              textShadow: "0 0 40px rgba(255,255,255,0.12)",
            }}>halgo</span>
            <span style={{
              fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif",
              fontWeight: 900, fontStyle: "italic",
              fontSize: "2.8rem", color: "#8DC63F",
              letterSpacing: "-0.03em", lineHeight: 1,
              textShadow: "0 0 40px rgba(141,198,63,0.5)",
            }}>Cash</span>
          </div>
          <p style={{
            color: "rgba(255,255,255,0.3)", fontSize: "0.58rem",
            fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase",
          }}>Rapide · Sécurisé · Fiable</p>
        </div>

        {/* Barre de progression */}
        {step !== "verify" && (
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              {STEP_LABELS.slice(0, 3).map((label, i) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: i < stepIndex
                      ? "linear-gradient(135deg, #5a9e1a, #8DC63F)"
                      : i === stepIndex
                        ? "rgba(141,198,63,0.2)"
                        : "rgba(255,255,255,0.06)",
                    border: i === stepIndex ? "1.5px solid #8DC63F" : "1.5px solid transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: "0.3rem",
                    transition: "all 0.3s",
                  }}>
                    {i < stepIndex ? (
                      <CheckCircle2 style={{ width: 14, height: 14, color: "#071a0b" }} />
                    ) : (
                      <span style={{
                        fontSize: "0.7rem", fontWeight: 700,
                        color: i === stepIndex ? "#8DC63F" : "rgba(255,255,255,0.25)",
                      }}>{i + 1}</span>
                    )}
                  </div>
                  <span style={{
                    fontSize: "0.62rem", fontWeight: 600,
                    color: i === stepIndex ? "#8DC63F" : i < stepIndex ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
                    letterSpacing: "0.03em",
                  }}>{label}</span>
                </div>
              ))}
            </div>
            {/* Ligne de progression */}
            <div style={{ height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${(stepIndex / 2) * 100}%`,
                background: "linear-gradient(90deg, #5a9e1a, #8DC63F)",
                borderRadius: 99, transition: "width 0.4s ease",
              }} />
            </div>
          </div>
        )}

        {/* Carte */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "1.5rem",
          padding: "1.75rem 1.5rem",
          backdropFilter: "blur(20px)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: "0.75rem", padding: "0.625rem 0.875rem",
              marginBottom: "1rem",
              display: "flex", alignItems: "flex-start", gap: "0.5rem",
            }}>
              <AlertCircle style={{ width: 14, height: 14, color: "#f87171", flexShrink: 0, marginTop: 2 }} />
              <span style={{ color: "#fca5a5", fontSize: "0.78rem", lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          {/* ── ÉTAPE 1 : IDENTITÉ ── */}
          {step === "identity" && (
            <form onSubmit={nextStep} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <h2 style={{ color: "#fff", fontSize: "1.3rem", fontWeight: 800, marginBottom: "0.2rem", letterSpacing: "-0.02em" }}>
                  Votre identité
                </h2>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8rem", marginBottom: "1.25rem" }}>
                  Étape 1 sur 3
                </p>
              </div>

              {[
                { label: "Nom", value: nom, onChange: setNom, placeholder: "Mukeba" },
                { label: "Post-nom", value: postNom, onChange: setPostNom, placeholder: "Kalenda" },
                { label: "Prénom", value: prenom, onChange: setPrenom, placeholder: "Jean" },
              ].map(({ label, value, onChange, placeholder }) => (
                <div key={label}>
                  <label style={labelStyle}>{label}</label>
                  <div style={{ position: "relative" }}>
                    <User style={iconStyle} />
                    <input
                      type="text" placeholder={placeholder}
                      value={value} onChange={(e) => onChange(e.target.value)}
                      required style={inputStyle()}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                </div>
              ))}

              <button type="submit" style={{
                width: "100%", height: "2.875rem",
                background: "linear-gradient(135deg, #5a9e1a 0%, #8DC63F 50%, #6db82a 100%)",
                border: "none", borderRadius: "0.875rem",
                color: "#071a0b", fontSize: "0.875rem", fontWeight: 800,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                boxShadow: "0 4px 20px rgba(141,198,63,0.25)", marginTop: "0.25rem",
              }}>
                Suivant <ChevronRight style={{ width: 16, height: 16 }} />
              </button>
            </form>
          )}

          {/* ── ÉTAPE 2 : CONTACT ── */}
          {step === "contact" && (
            <form onSubmit={nextStep} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <h2 style={{ color: "#fff", fontSize: "1.3rem", fontWeight: 800, marginBottom: "0.2rem", letterSpacing: "-0.02em" }}>
                  Vos coordonnées
                </h2>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8rem", marginBottom: "1.25rem" }}>
                  Étape 2 sur 3
                </p>
              </div>

              <div>
                <label style={labelStyle}>Email</label>
                <div style={{ position: "relative" }}>
                  <Mail style={iconStyle} />
                  <input type="email" placeholder="votre@email.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    required autoComplete="email" style={inputStyle()}
                    onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Numéro de téléphone</label>
                <div style={{ position: "relative" }}>
                  <Phone style={iconStyle} />
                  <input type="tel" placeholder="+243 8X XXX XXXX"
                    value={telephone} onChange={(e) => setTelephone(e.target.value)}
                    required style={inputStyle()}
                    onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Âge</label>
                <div style={{ position: "relative" }}>
                  <Calendar style={iconStyle} />
                  <input type="number" placeholder="25" min="18" max="120"
                    value={age} onChange={(e) => setAge(e.target.value)}
                    required style={inputStyle()}
                    onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Adresse</label>
                <div style={{ position: "relative" }}>
                  <MapPin style={iconStyle} />
                  <input type="text" placeholder="Kinshasa, Gombe"
                    value={adresse} onChange={(e) => setAdresse(e.target.value)}
                    required style={inputStyle()}
                    onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
                <button type="button" onClick={() => setStep("identity")} style={{
                  flex: 1, height: "2.875rem",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0.875rem",
                  color: "rgba(255,255,255,0.6)", fontSize: "0.875rem", fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                }}>
                  <ChevronLeft style={{ width: 16, height: 16 }} /> Retour
                </button>
                <button type="submit" style={{
                  flex: 2, height: "2.875rem",
                  background: "linear-gradient(135deg, #5a9e1a 0%, #8DC63F 50%, #6db82a 100%)",
                  border: "none", borderRadius: "0.875rem",
                  color: "#071a0b", fontSize: "0.875rem", fontWeight: 800,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                  boxShadow: "0 4px 20px rgba(141,198,63,0.25)",
                }}>
                  Suivant <ChevronRight style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </form>
          )}

          {/* ── ÉTAPE 3 : SÉCURITÉ ── */}
          {step === "security" && (
            <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <h2 style={{ color: "#fff", fontSize: "1.3rem", fontWeight: 800, marginBottom: "0.2rem", letterSpacing: "-0.02em" }}>
                  Sécurité
                </h2>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8rem", marginBottom: "1.25rem" }}>
                  Étape 3 sur 3
                </p>
              </div>

              {/* Mot de passe */}
              <div>
                <label style={labelStyle}>Mot de passe</label>
                <div style={{ position: "relative" }}>
                  <Lock style={iconStyle} />
                  <input type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 caractères"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    required autoComplete="new-password" minLength={8}
                    style={{ ...inputStyle(), paddingRight: "3rem" }}
                    onFocus={onFocus} onBlur={onBlur} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                    position: "absolute", right: "0.875rem", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    color: "rgba(255,255,255,0.3)",
                  }}>
                    {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                  </button>
                </div>
              </div>

              {/* Confirmer */}
              <div>
                <label style={labelStyle}>Confirmer le mot de passe</label>
                <div style={{ position: "relative" }}>
                  <Lock style={iconStyle} />
                  <input type={showConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    required style={{
                      ...inputStyle(),
                      paddingRight: "3rem",
                      borderColor: confirmPassword && confirmPassword !== password
                        ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)",
                    }}
                    onFocus={onFocus} onBlur={onBlur} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{
                    position: "absolute", right: "0.875rem", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    color: "rgba(255,255,255,0.3)",
                  }}>
                    {showConfirm ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p style={{ color: "#f87171", fontSize: "0.72rem", marginTop: "0.25rem" }}>
                    Les mots de passe ne correspondent pas
                  </p>
                )}
              </div>

              {/* CGU */}
              <label style={{
                display: "flex", alignItems: "flex-start", gap: "0.625rem",
                cursor: "pointer", marginTop: "0.25rem",
              }}>
                <div
                  onClick={() => setCgu(!cgu)}
                  style={{
                    width: 20, height: 20, borderRadius: "0.375rem", flexShrink: 0,
                    background: cgu ? "linear-gradient(135deg, #5a9e1a, #8DC63F)" : "rgba(255,255,255,0.05)",
                    border: cgu ? "none" : "1.5px solid rgba(255,255,255,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s", cursor: "pointer", marginTop: 1,
                  }}
                >
                  {cgu && <CheckCircle2 style={{ width: 13, height: 13, color: "#071a0b" }} />}
                </div>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", lineHeight: 1.5 }}>
                  J'accepte les{" "}
                  <a href="#" style={{ color: "#8DC63F", fontWeight: 600, textDecoration: "none" }}>
                    conditions d'utilisation
                  </a>{" "}
                  et la{" "}
                  <a href="#" style={{ color: "#8DC63F", fontWeight: 600, textDecoration: "none" }}>
                    politique de confidentialité
                  </a>
                </span>
              </label>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
                <button type="button" onClick={() => setStep("contact")} style={{
                  flex: 1, height: "2.875rem",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0.875rem",
                  color: "rgba(255,255,255,0.6)", fontSize: "0.875rem", fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                }}>
                  <ChevronLeft style={{ width: 16, height: 16 }} /> Retour
                </button>
                <button type="submit" disabled={!isLoaded || loading} style={{
                  flex: 2, height: "2.875rem",
                  background: loading ? "rgba(141,198,63,0.4)"
                    : "linear-gradient(135deg, #5a9e1a 0%, #8DC63F 50%, #6db82a 100%)",
                  border: "none", borderRadius: "0.875rem",
                  color: "#071a0b", fontSize: "0.875rem", fontWeight: 800,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                  boxShadow: "0 4px 20px rgba(141,198,63,0.25)",
                }}>
                  {loading && <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />}
                  S'inscrire
                </button>
              </div>
            </form>
          )}

          {/* ── ÉTAPE 4 : VÉRIFICATION ── */}
          {step === "verify" && (
            <>
              <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                <div style={{
                  width: "3.5rem", height: "3.5rem", borderRadius: "50%",
                  background: "rgba(141,198,63,0.15)",
                  border: "1px solid rgba(141,198,63,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 1rem",
                }}>
                  <Mail style={{ width: 22, height: 22, color: "#8DC63F" }} />
                </div>
                <h2 style={{ color: "#fff", fontSize: "1.3rem", fontWeight: 800, marginBottom: "0.3rem" }}>
                  Vérifiez votre email
                </h2>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem", lineHeight: 1.5 }}>
                  Code envoyé à{" "}
                  <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>{email}</span>
                </p>
              </div>

              <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ ...labelStyle, textAlign: "center", display: "block" }}>
                    Code de vérification
                  </label>
                  <input
                    type="text" placeholder="• • • • • •"
                    value={code} onChange={(e) => setCode(e.target.value)}
                    required maxLength={6}
                    style={{
                      width: "100%", height: "4rem",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "0.75rem",
                      padding: "0 1rem",
                      color: "#fff", fontSize: "2rem", fontWeight: 700,
                      letterSpacing: "0.5em", textAlign: "center",
                      outline: "none", boxSizing: "border-box",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = "rgba(141,198,63,0.5)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                </div>

                <button type="submit" disabled={!isLoaded || loading} style={{
                  width: "100%", height: "2.875rem",
                  background: loading ? "rgba(141,198,63,0.4)"
                    : "linear-gradient(135deg, #5a9e1a 0%, #8DC63F 50%, #6db82a 100%)",
                  border: "none", borderRadius: "0.875rem",
                  color: "#071a0b", fontSize: "0.875rem", fontWeight: 800,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                  boxShadow: "0 4px 20px rgba(141,198,63,0.25)",
                }}>
                  {loading && <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />}
                  Confirmer mon compte
                </button>

                <button type="button" onClick={() => setStep("security")} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.3)", fontSize: "0.78rem", textAlign: "center", padding: "0.25rem",
                }}>
                  ← Modifier mes informations
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{
          color: "rgba(255,255,255,0.35)", fontSize: "0.82rem",
          textAlign: "center", marginTop: "1.25rem",
        }}>
          Déjà un compte ?{" "}
          <a href="/sign-in" style={{ color: "#8DC63F", fontWeight: 700, textDecoration: "none" }}>
            Se connecter
          </a>
        </p>
      </div>
    </div>
  );
}
