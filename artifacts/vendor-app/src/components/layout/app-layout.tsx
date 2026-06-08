import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  CheckCircle,
  Trophy,
  QrCode,
  LogOut,
  LayoutDashboard,
  BarChart2,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: "/",             label: "Accueil",  icon: LayoutDashboard },
  { href: "/validate",     label: "Vendre",   icon: CheckCircle     },
  { href: "/scan-retrait", label: "Retrait",  icon: QrCode          },
  { href: "/claim",        label: "Prix",     icon: Trophy          },
  { href: "/rapport",      label: "Rapport",  icon: BarChart2       },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const currentNav = navItems.find(
    (n) => location === n.href || (n.href !== "/" && location.startsWith(n.href)),
  );

  return (
    <div className="min-h-[100dvh] w-full flex flex-col" style={{ background: "#f8f8fb" }}>

      {/* ── Header ── */}
      <header
        className="shrink-0 z-20 relative"
        style={{
          background: "linear-gradient(135deg, #F97316 0%, #ea580c 100%)",
          boxShadow: "0 4px 24px rgba(249,115,22,0.25)",
        }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-inner"
              style={{ background: "rgba(255,255,255,0.18)" }}
            >
              <span className="font-black text-white text-base leading-none">H</span>
            </div>
            <div className="leading-none">
              <div className="flex items-center gap-1">
                <span className="font-black text-white text-base tracking-tight leading-none">HALGO</span>
                <span className="font-black text-green-300 text-base tracking-tight leading-none">CASH</span>
              </div>
              <p className="text-white/55 text-[9px] font-semibold uppercase tracking-widest mt-0.5">Vendeur</p>
            </div>
          </div>

          {/* User + logout */}
          {user && (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-white font-bold text-xs leading-none">{user.username}</p>
                {user.vendorId && (
                  <p className="text-white/55 text-[10px] font-medium leading-none mt-0.5">
                    Point de vente #{user.vendorId}
                  </p>
                )}
              </div>
              <button
                onClick={() => logout()}
                className="ml-1 w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: "rgba(255,255,255,0.15)" }}
                title="Déconnexion"
              >
                <LogOut className="w-3.5 h-3.5 text-white/80" />
              </button>
            </div>
          )}
        </div>

        {/* Page title strip */}
        {currentNav && (
          <div className="flex items-center gap-1.5 px-5 pb-3">
            <span className="text-white/50 text-[11px] font-semibold">Halgo Cash</span>
            <ChevronRight className="w-3 h-3 text-white/30" />
            <span className="text-white font-bold text-[11px]">{currentNav.label}</span>
          </div>
        )}
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-auto pb-24 px-4 pt-5 max-w-md mx-auto w-full">
        {children}
      </main>

      {/* ── Bottom Navigation ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 md:max-w-md md:mx-auto"
        style={{
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(0,0,0,0.07)",
          boxShadow: "0 -8px 24px rgba(0,0,0,0.07)",
        }}
      >
        <div className="flex h-[60px]">
          {navItems.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div className="h-full flex flex-col items-center justify-center gap-0.5 relative">
                  {/* Active pill */}
                  {isActive && (
                    <span
                      className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                      style={{ width: 32, height: 3, background: "#F97316", borderRadius: "0 0 4px 4px" }}
                    />
                  )}
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                    style={
                      isActive
                        ? { background: "rgba(249,115,22,0.12)" }
                        : {}
                    }
                  >
                    <Icon
                      className={`w-4.5 h-4.5 transition-colors ${isActive ? "text-orange-500" : "text-gray-400"}`}
                      style={{ width: 18, height: 18 }}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                  </div>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wide leading-none transition-colors ${
                      isActive ? "text-orange-500" : "text-gray-400"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
