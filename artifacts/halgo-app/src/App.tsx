import { useEffect, useRef } from "react";
import { ThemeProvider } from "@/lib/theme-context";
import { ClerkProvider, Show, useClerk, useAuth, AuthenticateWithRedirectCallback } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
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

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
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
      <AuthenticateWithRedirectCallback {...({ signInForceRedirectUrl: `${basePath}/app`, signUpForceRedirectUrl: `${basePath}/app` } as any)} />
    </div>
  );
}

function HomeRedirect() {
  const { isLoaded } = useAuth();
  if (!isLoaded) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg, #0a2e14 0%, #0f3d1c 100%)" }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-[#3aab3a]" />
      </div>
    );
  }
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/app" />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function AppRoutes() {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <Switch>
            <Route path="/app" component={Home} />
            <Route path="/app/coupons" component={Coupons} />
            <Route path="/app/profile" component={Profile} />
            <Route path="/app/settings" component={Settings} />
            <Route path="/app/*?" component={NotFound} />
          </Switch>
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
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

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/sso-callback" component={SsoCallbackPage} />
          <Route path="/app/*?" component={AppRoutes} />
          <Route component={NotFound} />
        </Switch>
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
            <ClerkProviderWithRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
