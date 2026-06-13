import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VendorProvider } from "./lib/vendor-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Home from "@/pages/home";
import Validate from "@/pages/validate";
import Claim from "@/pages/claim";
import Login from "@/pages/login";
import Register from "@/pages/register";
import NotFound from "@/pages/not-found";
import ScanRetrait from "@/pages/scan-retrait";
import Rapport from "@/pages/rapport";
import Historique from "@/pages/historique";
import Caisse from "@/pages/caisse";
import { Loader2, ShieldOff } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRouter() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user && location !== "/login" && location !== "/register") {
    return <Redirect to="/login" />;
  }

  if (user && (location === "/login" || location === "/register")) {
    return <Redirect to="/" />;
  }

  // Logged in but not linked to a vendor — full block
  if (user && !user.vendorId && location !== "/login" && location !== "/register") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <ShieldOff className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <p className="text-xl font-black text-gray-900">Accès refusé</p>
          <p className="text-sm text-gray-500 mt-2 max-w-xs">
            Votre compte n'est pas associé à un point de vente.
            Contactez un administrateur Halgo Cash.
          </p>
        </div>
        <button
          onClick={() => fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => window.location.replace("/vx5519-espace/login"))}
          className="px-6 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 active:scale-95 transition-all"
        >
          Se déconnecter
        </button>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={Home} />
      <Route path="/validate" component={Validate} />
      <Route path="/claim" component={Claim} />
      <Route path="/scan-retrait" component={ScanRetrait} />
      <Route path="/rapport" component={Rapport} />
      <Route path="/historique" component={Historique} />
      <Route path="/caisse" component={Caisse} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <VendorProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ProtectedRouter />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </VendorProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
