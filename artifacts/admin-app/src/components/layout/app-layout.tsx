import { ReactNode, useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Ticket as TicketIcon,
  LogOut,
  Settings,
  QrCode,
  Menu,
  X,
  Users,
  Users2,
  Store,
  ArrowDownLeft,
  BarChart2,
  Megaphone,
  Trophy,
  Shield,
  MessageSquare,
  ImageIcon,
  Sliders,
  Zap,
  ChevronRight,
  ShieldCheck,
  Dices,
  CalendarCheck,
  Siren,
  Bell,
  MapPin,
  Wifi,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface AppLayoutProps {
  children: ReactNode;
}

interface PendingCounts {
  pendingWithdrawals: number;
  pendingKyc: number;
  unreadSupport: number;
  activeAlarms: number;
  pendingVendors: number;
}

interface VendorNotification {
  userId: number;
  username: string;
  vendorId: number;
  vendorName: string;
  vendorLocation: string;
  lastLoginIp: string | null;
  lastLoginAt: string | null;
  ipStatus: string | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: keyof PendingCounts;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Vue d'ensemble",
    items: [
      { href: "/",       label: "Dashboard",  icon: LayoutDashboard },
    ],
  },
  {
    label: "Tickets",
    items: [
      { href: "/generate-codes", label: "Générer tickets",    icon: QrCode    },
      { href: "/tickets",        label: "Historique tickets", icon: TicketIcon },
    ],
  },
  {
    label: "Joueurs",
    items: [
      { href: "/players",     label: "Joueurs inscrits",    icon: Users2      },
      { href: "/winners",     label: "Classement gagnants", icon: Trophy      },
      { href: "/withdrawals", label: "Retraits joueurs",    icon: ArrowDownLeft, badgeKey: "pendingWithdrawals" },
      { href: "/kyc",         label: "Vérification KYC",   icon: Shield,        badgeKey: "pendingKyc"         },
      { href: "/support",     label: "Support joueurs",     icon: MessageSquare, badgeKey: "unreadSupport"      },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/workers",        label: "Annuaire vendeurs", icon: Users,         },
      { href: "/vendors",        label: "Points de vente",  icon: Store,          },
      { href: "/vendor-reports", label: "Journée vendeurs", icon: CalendarCheck,  badgeKey: "activeAlarms" },
      { href: "/sport-bets",     label: "Paris sportifs",   icon: Dices,          },
      { href: "/rapport",        label: "Rapport",          icon: BarChart2,      },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/publicite",       label: "Publicité",     icon: Megaphone },
      { href: "/game-covers",     label: "Pochettes jeux", icon: ImageIcon },
      { href: "/jackpot-settings",label: "Config Jackpot", icon: Sliders  },
      { href: "/settings",        label: "Paramètres",    icon: Settings  },
    ],
  },
];

const allNavItems = navSections.flatMap((s) => s.items);

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-red-500 text-white leading-none shrink-0">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ── Cloche de notification vendeurs ──────────────────────────────────────────
function VendorNotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery<VendorNotification[]>({
    queryKey: ["/api/admin/vendor-notifications"],
    queryFn: async () => {
      const r = await fetch("/api/admin/vendor-notifications", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const authorizeMutation = useMutation({
    mutationFn: async (userId: number) => {
      const r = await fetch(`/api/admin/workers/${userId}/authorize-ip`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Erreur autorisation");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/vendor-notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/pending-counts"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/workers"] });
    },
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const count = notifications.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
        title="Nouveaux logins vendeurs"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center bg-indigo-500 text-white leading-none">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-72 rounded-xl shadow-2xl border border-zinc-800 bg-zinc-950 z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider">Logins vendeurs</p>
            <span className="text-[10px] text-zinc-600">{count} en attente</span>
          </div>

          {count === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-zinc-600">Aucun nouveau login</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/60">
              {notifications.map((n) => (
                <div key={n.userId} className="px-3 py-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-zinc-100 truncate">{n.vendorName}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 text-zinc-600 shrink-0" />
                        <p className="text-[10px] text-zinc-500 truncate">{n.vendorLocation}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-bold">
                      EN ATTENTE
                    </span>
                  </div>

                  {n.lastLoginIp && (
                    <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20">
                      <Wifi className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span className="text-[10px] font-mono text-indigo-300">{n.lastLoginIp}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => authorizeMutation.mutate(n.userId)}
                      disabled={authorizeMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-colors bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30"
                    >
                      <Check className="w-3 h-3" />
                      {authorizeMutation.isPending ? "…" : "Autoriser et verrouiller"}
                    </button>
                  </div>

                  {n.lastLoginAt && (
                    <p className="text-[9px] text-zinc-700 mt-1.5">
                      {new Date(n.lastLoginAt).toLocaleString("fr-FR")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: counts } = useQuery<PendingCounts>({
    queryKey: ["/api/admin/pending-counts"],
    queryFn: async () => {
      const r = await fetch("/api/admin/pending-counts", { credentials: "include" });
      if (!r.ok) return { pendingWithdrawals: 0, pendingKyc: 0, unreadSupport: 0, activeAlarms: 0, pendingVendors: 0 };
      return r.json();
    },
    refetchInterval: 20_000,
    staleTime: 15_000,
  });

  const totalAlerts = (counts?.pendingWithdrawals ?? 0) + (counts?.pendingKyc ?? 0) + (counts?.unreadSupport ?? 0);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white leading-none">Halgo Cash</h1>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">Control Room</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalAlerts > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href !== "/" && location.startsWith(item.href));
                const badgeCount = item.badgeKey ? (counts?.[item.badgeKey] ?? 0) : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all",
                      isActive
                        ? "bg-indigo-600/15 text-indigo-400 border border-indigo-600/25"
                        : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isActive ? "text-indigo-400" : "text-zinc-500",
                      )}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badgeCount > 0 && <Badge count={badgeCount} />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {user && (
        <div className="px-4 py-3 border-t border-zinc-800/60">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-indigo-400 uppercase">
                {user.username.slice(0, 2)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-200 truncate">{user.username}</p>
              <p className="text-[10px] text-zinc-600 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <LogOut className="h-3 w-3" />
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

  const currentNav = allNavItems.find(
    (n) => location === n.href || (n.href !== "/" && location.startsWith(n.href)),
  );
  const pageTitle = currentNav?.label ?? "Dashboard";

  return (
    <div className="flex h-screen bg-zinc-950 text-foreground overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 border-r border-zinc-800/60 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile topbar */}
        <header className="flex md:hidden items-center gap-3 px-4 py-3 border-b border-zinc-800/60 bg-zinc-950 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm text-white truncate">{pageTitle}</span>
          <div className="ml-auto flex items-center gap-2">
            <VendorNotificationBell />
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Halgo</span>
          </div>
        </header>

        {/* Desktop page header */}
        <div className="hidden md:flex items-center gap-3 px-8 py-4 border-b border-zinc-800/40 bg-zinc-950/80 shrink-0">
          <div className="flex items-center gap-2">
            {currentNav && <currentNav.icon className="w-4 h-4 text-indigo-400" />}
            <h2 className="text-sm font-semibold text-zinc-200">{pageTitle}</h2>
          </div>
          <ChevronRight className="w-3 h-3 text-zinc-700" />
          <span className="text-xs text-zinc-600 font-mono">Halgo Cash Admin</span>
          <div className="ml-auto">
            <VendorNotificationBell />
          </div>
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-6 bg-zinc-950">
          {children}
        </main>
      </div>
    </div>
  );
}
