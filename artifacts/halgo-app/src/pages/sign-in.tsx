import { SignIn } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const signInAppearance = {
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#3aab3a",
    colorBackground: "transparent",
    colorInputBackground: "rgba(255,255,255,0.08)",
    colorInputText: "#ffffff",
    colorText: "#ffffff",
    colorTextSecondary: "rgba(255,255,255,0.5)",
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
    <div
      className="min-h-dvh flex flex-col overflow-hidden relative"
      style={{ background: "linear-gradient(160deg, #0a2e14 0%, #0f3d1c 40%, #143d1f 100%)" }}
    >
      {/* Background glow blobs */}
      <div
        className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-20 pointer-events-none"
        style={{
          background: "radial-gradient(circle, #3aab3a 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />
      <div
        className="absolute bottom-20 left-0 w-48 h-48 rounded-full opacity-15 pointer-events-none"
        style={{
          background: "radial-gradient(circle, #8DC63F 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      <div className="flex-1 flex flex-col items-center px-5 pt-10 pb-6 overflow-y-auto">
        {/* Logo */}
        <div className="flex flex-col items-center mb-2">
          <span className="text-[54px] font-black text-white tracking-tight leading-none">HALGO</span>
          <div className="flex items-center gap-1 -mt-2">
            <span className="text-[54px] font-black italic text-[#3aab3a] tracking-tight leading-none">CASH</span>
            <span className="text-[44px] font-black text-[#F5C518] leading-none">⚡</span>
          </div>
          <p className="text-white/40 text-[11px] font-semibold tracking-[0.2em] uppercase mt-1.5">
            RAPIDE • SÉCURISÉ • FIABLE
          </p>
        </div>

        {/* 3D Illustration */}
        <div className="relative w-40 h-40 my-4 flex items-center justify-center">
          {/* Outer glow */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(58,171,58,0.3) 0%, transparent 70%)",
              filter: "blur(15px)",
            }}
          />
          {/* Rings */}
          <div
            className="absolute w-36 h-36 rounded-full border border-[#3aab3a]/30"
            style={{ boxShadow: "0 0 15px rgba(58,171,58,0.2)" }}
          />
          <div className="absolute w-28 h-28 rounded-full border border-[#3aab3a]/15" />
          {/* Central card */}
          <div
            className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #1a5c2a 0%, #0f3d1c 100%)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(58,171,58,0.25)",
            }}
          >
            <svg className="w-10 h-10 fill-white/80" viewBox="0 0 24 24">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12Zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8Z" />
            </svg>
            {/* Lock badge */}
            <div
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#3aab3a] flex items-center justify-center"
              style={{ boxShadow: "0 2px 8px rgba(58,171,58,0.6)" }}
            >
              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            </div>
          </div>
          {/* Coins */}
          <div
            className="absolute top-2 right-3 w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #F5C518, #d4a017)",
              boxShadow: "0 4px 12px rgba(245,197,24,0.5)",
            }}
          >
            <span className="font-black text-white text-xs">₡</span>
          </div>
          <div
            className="absolute bottom-3 left-2 w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #F5C518, #d4a017)",
              boxShadow: "0 4px 12px rgba(245,197,24,0.4)",
            }}
          >
            <span className="font-black text-white" style={{ fontSize: 10 }}>₡</span>
          </div>
        </div>

        {/* Clerk SignIn widget */}
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
