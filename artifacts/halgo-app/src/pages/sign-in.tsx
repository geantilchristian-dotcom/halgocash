import { useState } from "react";
import { useSignIn, useClerk } from "@clerk/react";
import { Link } from "wouter";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const logoUrl = `${import.meta.env.BASE_URL}logo-halgo-cash-nobg.png`;

/* ── Google SVG icon ───────────────────────────────────────── */
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ width: 20, height: 20 }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default function SignInPage() {
  const signIn = useSignIn() as any;
  const { setActive } = useClerk();

  const [phone, setPhone]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  /* ── Email/phone + password sign-in ─────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signIn.create({
        identifier: phone.includes("@") ? phone : `+243${phone.replace(/\D/g, "")}`,
        password,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
      }
    } catch (err: unknown) {
      const e = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(
        e.errors?.[0]?.longMessage ??
        e.errors?.[0]?.message ??
        "Numéro ou mot de passe incorrect"
      );
    } finally {
      setLoading(false);
    }
  };

  /* ── Google OAuth ────────────────────────────────────────── */
  const handleGoogle = async () => {
    if (!signIn) return;
    setGoogleLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${basePath}/sso-callback`,
        redirectUrlComplete: `${basePath}/app`,
      });
    } catch {
      setGoogleLoading(false);
    }
  };

  /* ── Shared field style ──────────────────────────────────── */
  const fieldCls =
    "w-full pl-10 pr-4 py-3.5 rounded-xl text-gray-800 placeholder-gray-400 text-sm outline-none border border-gray-200 focus:border-[#3aab3a] focus:ring-2 focus:ring-[#3aab3a]/20 transition-all bg-white";

  const iconPhone = (
    <svg className="w-4 h-4 fill-gray-400" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
    </svg>
  );
  const iconLock = (
    <svg className="w-4 h-4 fill-gray-400" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" />
    </svg>
  );

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 overflow-hidden relative">
      {/* Décor coins */}
      <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none opacity-50"
        style={{ background: "radial-gradient(circle at top right, #c8e6c9 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 left-0 w-40 h-32 pointer-events-none opacity-30"
        style={{ background: "linear-gradient(135deg, #a5d6a7 0%, transparent 70%)" }} />

      <div className="flex-1 flex flex-col items-center px-5 pt-10 pb-8 overflow-y-auto">

        {/* ── Logo ── */}
        <div className="mb-5">
          <img
            src={logoUrl}
            alt="Halgo Cash"
            className="h-20 w-auto object-contain"
            style={{ filter: "drop-shadow(0 4px 16px rgba(15,61,28,0.2))" }}
          />
        </div>

        {/* ── Title ── */}
        <div className="text-center mb-6 w-full max-w-sm">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Connexion</h1>
          <p className="text-sm text-gray-400 mt-1">Accédez à votre compte</p>
        </div>

        {/* ── Form card ── */}
        <div className="w-full max-w-sm space-y-4">

          {/* Phone */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
              Numéro de téléphone
            </label>
            <div className="flex">
              <div className="flex items-center gap-1.5 bg-white border border-r-0 border-gray-200 rounded-l-xl px-3 shrink-0">
                <span className="text-sm">🇨🇩</span>
                <span className="text-sm font-bold text-gray-700">+243</span>
              </div>
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">{iconPhone}</div>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="8X XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  required
                  className="w-full pl-9 pr-4 py-3.5 rounded-r-xl text-gray-800 placeholder-gray-400 text-sm outline-none border border-gray-200 focus:border-[#3aab3a] focus:ring-2 focus:ring-[#3aab3a]/20 transition-all bg-white"
                />
              </div>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
              Mot de passe
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">{iconLock}</div>
              <input
                type={showPwd ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`${fieldCls} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Forgot password */}
            <div className="text-right mt-1">
              <Link href="/sign-in/forgot-password"
                className="text-xs text-[#3aab3a] font-semibold hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !signIn || phone.length < 9 || !password}
            className="w-full py-4 rounded-xl font-black text-white text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #3aab3a, #2d9a2d)",
              boxShadow: "0 4px 20px rgba(58,171,58,0.35)",
            }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Se connecter"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">ou</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || !signIn}
            className="w-full py-3.5 rounded-xl font-semibold text-gray-700 text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300"
          >
            {googleLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : <GoogleIcon />}
            Se connecter avec Google
          </button>

          {/* Footer links */}
          <p className="text-center text-gray-500 text-sm pt-2">
            Pas encore de compte ?{" "}
            <Link href="/sign-up" className="text-[#3aab3a] font-bold hover:underline">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
