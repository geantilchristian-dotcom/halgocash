import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Home from "@/pages/home";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
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

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#1e4d35",
    colorForeground: "#0d2318",
    colorMutedForeground: "#5a7a69",
    colorDanger: "#dc2626",
    colorBackground: "#143024",
    colorInput: "#1e4d35",
    colorInputForeground: "#ffffff",
    colorNeutral: "#2d6644",
    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center items-center min-h-[100dvh]",
    cardBox: "bg-[#143024] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-[#0f2019] !rounded-none",
    headerTitle: "text-white font-bold",
    headerSubtitle: "text-[#8DC63F]",
    socialButtonsBlockButtonText: "text-white font-medium",
    socialButtonsBlockButton: "!border-[#2d6644] !bg-[#1e4d35] hover:!bg-[#2d6644]",
    formFieldLabel: "text-[#a8c8b5] font-medium",
    formFieldInput: "!bg-[#1e4d35] !border-[#2d6644] !text-white placeholder:!text-[#5a7a69]",
    formButtonPrimary: "!bg-[#8DC63F] !text-[#143024] font-bold hover:!bg-[#9fd44a]",
    footerActionLink: "text-[#8DC63F] font-semibold hover:text-[#9fd44a]",
    footerActionText: "text-[#a8c8b5]",
    dividerText: "text-[#5a7a69]",
    dividerLine: "!bg-[#2d6644]",
    identityPreviewEditButton: "text-[#8DC63F]",
    formFieldSuccessText: "text-[#8DC63F]",
    alertText: "text-white",
    alert: "!bg-[#1e4d35] !border-[#2d6644]",
    logoBox: "flex justify-center py-2",
    logoImage: "h-12 w-12",
    otpCodeFieldInput: "!bg-[#1e4d35] !border-[#2d6644] !text-white",
    formFieldRow: "gap-3",
    main: "gap-4",
    footerAction: "!bg-[#0f2019]",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#143024] px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#143024] px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function HomeRedirect() {
  const { isLoaded } = useAuth();
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#143024]">
        <Loader2 className="w-8 h-8 animate-spin text-[#8DC63F]" />
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
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Bienvenue sur Halgo Cash",
            subtitle: "Connectez-vous à votre compte",
          },
        },
        signUp: {
          start: {
            title: "Créer un compte",
            subtitle: "Rejoignez la loterie officielle de la RDC",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/app/*?" component={AppRoutes} />
          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
