import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle, Trophy, QrCode, LogOut, LayoutDashboard, BarChart2 } from "lucide-react";
import { useAuth } from "../../lib/auth-context";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { href: "/",              label: "Accueil",   icon: LayoutDashboard },
    { href: "/validate",      label: "Vendre",    icon: CheckCircle     },
    { href: "/scan-retrait",  label: "Retrait",   icon: QrCode          },
    { href: "/claim",         label: "Prix",      icon: Trophy          },
    { href: "/rapport",       label: "Rapport",   icon: BarChart2       },
  ];

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-muted/30">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 bg-black text-white shrink-0 shadow-md z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary text-black flex items-center justify-center font-bold font-mono text-lg rounded-sm">H</div>
          <span className="font-bold text-base tracking-tight uppercase">Halgo Cash</span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <>
              <div className="text-right">
                <p className="text-xs font-bold leading-none text-white/90">{user.username}</p>
                {user.vendorId && (
                  <p className="text-[10px] text-primary/80 leading-none mt-0.5">Vendeur #{user.vendorId}</p>
                )}
              </div>
              <button
                onClick={() => logout()}
                className="text-gray-400 hover:text-white transition-colors p-1"
                title="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20 p-4 md:p-6 max-w-md mx-auto w-full">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-border flex shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 md:max-w-md md:mx-auto">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
                <span className="text-[9px] font-bold uppercase tracking-wide">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
