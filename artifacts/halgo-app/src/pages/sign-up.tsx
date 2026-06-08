import { useState } from "react";
import { useSignUp, useClerk } from "@clerk/react";
import { Link } from "wouter";
import { Eye, EyeOff, ArrowRight, ArrowLeft, Loader2, CheckCircle } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Step = "form" | "verify" | "done";

export default function SignUpPage() {
  const signUp = useSignUp() as any;
  const { setActive } = useClerk();

  const [step, setStep] = useState<Step>("form");
  const [nom, setNom] = useState("");
  const [postNom, setPostNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Step 1 : créer le compte ─────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;
    setLoading(true);
    setError(null);
    try {
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

  /* ── Styles partagés ─────────────────────────────────────── */
  const fieldBase =
    "w-full pl-9 pr-4 py-3.5 rounded-xl text-gray-800 placeholder-gray-400 text-sm outline-none border border-gray-200 focus:border-[#3aab3a] focus:ring-2 focus:ring-[#3aab3a]/20 transition-all bg-white";
  const fieldWithEye =
    "w-full pl-9 pr-11 py-3.5 rounded-xl text-gray-800 placeholder-gray-400 text-sm outline-none border border-gray-200 focus:border-[#3aab3a] focus:ring-2 focus:ring-[#3aab3a]/20 transition-all bg-white";

  /* ── Icônes SVG inline ───────────────────────────────────── */
  const iconUser = (
    <svg className="w-4 h-4 fill-gray-400" viewBox="0 0 24 24">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12Zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8Z" />
    </svg>
  );
  const iconMail = (
    <svg className="w-4 h-4 fill-gray-400" viewBox="0 0 24 24">
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
  const iconPhone = (
    <svg className="w-4 h-4 fill-gray-400" viewBox="0 0 24 24">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
    </svg>
  );
  const iconLock = (
    <svg className="w-4 h-4 fill-gray-400" viewBox="0 0 24 24">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" />
    </svg>
  );

  /* ── Écran de vérification OTP ───────────────────────────── */
  if (step === "verify") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-5 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Logo compact */}
          <div className="flex flex-col items-center mb-8">
            <span className="text-[38px] font-black text-[#0f3d1c] tracking-tight leading-none">HALGO</span>
            <div className="flex items-center -mt-1">
              <span className="text-[38px] font-black italic text-[#3aab3a] tracking-tight leading-none">CASH</span>
              <span className="text-[30px] font-black text-[#F5C518] leading-none">⚡</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center">
            <div className="w-16 h-16 rounded-full bg-[#eaf3ec] flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-[#3aab3a]" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-1">Vérifiez votre email</h2>
            <p className="text-gray-500 text-sm mb-6">
              Un code de 6 chiffres a été envoyé à{" "}
              <span className="font-semibold text-gray-800">{email}</span>
            </p>

            <form onSubmit={handleVerify} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="_ _ _ _ _ _"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                className="w-full text-center text-3xl font-mono font-black py-4 rounded-xl border-2 border-gray-200 focus:border-[#3aab3a] focus:ring-2 focus:ring-[#3aab3a]/20 outline-none tracking-[0.3em] text-[#0f3d1c] transition-all"
              />
              {error && (
                <div className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-4 rounded-xl font-black text-white text-base uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #0f3d1c, #1a5c2a)",
                  boxShadow: "0 4px 20px rgba(15,61,28,0.3)",
                }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmer"}
              </button>
            </form>

            <button
              onClick={() => { setStep("form"); setOtp(""); setError(null); }}
              className="mt-4 text-gray-400 text-sm hover:text-gray-600 transition-colors"
            >
              ← Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Formulaire principal ────────────────────────────────── */
  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 overflow-hidden relative">
      {/* Décor coins */}
      <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none opacity-50"
        style={{ background: "radial-gradient(circle at top right, #c8e6c9 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 left-0 w-40 h-32 pointer-events-none opacity-30"
        style={{ background: "linear-gradient(135deg, #a5d6a7 0%, transparent 70%)" }} />

      <div className="flex-1 overflow-y-auto px-5 pt-8 pb-8">
        {/* Entête */}
        <div className="flex items-center justify-between mb-5">
          <Link href="/sign-in">
            <div className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm cursor-pointer">
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </div>
          </Link>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-sm">
            <span className="text-base">🇨🇩</span>
            <span className="text-xs font-bold text-gray-700">FR</span>
          </div>
        </div>

        {/* Logo */}
        <div className="flex flex-col items-center mb-4">
          <span className="text-[42px] font-black text-[#0f3d1c] tracking-tight leading-none">HALGO</span>
          <div className="flex items-center -mt-2">
            <span className="text-[42px] font-black italic text-[#3aab3a] tracking-tight leading-none">CASH</span>
            <span className="text-[34px] font-black text-[#F5C518] leading-none">⚡</span>
          </div>
          <p className="text-gray-400 text-[10px] font-semibold tracking-[0.2em] uppercase mt-1">
            RAPIDE • SÉCURISÉ • FIABLE
          </p>
        </div>

        <h1 className="text-center text-[22px] font-black text-gray-900 mb-0.5">Créer un compte</h1>
        <p className="text-center text-gray-500 text-sm mb-5">
          Rejoignez Halgo Cash et commencez à gagner
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">

          {/* Nom */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nom</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">{iconUser}</div>
              <input type="text" placeholder="Ex : Kabila" value={nom}
                onChange={(e) => setNom(e.target.value)} required className={fieldBase} />
            </div>
          </div>

          {/* Post-nom */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Post-nom</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">{iconUser}</div>
              <input type="text" placeholder="Ex : Wa Dondo" value={postNom}
                onChange={(e) => setPostNom(e.target.value)} required className={fieldBase} />
            </div>
          </div>

          {/* Prénom */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Prénom</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">{iconUser}</div>
              <input type="text" placeholder="Ex : Jean-Pierre" value={prenom}
                onChange={(e) => setPrenom(e.target.value)} required className={fieldBase} />
            </div>
          </div>

          {/* Numéro de téléphone */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Numéro de téléphone</label>
            <div className="relative flex">
              <div className="flex items-center gap-1.5 bg-white border border-r-0 border-gray-200 rounded-l-xl px-3 shrink-0">
                <span className="text-sm">🇨🇩</span>
                <span className="text-sm font-bold text-gray-700">+243</span>
              </div>
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">{iconPhone}</div>
                <input type="tel" inputMode="numeric" placeholder="8X XXX XXXX" value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  required className="w-full pl-9 pr-4 py-3.5 rounded-r-xl text-gray-800 placeholder-gray-400 text-sm outline-none border border-gray-200 focus:border-[#3aab3a] focus:ring-2 focus:ring-[#3aab3a]/20 transition-all bg-white" />
              </div>
            </div>
          </div>

          {/* Adresse mail */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Adresse mail</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">{iconMail}</div>
              <input type="email" placeholder="exemple@mail.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required className={fieldBase} />
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Mot de passe</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">{iconLock}</div>
              <input type={showPwd ? "text" : "password"} placeholder="Au moins 8 caractères" value={password}
                onChange={(e) => setPassword(e.target.value)} required minLength={8} className={fieldWithEye} />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !signUp}
            className="w-full py-4 rounded-xl font-black text-white text-base uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 mt-1"
            style={{
              background: "linear-gradient(135deg, #3aab3a, #4dc44d)",
              boxShadow: "0 4px 20px rgba(58,171,58,0.35)",
            }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>S'INSCRIRE <ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-5">
          Vous avez déjà un compte ?{" "}
          <Link href="/sign-in" className="text-[#3aab3a] font-bold hover:text-[#2d8a2d] transition-colors">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
