import { SignUp } from "@clerk/react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const signUpAppearance = {
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#3aab3a",
    colorBackground: "transparent",
    colorInputBackground: "#ffffff",
    colorInputText: "#1a1a1a",
    colorText: "#1a1a1a",
    colorTextSecondary: "#6b7280",
    colorNeutral: "#374151",
    colorDanger: "#ef4444",
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
      "!border !border-gray-200 !bg-white hover:!bg-gray-50 !text-gray-800 !rounded-xl !py-3.5 !shadow-sm",
    socialButtonsBlockButtonText: "!text-gray-700 !font-medium",
    dividerRow: "!my-3",
    dividerText: "!text-gray-400 !text-xs !uppercase !tracking-widest",
    dividerLine: "!bg-gray-200",
    formFieldLabel: "!text-gray-600 !text-xs !font-medium !mb-1",
    formFieldInput:
      "!bg-white !border !border-gray-200 !text-gray-900 placeholder:!text-gray-400 !rounded-xl !py-3.5 focus:!border-[#3aab3a] focus:!ring-2 focus:!ring-[#3aab3a]/20 !shadow-sm",
    formButtonPrimary:
      "!bg-[#3aab3a] hover:!bg-[#2d8a2d] !text-white !font-black !rounded-xl !py-4 !text-base !uppercase !tracking-widest !shadow-[0_4px_20px_rgba(58,171,58,0.35)] !border-0",
    footerAction: "!bg-transparent !border-0 !shadow-none",
    footerActionText: "!text-gray-500 !text-sm",
    footerActionLink: "!text-[#3aab3a] !font-bold hover:!text-[#2d8a2d]",
    formFieldSuccessText: "!text-[#3aab3a]",
    alertText: "!text-red-600",
    alert: "!bg-red-50 !border !border-red-200 !rounded-xl",
    otpCodeFieldInput: "!bg-white !border !border-gray-200 !text-gray-900 !rounded-xl",
    alternativeMethodsBlockButton: "!text-gray-500 hover:!text-gray-700",
  },
};

export default function SignUpPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 overflow-hidden relative">
      {/* Decorative corners */}
      <div
        className="absolute top-0 right-0 w-48 h-48 pointer-events-none opacity-50"
        style={{
          background: "radial-gradient(circle at top right, #c8e6c9 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-40 h-32 pointer-events-none opacity-30"
        style={{
          background: "linear-gradient(135deg, #a5d6a7 0%, transparent 70%)",
        }}
      />

      <div className="flex-1 overflow-y-auto px-5 pt-8 pb-8">
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <Link href="/sign-in">
            <div className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm cursor-pointer">
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </div>
          </Link>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-sm">
            <span className="text-base">🇨🇩</span>
            <span className="text-xs font-bold text-gray-700">FR</span>
            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Logo */}
        <div className="flex flex-col items-center mb-4">
          <span className="text-[42px] font-black text-[#0f3d1c] tracking-tight leading-none">HALGO</span>
          <div className="flex items-center gap-0.5 -mt-2">
            <span className="text-[42px] font-black italic text-[#3aab3a] tracking-tight leading-none">CASH</span>
            <span className="text-[34px] font-black text-[#F5C518] leading-none">⚡</span>
          </div>
          <p className="text-gray-400 text-[10px] font-semibold tracking-[0.2em] uppercase mt-1">
            RAPIDE • SÉCURISÉ • FIABLE
          </p>
        </div>

        {/* Heading */}
        <h1 className="text-center text-[22px] font-black text-gray-900 mb-0.5">Créer un compte</h1>
        <p className="text-center text-gray-500 text-sm mb-4">
          Rejoignez Halgo Cash et commencez à gagner
        </p>

        {/* Clerk SignUp widget */}
        <div className="w-full">
          <SignUp
            routing="path"
            path={`${basePath}/sign-up`}
            signInUrl={`${basePath}/sign-in`}
            appearance={signUpAppearance}
            forceRedirectUrl={`${basePath}/app`}
          />
        </div>
      </div>
    </div>
  );
}
