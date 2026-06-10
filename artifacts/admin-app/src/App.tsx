import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Tickets from "@/pages/tickets";
import Login from "@/pages/login";
import GenerateCodes from "@/pages/generate-codes";
import Settings from "@/pages/settings";
import Workers from "@/pages/workers";
import WithdrawalsAdmin from "@/pages/withdrawals-admin";
import Rapport from "@/pages/rapport";
import Publicite from "@/pages/publicite";
import PlayersPage from "@/pages/players";
import WinnersPage from "@/pages/winners";
import KycAdmin from "@/pages/kyc-admin";
import SupportAdmin from "@/pages/support-admin";
import SportBetsAdmin from "@/pages/sport-bets-admin";
import GameCovers from "@/pages/game-covers";
import { AppLayout } from "@/components/layout/app-layout";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRouter() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const isAuthRoute = location === "/login";

  if (!user && !isAuthRoute) {
    return <Redirect to="/login" />;
  }

  if (user && isAuthRoute) {
    return <Redirect to="/" />;
  }

  if (isAuthRoute) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
      </Switch>
    );
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/generate-codes" component={GenerateCodes} />
        <Route path="/tickets" component={Tickets} />
        <Route path="/workers" component={Workers} />
        <Route path="/withdrawals" component={WithdrawalsAdmin} />
        <Route path="/rapport" component={Rapport} />
        <Route path="/publicite" component={Publicite} />
        <Route path="/players" component={PlayersPage} />
        <Route path="/winners" component={WinnersPage} />
        <Route path="/kyc" component={KycAdmin} />
        <Route path="/support" component={SupportAdmin} />
        <Route path="/sport-bets" component={SportBetsAdmin} />
        <Route path="/game-covers" component={GameCovers} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <ProtectedRouter />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
