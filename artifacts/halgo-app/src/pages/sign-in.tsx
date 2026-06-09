import { SignIn } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const logoUrl = `${import.meta.env.BASE_URL}logo-halgo-cash-nobg.png`;

const signInAppearance = {
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#3aab3a",
    colorBackground: "transparent",
    colorInputBackground: "rgba(255,255,255,0.10)",
    colorInputText: "#ffffff",
    colorText: "#ffffff",
    colorTextSecondary: "rgba(255,255,255,0.5)",
    colorNeutral: "#ffffff",
    colorDanger: "#f87171",
    borderRadius: "0.875rem",
    fontFamily: "'Inter', sans-serif",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none !p-0",
    header: "!hidden",
    headerTitle: "!hidden",
    headerSubtitle: "!hidden",
    /* Social buttons */
    socialButtonsBlockButton:
      "!border !border-white/20 !bg-white/[0.07] hover:!bg-white/[0.13] !text-white !rounded-2xl !py-3.5 !transition-all",
    socialButtonsBlockButtonText: "!text-white !font-semibold !text-sm",
    socialButtonsBlockButtonArrow: "!hidden",
    /* Divider */
    dividerRow: "!my-4",
    dividerText: "!text-white/35 !text-[10px] !uppercase !tracking-[0.15em]",
    dividerLine: "!bg-white/10",
    /* Fields */
    formFieldLabel: "!text-white/55 !text-xs !font-medium !mb-1.5 !tracking-wide",
    formFieldInput:
      "!bg-white/[0.09] !border !border-white/15 !text-white placeholder:!text-white/25 !rounded-2xl !py-3.5 !px-4 focus:!border-[#3aab3a]/70 focus:!ring-2 focus:!ring-[#3aab3a]/20 !transition-all",
    /* Primary button */
    formButtonPrimary:
      "!bg-[#3aab3a] hover:!bg-[#44bb44] !text-[#0a2e14] !font-black !rounded-2xl !py-4 !text-sm !uppercase !tracking-[0.15em] !shadow-[0_4px_24px_rgba(58,171,58,0.45)] !border-0 !transition-all",
    formButtonPrimaryText: "!font-black",
    /* Footer */
    footerAction: "!bg-transparent !border-0 !shadow-none !pt-2",
    footerActionText: "!text-white/45 !text-sm",
    footerActionLink: "!text-[#3aab3a] !font-bold hover:!text-[#4dc44d] !transition-colors",
    /* Misc */
    identityPreviewText: "!text-white",
    identityPreviewEditButton: "!text-[#3aab3a]",
    formFieldSuccessText: "!text-[#3aab3a]",
    alertText: "!text-white",
    alert: "!bg-red-900/20 !border !border-red-500/20 !rounded-2xl",
    otpCodeFieldInput: "!bg-white/[0.09] !border !border-white/15 !text-white !rounded-2xl",
    alternativeMethodsBlockButton: "!text-white/55 hover:!text-white",
    /* Hide development mode badge */
    badge: "!hidden",
    internal: "!hidden",
  },
};

export default function SignInPage() {
  return (
    <div
      className="min-h-dvh flex flex-col overflow-hidden relative"
      style={{ background: "linear-gradient(160deg, #0a2e14 0%, #0f3d1c 45%, #143d1f 100%)" }}
    >
      {/* Hide Clerk dev-mode badge globally */}
      <style>{`
        [data-localization-key="badge__dev"],
        [class*="cl-internal"],
        [class*="cl-badge"],
        [data-clerk-badge] { display: none !important; }
      `}</style>

      {/* Background glow blobs */}
      <div
        className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #3aab3a 0%, transparent 70%)", filter: "blur(60px)" }}
      />
      <div
        className="absolute bottom-10 left-0 w-56 h-56 rounded-full opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #8DC63F 0%, transparent 70%)", filter: "blur(50px)" }}
      />

      <div className="flex-1 flex flex-col items-center px-5 pt-14 pb-6 overflow-y-auto">

        {/* ── Logo ── */}
        <div className="mb-8 flex items-center justify-center">
          <img
            src={logoUrl}
            alt="Halgo Cash"
            className="h-20 w-auto object-contain drop-shadow-2xl"
            style={{ filter: "drop-shadow(0 4px 24px rgba(58,171,58,0.35))" }}
          />
        </div>

        {/* ── Title ── */}
        <div className="w-full max-w-sm mb-5">
          <h1 className="text-2xl font-black text-white tracking-tight">Connexion</h1>
          <p className="text-white/45 text-sm mt-1">Accédez à votre compte joueur</p>
        </div>

        {/* ── Clerk SignIn widget ── */}
        <div className="w-full max-w-sm">
          <SignIn
            routing="path"
            path={`${basePath}/sign-in`}
            signUpUrl={`${basePath}/sign-up`}
            appearance={signInAppearance}
            forceRedirectUrl={`${basePath}/app`}
          />
        </div>
      </div>
    </div>
  );
}
