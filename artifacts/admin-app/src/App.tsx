import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Draws from "@/pages/draws";
import Tickets from "@/pages/tickets";
import Vendors from "@/pages/vendors";
import Winners from "@/pages/winners";
import Login from "@/pages/login";
import Register from "@/pages/register";
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

  const isAuthRoute = location === "/login" || location === "/register";

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
        <Route path="/register" component={Register} />
      </Switch>
    );
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/draws" component={Draws} />
        <Route path="/tickets" component={Tickets} />
        <Route path="/vendors" component={Vendors} />
        <Route path="/winners" component={Winners} />
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
