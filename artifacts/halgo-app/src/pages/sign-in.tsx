import { SignIn } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const logoUrl = `${import.meta.env.BASE_URL}halgo-cash-logo.jpg`;

const signInAppearance = {
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#3aab3a",
    colorBackground: "transparent",
    colorInput: "rgba(255,255,255,0.08)",
    colorInputForeground: "#ffffff",
    colorForeground: "#ffffff",
    colorMutedForeground: "rgba(255,255,255,0.5)",
    colorNeutral: "#ffffff",
    colorDanger: "#f87171",
    borderRadius: "0.75rem",
    fontFamily: "'Inter', sans-serif",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none !p-0",
    header: "!hidden",
    headerTitle: "!hidden",
    headerSubtitle: "!hidden",
    socialButtonsBlockButton:
      "!border !border-white/20 !bg-white/[0.06] hover:!bg-white/10 !text-white !rounded-xl !py-3.5",
    socialButtonsBlockButtonText: "!text-white !font-medium",
    socialButtonsBlockButtonArrow: "!hidden",
    dividerRow: "!my-3",
    dividerText: "!text-white/40 !text-xs !uppercase !tracking-widest",
    dividerLine: "!bg-white/15",
    formFieldLabel: "!text-white/60 !text-xs !font-medium !mb-1",
    formFieldInput:
      "!bg-white/[0.08] !border !border-white/15 !text-white placeholder:!text-white/30 !rounded-xl !py-3.5 focus:!border-[#3aab3a]/60 focus:!ring-2 focus:!ring-[#3aab3a]/20",
    formButtonPrimary:
      "!bg-[#3aab3a] hover:!bg-[#4dc44d] !text-[#0a2e14] !font-black !rounded-xl !py-4 !text-base !uppercase !tracking-widest !shadow-[0_4px_20px_rgba(58,171,58,0.4)] !border-0",
    formButtonPrimaryText: "!font-black",
    footerAction: "!bg-transparent !border-0 !shadow-none",
    footerActionText: "!text-white/50 !text-sm",
    footerActionLink: "!text-[#3aab3a] !font-bold hover:!text-[#4dc44d]",
    identityPreviewText: "!text-white",
    identityPreviewEditButton: "!text-[#3aab3a]",
    formFieldSuccessText: "!text-[#3aab3a]",
    alertText: "!text-white",
    alert: "!bg-red-900/20 !border !border-red-500/20 !rounded-xl",
    otpCodeFieldInput: "!bg-white/[0.08] !border !border-white/15 !text-white !rounded-xl",
    alternativeMethodsBlockButton: "!text-white/60 hover:!text-white",
  },
};

export default function SignInPage() {
  return (
    <>
      <style>{`
        @keyframes hg-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: .2; }
          50%       { transform: translateY(-20px) rotate(180deg); opacity: .35; }
        }
        @keyframes hg-float2 {
          0%, 100% { transform: translateY(0px); opacity: .15; }
          50%       { transform: translateY(16px); opacity: .28; }
        }
        @keyframes hg-logo-pop {
          0%   { opacity: 0; transform: scale(0.72) translateY(-10px); }
          65%  { transform: scale(1.06) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes hg-slide-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hg-logo   { animation: hg-logo-pop 0.7s cubic-bezier(.34,1.56,.64,1) both; }
        .hg-title  { animation: hg-slide-up 0.55s 0.2s ease-out both; }
        .hg-widget { animation: hg-slide-up 0.55s 0.35s ease-out both; }
      `}</style>

      <div
        className="min-h-dvh flex flex-col overflow-hidden relative"
        style={{ background: "linear-gradient(160deg, #061a0c 0%, #0a2e14 35%, #0f3d1c 65%, #143d1f 100%)" }}
      >
        {/* Floating blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, #15803d 0%, transparent 70%)", filter: "blur(50px)", animation: "hg-float 7s ease-in-out infinite", opacity: .2 }} />
        <div className="absolute bottom-24 left-0 w-52 h-52 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, #16a34a 0%, transparent 70%)", filter: "blur(45px)", animation: "hg-float2 9s ease-in-out infinite 1s", opacity: .18 }} />
        <div className="absolute top-1/3 right-2 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, #22c55e 0%, transparent 70%)", filter: "blur(35px)", animation: "hg-float 11s ease-in-out infinite 2s", opacity: .15 }} />

        <div className="flex-1 flex flex-col items-center px-5 pt-10 pb-8 overflow-y-auto relative z-10">

          {/* Logo */}
          <div className="hg-logo mb-4">
            <img
              src={logoUrl}
              alt="Halgo Cash"
              style={{
                height: 88, width: "auto", objectFit: "contain",
                filter: "drop-shadow(0 6px 24px rgba(34,197,94,0.55)) drop-shadow(0 2px 8px rgba(0,0,0,0.7))",
              }}
            />
          </div>

          {/* Heading */}
          <div className="hg-title text-center mb-5">
            <h1 className="text-white text-[22px] font-black mb-0.5">Bienvenue de retour !</h1>
            <p className="text-white/50 text-sm">Connectez-vous à votre compte</p>
          </div>

          {/* Clerk SignIn widget — handles Google OAuth natively */}
          <div className="hg-widget w-full max-w-sm">
            <SignIn
              routing="path"
              path={`${basePath}/sign-in`}
              signUpUrl={`${basePath}/sign-up`}
              fallbackRedirectUrl={`${basePath}/app`}
              appearance={signInAppearance}
            />
          </div>
        </div>
      </div>
    </>
  );
}
