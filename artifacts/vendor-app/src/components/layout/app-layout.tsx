import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  CheckCircle,
  QrCode,
  LogOut,
  LayoutDashboard,
  BarChart2,
  History,
  ReceiptText,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: "/",             label: "Accueil",    icon: LayoutDashboard },
  { href: "/validate",     label: "Vendre",     icon: CheckCircle     },
  { href: "/caisse",       label: "Caisse",     icon: ReceiptText     },
  { href: "/scan-retrait", label: "Retrait",    icon: QrCode          },
  { href: "/historique",   label: "Historique", icon: History         },
];

const HEADER_BG = "linear-gradient(135deg, #0a2010 0%, #0f3d1c 45%, #1a5c2a 80%, #0f3d1c 100%)";

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-[100dvh] w-full flex flex-col" style={{ background: "#f2f5f2" }}>

      {/* ── Header ── */}
      <header
        className="shrink-0 z-20 relative"
        style={{
          background: HEADER_BG,
          boxShadow: "0 4px 24px rgba(10,32,16,0.35)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo */}
          <img
            src="/logo-halgo-cash-nobg.png"
            alt="Halgo Cash"
            className="h-9 object-contain"
          />

          {/* Vendor info + Déconnexion */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-white font-black text-xs leading-none">{user.username}</p>
                {user.vendorId && (
                  <p className="text-white/50 text-[10px] font-medium leading-none mt-0.5">
                    ID&nbsp;#{user.vendorId}
                  </p>
                )}
              </div>
              <button
                onClick={() => logout()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wide transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}
              >
                <LogOut className="w-3 h-3" style={{ width: 12, height: 12 }} />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-auto pb-24 px-4 pt-5 max-w-md mx-auto w-full">
        {children}
      </main>

      {/* ── Bottom Navigation ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 md:max-w-md md:mx-auto"
        style={{
          background: HEADER_BG,
          boxShadow: "0 -4px 20px rgba(10,32,16,0.4)",
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
                  {isActive && (
                    <span
                      className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                      style={{ width: 32, height: 3, background: "#F5C518", borderRadius: "0 0 4px 4px" }}
                    />
                  )}
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                    style={isActive ? { background: "rgba(245,197,24,0.18)" } : {}}
                  >
                    <Icon
                      style={{ width: 18, height: 18, color: isActive ? "#F5C518" : "rgba(255,255,255,0.5)" }}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                  </div>
                  <span
                    className="text-[9px] font-bold uppercase tracking-wide leading-none transition-colors"
                    style={{ color: isActive ? "#F5C518" : "rgba(255,255,255,0.5)" }}
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
