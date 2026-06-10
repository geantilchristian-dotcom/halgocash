import { useState } from "react";
import { useSignUp, useClerk } from "@clerk/react";
import { Link } from "wouter";
import { Eye, EyeOff, ArrowRight, ArrowLeft, Loader2, CheckCircle, AlertCircle } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Step = "form" | "verify";

export default function SignUpPage() {
  const signUp = useSignUp() as any;
  const { setActive } = useClerk();

  const [step, setStep]       = useState<Step>("form");
  const [nom, setNom]           = useState("");
  const [postNom, setPostNom]   = useState("");
  const [prenom, setPrenom]     = useState("");
  const [phone, setPhone]       = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [referralCode, setReferralCode] = useState(() => {
    try { return localStorage.getItem("halgo_pending_referral") ?? ""; } catch { return ""; }
  });
  const [otp, setOtp]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Step 1 : créer le compte ─────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;
    setLoading(true);
    setError(null);
    try {
      if (referralCode.trim()) {
        try { localStorage.setItem("halgo_pending_referral", referralCode.trim().toUpperCase()); } catch { /* ignore */ }
      }
      await signUp.create({
        firstName: prenom,
        lastName: `${nom} ${postNom}`.trim(),
        emailAddress: email,
        password,
        unsafeMetadata: { postNom, phone },
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err: unknown) {
      const e = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(
        e.errors?.[0]?.longMessage ??
        e.errors?.[0]?.message ??
        "Erreur lors de l'inscription"
      );
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 2 : vérifier l'email ────────────────────────────── */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;
    setLoading(true);
    setError(null);
    try {
      await signUp.attemptEmailAddressVerification({ code: otp });
      if (signUp.status === "complete") {
        await setActive({ session: signUp.createdSessionId });
      }
    } catch (err: unknown) {
      const e = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(e.errors?.[0]?.longMessage ?? e.errors?.[0]?.message ?? "Code invalide");
    } finally {
      setLoading(false);
    }
  };

  /* ── Styles ─────────────────────────────────────────────────── */
  const inputClass =
    "w-full py-3.5 rounded-xl text-white placeholder:text-white/30 text-sm outline-none border transition-all bg-white/[0.07] border-white/15 focus:border-[#3aab3a]/70 focus:ring-2 focus:ring-[#3aab3a]/20";
  const inputLeft = `${inputClass} pl-10 pr-4`;
  const inputEye  = `${inputClass} pl-10 pr-11`;

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
            {/* Logo compact */}
            <div className="flex flex-col items-center mb-8">
              <span className="text-[38px] font-black text-white tracking-tight leading-none">HALGO</span>
              <div className="flex items-center -mt-1">
                <span className="text-[38px] font-black italic text-[#3aab3a] tracking-tight leading-none">CASH</span>
                <span className="text-[30px] font-black text-[#F5C518] leading-none">⚡</span>
              </div>
            </div>

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

        {/* Blobs décoratifs */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,#15803d 0%,transparent 70%)", filter: "blur(50px)", animation: "hg-float 7s ease-in-out infinite", opacity: .2 }} />
        <div className="absolute bottom-24 left-0 w-52 h-52 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,#16a34a 0%,transparent 70%)", filter: "blur(45px)", animation: "hg-float2 9s ease-in-out infinite 1s", opacity: .18 }} />
        <div className="absolute top-1/3 right-2 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,#22c55e 0%,transparent 70%)", filter: "blur(35px)", animation: "hg-float 11s ease-in-out infinite 2s", opacity: .15 }} />

        <div className="flex-1 overflow-y-auto px-5 pt-8 pb-10 relative z-10">

          {/* Header nav */}
          <div className="flex items-center justify-between mb-5">
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

          {/* Logo */}
          <div className="hg-logo flex flex-col items-center mb-4">
            <span className="text-[40px] font-black text-white tracking-tight leading-none">HALGO</span>
            <div className="flex items-center -mt-2">
              <span className="text-[40px] font-black italic text-[#3aab3a] tracking-tight leading-none">CASH</span>
              <span className="text-[32px] font-black text-[#F5C518] leading-none">⚡</span>
            </div>
            <p className="text-white/30 text-[9px] font-bold tracking-[0.25em] uppercase mt-1">RAPIDE · SÉCURISÉ · FIABLE</p>
          </div>

          {/* Titre */}
          <div className="hg-title text-center mb-5">
            <h1 className="text-white text-[22px] font-black mb-0.5">Créer un compte</h1>
            <p className="text-white/40 text-sm">Rejoignez Halgo Cash et commencez à gagner</p>
          </div>

          {/* Formulaire */}
          <div className="hg-form w-full max-w-sm mx-auto">
            <form onSubmit={handleSubmit} className="space-y-3">

              {/* Nom + Post-nom côte à côte */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 block">Nom</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">👤</span>
                    <input type="text" placeholder="Kabila" value={nom}
                      onChange={(e) => setNom(e.target.value)} required className={inputLeft} />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 block">Post-nom</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">👤</span>
                    <input type="text" placeholder="Wa Dondo" value={postNom}
                      onChange={(e) => setPostNom(e.target.value)} required className={inputLeft} />
                  </div>
                </div>
              </div>

              {/* Prénom */}
              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 block">Prénom</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">✏️</span>
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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">📱</span>
                    <input type="tel" inputMode="numeric" placeholder="8X XXX XXXX" value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      required
                      className="w-full pl-10 pr-4 py-3.5 rounded-r-xl text-white placeholder:text-white/30 text-sm outline-none border transition-all"
                      style={{ background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.15)" }} />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 block">Adresse email</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">✉️</span>
                  <input type="email" placeholder="exemple@mail.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} required className={inputLeft} />
                </div>
              </div>

              {/* Mot de passe */}
              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 block">Mot de passe</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔒</span>
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

              {/* Code de parrainage (optionnel) */}
              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  Code de parrainage
                  <span className="text-[8px] rounded-full px-1.5 py-0.5 font-bold" style={{ background: "rgba(58,171,58,0.15)", color: "#3aab3a", border: "1px solid rgba(58,171,58,0.25)" }}>
                    OPTIONNEL · +200 FC 🎁
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🤝</span>
                  <input type="text" placeholder="Ex: HLGAB3X2" value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                    className={inputLeft}
                    style={{ textTransform: "uppercase", letterSpacing: "0.1em" }} />
                </div>
                {referralCode.length > 0 && (
                  <p className="text-[10px] mt-1 text-[#3aab3a]/80">Vous recevrez 200 FC de bonus de bienvenue ✨</p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs rounded-xl px-3 py-2.5"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !signUp}
                className="w-full py-4 rounded-xl font-black text-[#0a2e14] text-base uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-1"
                style={{ background: "linear-gradient(135deg,#3aab3a,#4dc44d)", boxShadow: "0 4px 20px rgba(58,171,58,0.4)" }}>
                {loading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><span>S'INSCRIRE</span><ArrowRight className="w-5 h-5" /></>
                }
              </button>
            </form>

            {/* Séparateur */}
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

            {/* Badge sécurité */}
            <div className="flex items-center justify-center gap-1.5 mt-5">
              <span className="text-[10px] text-white/20">🔐</span>
              <span className="text-[10px] text-white/20">Connexion sécurisée SSL · Halgo Cash</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
