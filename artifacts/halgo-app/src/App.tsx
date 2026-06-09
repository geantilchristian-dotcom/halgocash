import { useEffect, useRef } from "react";
import { ThemeProvider } from "@/lib/theme-context";
import { ClerkProvider, useClerk, useAuth, AuthenticateWithRedirectCallback } from "@clerk/react";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Home from "@/pages/home";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import Coupons from "@/pages/coupons";
import NotFound from "@/pages/not-found";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function SsoCallbackPage() {
  return (
    <div
      className="min-h-dvh flex items-center justify-center"
      style={{ background: "linear-gradient(160deg, #0a2e14 0%, #0f3d1c 100%)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-end leading-none">
          <span className="text-[36px] font-black text-white tracking-tight">HALGO</span>
        </div>
        <div className="flex items-center -mt-3">
          <span className="text-[36px] font-black italic text-[#3aab3a] tracking-tight">CASH</span>
          <span className="text-[28px] font-black text-[#F5C518]">⚡</span>
        </div>
        <Loader2 className="w-8 h-8 animate-spin text-[#3aab3a] mt-2" />
        <p className="text-white/50 text-sm">Connexion en cours…</p>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <AuthenticateWithRedirectCallback {...({ signInFallbackRedirectUrl: `${basePath}/app`, signUpFallbackRedirectUrl: `${basePath}/app` } as any)} />
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();

  // If Clerk takes too long (proxy issue, DNS, etc.), redirect to sign-in anyway
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isLoaded) setLocation("/sign-in");
    }, 8000);
    return () => clearTimeout(t);
  }, [isLoaded, setLocation]);

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
  <Layout>
    <Switch>
      <Route path="/app" component={Home} />
      <Route path="/app/coupons" component={Coupons} />
      <Route path="/app/profile" component={Profile} />
      <Route path="/app/settings" component={Settings} />
      <Route path="/app/*?" component={NotFound} />
    </Switch>
  </Layout>
);

function AppRoutes() {
  if (!clerkPubKey) return AppContent;
  return <AuthGuard>{AppContent}</AuthGuard>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function Routes() {
  return (
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
  );
}

function AppWithClerk() {
  const [, setLocation] = useLocation();

  if (!clerkPubKey) {
    return (
      <QueryClientProvider client={queryClient}>
        <Routes />
      </QueryClientProvider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      afterSignOutUrl={`${basePath}/`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Routes />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <AppWithClerk />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
