import { useEffect, useState } from "react";
import { ThemeProvider } from "@/lib/theme-context";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Home from "@/pages/home";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import Coupons from "@/pages/coupons";
import TicketsPage from "@/pages/tickets";
import ParrainagePage from "@/pages/parrainage";
import CrashGame from "@/pages/crash";
import RoulettePage from "@/pages/roulette";
import SportPage from "@/pages/sport";
import MinesPage from "@/pages/mines";
import MalettePage from "@/pages/malette";
import DrawsPage from "@/pages/draws";
import WinnersPage from "@/pages/winners";
import JackpotPage from "@/pages/jackpot";
import NotFound from "@/pages/not-found";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import SsoCallbackPage from "@/pages/sso-callback";
import { AgeGate } from "@/components/age-gate";
import {
  ClerkProvider,
  useAuth,
} from "@clerk/react";
import { Loader2 } from "lucide-react";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

// ── Splash screen ─────────────────────────────────────────────────────────────
function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 4400);
    const doneTimer = setTimeout(() => onDone(), 5000);
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <>
      <style>{`
        @keyframes sp-logo-in {
          0%   { opacity: 0; transform: scale(0.7) translateY(16px); }
          70%  { transform: scale(1.05) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes sp-sub-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sp-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40%           { transform: scale(1);   opacity: 1;   }
        }
        @keyframes sp-blob1 {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-22px); }
        }
        @keyframes sp-blob2 {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(18px); }
        }
        @keyframes sp-bar {
          0%   { width: 0%; }
          60%  { width: 75%; }
          85%  { width: 88%; }
          100% { width: 100%; }
        }
        .sp-logo  { animation: sp-logo-in 0.75s cubic-bezier(.34,1.56,.64,1) 0.15s both; }
        .sp-sub   { animation: sp-sub-in 0.5s ease-out 0.6s both; }
        .sp-dots  { animation: sp-sub-in 0.5s ease-out 0.85s both; }
        .sp-dot-1 { animation: sp-dot 1.3s 0.9s  ease-in-out infinite; }
        .sp-dot-2 { animation: sp-dot 1.3s 1.05s ease-in-out infinite; }
        .sp-dot-3 { animation: sp-dot 1.3s 1.2s  ease-in-out infinite; }
        .sp-bar   { animation: sp-bar 2.2s cubic-bezier(.4,0,.2,1) 0.4s both; }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "linear-gradient(160deg, #061a0c 0%, #0a2e14 40%, #0f3d1c 70%, #143d1f 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transition: "opacity 0.6s ease",
          opacity: fading ? 0 : 1,
          pointerEvents: fading ? "none" : "all",
        }}
      >
        <div style={{
          position: "absolute", top: "-5%", right: "-5%",
          width: 320, height: 320, borderRadius: "50%",
          background: "radial-gradient(circle, #15803d 0%, transparent 70%)",
          filter: "blur(60px)", opacity: 0.22,
          animation: "sp-blob1 8s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "10%", left: "-8%",
          width: 260, height: 260, borderRadius: "50%",
          background: "radial-gradient(circle, #166534 0%, transparent 70%)",
          filter: "blur(55px)", opacity: 0.18,
          animation: "sp-blob2 11s ease-in-out infinite 1s",
        }} />
        <div style={{
          position: "absolute", top: "38%", right: "4%",
          width: 140, height: 140, borderRadius: "50%",
          background: "radial-gradient(circle, #22c55e 0%, transparent 70%)",
          filter: "blur(40px)", opacity: 0.15,
          animation: "sp-blob1 13s ease-in-out infinite 2.5s",
        }} />

        <div className="sp-logo" style={{ marginBottom: 20, display: "flex", alignItems: "baseline", gap: 0 }}>
          <span style={{
            fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
            fontWeight: 900, fontStyle: "italic",
            fontSize: "3.2rem", color: "#ffffff",
            letterSpacing: "-0.02em", lineHeight: 1,
            textShadow: "0 4px 24px rgba(255,255,255,0.15)",
          }}>halgo</span>
          <span style={{
            fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
            fontWeight: 900, fontStyle: "italic",
            fontSize: "3.2rem", color: "#8DC63F",
            letterSpacing: "-0.02em", lineHeight: 1,
            textShadow: "0 4px 24px rgba(141,198,63,0.4)",
          }}>Cash</span>
        </div>

        <p className="sp-sub" style={{
          color: "rgba(255,255,255,0.45)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          marginBottom: 40,
        }}>
          Rapide · Sécurisé · Fiable
        </p>

        <div style={{
          width: 180, height: 3, borderRadius: 99,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden", marginBottom: 16,
        }}>
          <div className="sp-bar" style={{
            height: "100%", borderRadius: 99,
            background: "linear-gradient(90deg, #22c55e, #86efac)",
            boxShadow: "0 0 8px rgba(34,197,94,0.7)",
          }} />
        </div>

        <div className="sp-dots" style={{ display: "flex", gap: 6 }}>
          {["sp-dot-1", "sp-dot-2", "sp-dot-3"].map(cls => (
            <div key={cls} className={cls} style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 6px rgba(34,197,94,0.8)",
            }} />
          ))}
        </div>
      </div>
    </>
  );
}

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Invalidate React Query cache when Clerk session changes ───────────────────
function ClerkQueryClientCacheInvalidator() {
  const { isSignedIn } = useAuth();
  useEffect(() => {
    queryClient.invalidateQueries();
  }, [isSignedIn]);
  return null;
}

// ── Auth guard using Clerk ────────────────────────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation("/sign-in");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#0a2e14]">
        <Loader2 className="w-8 h-8 animate-spin text-[#3aab3a]" />
      </div>
    );
  }

  return <>{children}</>;
}

const AppContent = (
  <AgeGate>
    <Layout>
      <Switch>
        <Route path="/app" component={Home} />
        <Route path="/app/coupons" component={Coupons} />
        <Route path="/app/profile" component={Profile} />
        <Route path="/app/settings" component={Settings} />
        <Route path="/app/tickets" component={TicketsPage} />
        <Route path="/app/parrainage" component={ParrainagePage} />
        <Route path="/app/crash" component={CrashGame} />
        <Route path="/app/roulette" component={RoulettePage} />
        <Route path="/app/sport" component={SportPage} />
        <Route path="/app/mines" component={MinesPage} />
        <Route path="/app/malette" component={MalettePage} />
        <Route path="/app/draws" component={DrawsPage} />
        <Route path="/app/winners" component={WinnersPage} />
        <Route path="/app/jackpot" component={JackpotPage} />
        <Route path="/app/*?" component={NotFound} />
      </Switch>
    </Layout>
  </AgeGate>
);

function AppRoutes() {
  return <AuthGuard>{AppContent}</AuthGuard>;
}

function Routes() {
  return (
    <>
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/">
          {() => { window.location.replace(`${basePath}/app`); return null; }}
        </Route>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/sso-callback" component={SsoCallbackPage} />
        <Route path="/app/*?" component={AppRoutes} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
    >
      <ThemeProvider>
        <TooltipProvider>
          {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
          <QueryClientProvider client={queryClient}>
            <WouterRouter base={basePath}>
              <Routes />
            </WouterRouter>
          </QueryClientProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}

export default App;
