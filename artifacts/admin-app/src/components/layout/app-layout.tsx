import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Ticket as TicketIcon,
  LogOut,
  Settings,
  QrCode,
  Menu,
  X,
  Users,
  ArrowDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: "/",               label: "Dashboard",           icon: LayoutDashboard },
  { href: "/generate-codes", label: "Générer tickets",     icon: QrCode          },
  { href: "/tickets",        label: "Historique tickets",  icon: TicketIcon      },
  { href: "/workers",        label: "Annuaire vendeurs",   icon: Users           },
  { href: "/withdrawals",    label: "Retraits joueurs",    icon: ArrowDownLeft   },
  { href: "/settings",       label: "Paramètres",          icon: Settings        },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between p-5 border-b border-sidebar-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-sidebar-foreground">Halgo Cash</h1>
          <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest mt-0.5">Control Room</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {user && (
        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/70 font-semibold truncate">{user.username}</p>
          <p className="text-xs text-sidebar-foreground/40 truncate mb-3">{user.email}</p>
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  // Derive current page label for mobile topbar
  const currentNav = navItems.find(
    (n) => location === n.href || (n.href !== "/" && location.startsWith(n.href)),
  );
  const pageTitle = currentNav?.label ?? "Dashboard";

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex w-60 border-r bg-sidebar text-sidebar-foreground flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer panel ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile topbar */}
        <header className="flex md:hidden items-center gap-3 px-4 py-3 border-b bg-sidebar text-sidebar-foreground shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm tracking-wide truncate">{pageTitle}</span>
          <span className="ml-auto text-[10px] text-sidebar-foreground/40 uppercase tracking-widest">Halgo Cash</span>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
