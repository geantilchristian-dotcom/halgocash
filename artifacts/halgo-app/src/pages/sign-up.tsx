import { useState } from "react";
import { useSignUp } from "@clerk/react";
import { Link } from "wouter";
import {
  Eye, EyeOff, ArrowRight, ArrowLeft, Loader2,
  CheckCircle, AlertCircle, User, PenLine, Phone,
  Mail, Lock, MapPin, Gift,
} from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function clerkTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject({ _timeout: true }), ms)
    ),
  ]);
}

type Step = "form" | "verify";

export default function SignUpPage() {
  const { signUp, isLoaded: signUpLoaded, setActive } = useSignUp();

  const [step, setStep]           = useState<Step>("form");
  const [nom, setNom]             = useState("");
  const [postNom, setPostNom]     = useState("");
  const [prenom, setPrenom]       = useState("");
  const [phone, setPhone]         = useState("");
  const [email, setEmail]         = useState("");
  const [address, setAddress]     = useState("");
  const [password, setPassword]   = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [referralCode, setReferralCode] = useState(() => {
    try { return localStorage.getItem("halgo_pending_referral") ?? ""; } catch { return ""; }
  });
  const [otp, setOtp]         = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const pwdMatch = confirmPwd.length === 0 || password === confirmPwd;

  /* ── Step 1 : créer le compte ─────────────────────────────── */
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!signUpLoaded || !signUp) return;
    if (!nom.trim() || !prenom.trim() || !email.trim() || !password.trim()) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (password !== confirmPwd) { setError("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 8) { setError("Mot de passe trop court (minimum 8 caractères)."); return; }
    setLoading(true);
    try {
      if (referralCode.trim()) {
        try { localStorage.setItem("halgo_pending_referral", referralCode.trim().toUpperCase()); } catch { /* ignore */ }
      }
      await clerkTimeout(signUp.create({
        firstName: prenom,
        lastName: `${nom} ${postNom}`.trim(),
        emailAddress: email,
        password,
        unsafeMetadata: { postNom, phone, address },
      }));
      await clerkTimeout(signUp.prepareEmailAddressVerification({ strategy: "email_code" }));
      setStep("verify");
    } catch (err: unknown) {
      const e = err as { _timeout?: boolean; errors?: { longMessage?: string; message?: string; code?: string }[]; message?: string };
      if (e._timeout) {
        setError("Réseau trop lent. Vérifiez votre connexion et réessayez.");
      } else {
        const clerkErr = e.errors?.[0];
        const code = clerkErr?.code ?? "";
        const translations: Record<string, string> = {
          form_identifier_exists:      "Email déjà utilisé. Connectez-vous ou utilisez une autre adresse.",
          form_password_pwned:         "Mot de passe trop commun. Choisissez-en un plus sécurisé.",
          form_password_too_short:     "Mot de passe trop court (minimum 8 caractères).",
          form_param_format_invalid:   "Adresse email invalide.",
          form_param_nil:              "Veuillez remplir tous les champs obligatoires.",
          session_exists:              "Vous êtes déjà connecté(e).",
          too_many_requests:           "Trop de tentatives. Réessayez dans quelques minutes.",
          strategy_for_user_not_found: "Méthode de connexion non reconnue pour ce compte.",
        };
        setError(
          translations[code] ??
          clerkErr?.longMessage ??
          clerkErr?.message ??
          e.message ??
          "Erreur lors de l'inscription. Vérifiez vos informations et réessayez."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 2 : vérifier l'email ────────────────────────────── */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;
    setLoading(true);
    setError(null);
    try {
      await clerkTimeout(signUp.attemptEmailAddressVerification({ code: otp }));
      if (signUp.status === "complete") {
        await clerkTimeout(setActive({ session: signUp.createdSessionId }));
      }
    } catch (err: unknown) {
      const e = err as { _timeout?: boolean; errors?: { longMessage?: string; message?: string }[] };
      if (e._timeout) { setError("Réseau trop lent. Réessayez."); }
      else { setError(e.errors?.[0]?.longMessage ?? e.errors?.[0]?.message ?? "Code invalide."); }
    } finally {
      setLoading(false);
    }
  };

  /* ── Classes partagées ───────────────────────────────────────── */
  const inputBase =
    "w-full py-3.5 rounded-xl text-white placeholder:text-white/30 text-sm outline-none border transition-all bg-white/[0.07] border-white/15 focus:border-[#3aab3a]/70 focus:ring-2 focus:ring-[#3aab3a]/20";
  const inputLeft = `${inputBase} pl-10 pr-4`;
  const inputEye  = `${inputBase} pl-10 pr-11`;

  const iconCls = "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30";

  const logoBlock = (
    <div className="flex items-baseline justify-center gap-0 mb-6">
      <span style={{
        fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
        fontWeight: 900, fontStyle: "italic",
        fontSize: "2.6rem", color: "#ffffff",
        letterSpacing: "-0.02em", lineHeight: 1,
      }}>halgo</span>
      <span style={{
        fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
        fontWeight: 900, fontStyle: "italic",
        fontSize: "2.6rem", color: "#8DC63F",
        letterSpacing: "-0.02em", lineHeight: 1,
      }}>Cash</span>
    </div>
  );

  /* ── Écran de vérification OTP ───────────────────────────────── */
  if (step === "verify") {
    return (
      <>
        <style>{`
          @keyframes hg-float {
            0%,100%{transform:translateY(0) rotate(0);opacity:.2}
            50%{transform:translateY(-20px) rotate(180deg);opacity:.35}
          }
          @keyframes hg-float2 {
            0%,100%{transform:translateY(0);opacity:.15}
            50%{transform:translateY(16px);opacity:.28}
          }
          @keyframes hg-slide-up {
            from{opacity:0;transform:translateY(24px)}
            to{opacity:1;transform:translateY(0)}
          }
          .hg-in{animation:hg-slide-up 0.5s ease-out both}
        `}</style>
        <div className="min-h-dvh flex flex-col items-center justify-center px-5 overflow-hidden relative"
          style={{ background: "linear-gradient(160deg,#061a0c 0%,#0a2e14 35%,#0f3d1c 65%,#143d1f 100%)" }}>

          <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle,#15803d 0%,transparent 70%)", filter: "blur(50px)", animation: "hg-float 7s ease-in-out infinite", opacity: .2 }} />
          <div className="absolute bottom-16 left-0 w-52 h-52 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle,#16a34a 0%,transparent 70%)", filter: "blur(45px)", animation: "hg-float2 9s ease-in-out infinite 1s", opacity: .18 }} />

          <div className="hg-in w-full max-w-sm">
            {logoBlock}

            <div className="rounded-3xl p-6 border"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}>

              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(58,171,58,0.15)", border: "1px solid rgba(58,171,58,0.3)" }}>
                <CheckCircle className="w-7 h-7 text-[#3aab3a]" />
              </div>
              <h2 className="text-xl font-black text-white text-center mb-1">Vérifiez votre email</h2>
              <p className="text-white/40 text-sm text-center mb-6">
                Un code à 6 chiffres a été envoyé à{" "}
                <span className="font-semibold text-white/70">{email}</span>
              </p>

              <form onSubmit={handleVerify} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="_ _ _ _ _ _"
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
                  required
                  className="w-full text-center text-3xl font-mono font-black py-4 rounded-xl border-2 outline-none tracking-[0.3em] transition-all"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    borderColor: error ? "rgba(239,68,68,0.6)" : otp.length === 6 ? "rgba(58,171,58,0.6)" : "rgba(255,255,255,0.15)",
                    color: "#fff",
                  }}
                />

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-xs rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full py-4 rounded-xl font-black text-[#0a2e14] text-base uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#3aab3a,#4dc44d)", boxShadow: "0 4px 20px rgba(58,171,58,0.4)" }}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmer le code"}
                </button>
              </form>

              <button
                onClick={() => { setStep("form"); setOtp(""); setError(null); }}
                className="w-full mt-3 text-white/40 text-sm hover:text-white/60 transition-colors text-center py-1">
                ← Modifier mes informations
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Formulaire principal ──────────────────────────────────── */
  return (
    <>
      <style>{`
        @keyframes hg-float {
          0%,100%{transform:translateY(0) rotate(0);opacity:.2}
          50%{transform:translateY(-20px) rotate(180deg);opacity:.35}
        }
        @keyframes hg-float2 {
          0%,100%{transform:translateY(0);opacity:.15}
          50%{transform:translateY(16px);opacity:.28}
        }
        @keyframes hg-logo-pop {
          0%{opacity:0;transform:scale(0.72) translateY(-10px)}
          65%{transform:scale(1.06) translateY(0)}
          100%{opacity:1;transform:scale(1) translateY(0)}
        }
        @keyframes hg-slide-up {
          from{opacity:0;transform:translateY(24px)}
          to{opacity:1;transform:translateY(0)}
        }
        .hg-logo{animation:hg-logo-pop 0.7s cubic-bezier(.34,1.56,.64,1) both}
        .hg-title{animation:hg-slide-up 0.55s 0.15s ease-out both}
        .hg-form{animation:hg-slide-up 0.55s 0.28s ease-out both}
      `}</style>

      <div className="min-h-dvh flex flex-col overflow-hidden relative"
        style={{ background: "linear-gradient(160deg,#061a0c 0%,#0a2e14 35%,#0f3d1c 65%,#143d1f 100%)" }}>

        <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,#15803d 0%,transparent 70%)", filter: "blur(50px)", animation: "hg-float 7s ease-in-out infinite", opacity: .2 }} />
        <div className="absolute bottom-24 left-0 w-52 h-52 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,#16a34a 0%,transparent 70%)", filter: "blur(45px)", animation: "hg-float2 9s ease-in-out infinite 1s", opacity: .18 }} />
        <div className="absolute top-1/3 right-2 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,#22c55e 0%,transparent 70%)", filter: "blur(35px)", animation: "hg-float 11s ease-in-out infinite 2s", opacity: .15 }} />

        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-10 relative z-10">

          {/* Header nav */}
          <div className="flex items-center justify-between mb-4">
            <Link href={`${basePath}/sign-in`}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
                <ArrowLeft className="w-4 h-4 text-white/70" />
              </div>
            </Link>
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <span className="text-base">🇨🇩</span>
              <span className="text-xs font-bold text-white/70">FR</span>
            </div>
          </div>

          {/* Logo centré */}
          <div className="hg-logo text-center">
            <div className="flex items-baseline justify-center gap-0">
              <span style={{
                fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
                fontWeight: 900, fontStyle: "italic",
                fontSize: "2.6rem", color: "#ffffff",
                letterSpacing: "-0.02em", lineHeight: 1,
              }}>halgo</span>
              <span style={{
                fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
                fontWeight: 900, fontStyle: "italic",
                fontSize: "2.6rem", color: "#8DC63F",
                letterSpacing: "-0.02em", lineHeight: 1,
              }}>Cash</span>
            </div>
          </div>

          {/* Titre */}
          <div className="hg-title text-center mt-3 mb-5">
            <h1 className="text-white text-[17px] font-black">Créer un compte</h1>
          </div>

          {/* Formulaire */}
          <div className="hg-form w-full max-w-sm mx-auto">
            <form onSubmit={handleSubmit} className="space-y-3">

              {/* Nom + Post-nom */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 block">Nom</label>
                  <div className="relative">
                    <User className={iconCls} />
                    <input type="text" placeholder="Kabila" value={nom}
                      onChange={(e) => setNom(e.target.value)} required className={inputLeft} />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 block">Post-nom</label>
                  <div className="relative">
                    <User className={iconCls} />
                    <input type="text" placeholder="Wa Dondo" value={postNom}
                      onChange={(e) => setPostNom(e.target.value)} required className={inputLeft} />
                  </div>
                </div>
              </div>

              {/* Prénom */}
              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 block">Prénom</label>
                <div className="relative">
                  <PenLine className={iconCls} />
                  <input type="text" placeholder="Jean-Pierre" value={prenom}
                    onChange={(e) => setPrenom(e.target.value)} required className={inputLeft} />
                </div>
              </div>

              {/* Téléphone */}
              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 block">Numéro de téléphone</label>
                <div className="flex">
                  <div className="flex items-center gap-1.5 px-3 shrink-0 rounded-l-xl border border-r-0"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.15)" }}>
                    <span className="text-sm">🇨🇩</span>
                    <span className="text-sm font-black text-white/70">+243</span>
                  </div>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input type="tel" inputMode="numeric" placeholder="8X XXX XXXX" value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      required
                      className="w-full pl-10 pr-4 py-3.5 rounded-r-xl text-white placeholder:text-white/30 text-sm outline-none border transition-all"
                      style={{ background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.15)" }} />
                  </div>
                </div>
              </div>

              {/* Adresse */}
              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 block">Adresse</label>
                <div className="relative">
                  <MapPin className={iconCls} />
                  <input type="text" placeholder="Quartier, avenue, commune..." value={address}
                    onChange={(e) => setAddress(e.target.value)} required className={inputLeft} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 block">Adresse email</label>
                <div className="relative">
                  <Mail className={iconCls} />
                  <input type="email" placeholder="exemple@mail.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} required className={inputLeft} />
                </div>
              </div>

              {/* Mot de passe */}
              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 block">Mot de passe</label>
                <div className="relative">
                  <Lock className={iconCls} />
                  <input type={showPwd ? "text" : "password"} placeholder="Au moins 8 caractères" value={password}
                    onChange={(e) => setPassword(e.target.value)} required minLength={8} className={inputEye} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password.length > 0 && password.length < 8 && (
                  <p className="text-[10px] mt-1 text-orange-400/80">Au moins 8 caractères requis</p>
                )}
              </div>

              {/* Confirmer mot de passe */}
              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 block">Confirmer le mot de passe</label>
                <div className="relative">
                  <Lock className={iconCls} />
                  <input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Répétez votre mot de passe"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    required
                    className={`${inputEye} ${confirmPwd.length > 0 && !pwdMatch ? "!border-red-500/60 !focus:ring-red-500/20" : ""}`}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPwd.length > 0 && !pwdMatch && (
                  <p className="text-[10px] mt-1 text-red-400/80">Les mots de passe ne correspondent pas</p>
                )}
                {confirmPwd.length > 0 && pwdMatch && password.length >= 8 && (
                  <p className="text-[10px] mt-1 text-[#3aab3a]/80">Mots de passe identiques</p>
                )}
              </div>

              {/* Code de parrainage */}
              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  Code de parrainage
                  <span className="text-[8px] rounded-full px-1.5 py-0.5 font-bold" style={{ background: "rgba(58,171,58,0.15)", color: "#3aab3a", border: "1px solid rgba(58,171,58,0.25)" }}>
                    OPTIONNEL · +200 FC
                  </span>
                </label>
                <div className="relative">
                  <Gift className={iconCls} />
                  <input type="text" placeholder="Ex: HLGAB3X2" value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                    className={inputLeft}
                    style={{ textTransform: "uppercase", letterSpacing: "0.1em" }} />
                </div>
                {referralCode.length > 0 && (
                  <p className="text-[10px] mt-1 text-[#3aab3a]/80">Vous recevrez 200 FC de bonus de bienvenue</p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs rounded-xl px-3 py-2.5"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
                </div>
              )}

              <button
                type="button"
                onClick={() => { void handleSubmit(); }}
                disabled={!signUpLoaded || loading}
                className="w-full py-4 rounded-xl font-black text-[#0a2e14] text-base uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-1"
                style={{ background: "linear-gradient(135deg,#3aab3a,#4dc44d)", boxShadow: "0 4px 20px rgba(58,171,58,0.4)" }}>
                {(!signUpLoaded || loading)
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><span>S'INSCRIRE</span><ArrowRight className="w-5 h-5" /></>
                }
              </button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />
              <span className="text-white/30 text-[10px] uppercase tracking-widest">ou</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />
            </div>

            <p className="text-center text-white/40 text-sm">
              Vous avez déjà un compte ?{" "}
              <Link href={`${basePath}/sign-in`} className="text-[#3aab3a] font-bold hover:text-[#4dc44d] transition-colors">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
