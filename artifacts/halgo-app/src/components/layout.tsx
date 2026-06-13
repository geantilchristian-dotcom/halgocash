import { Link, useLocation } from "wouter";
import { Home, User, Settings, Ticket, Gamepad2, Trophy } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

const navItems = [
  { href: "/app",              icon: Home,      label: "Accueil"    },
  { href: "/app/coupons",      icon: Ticket,    label: "Coupon"     },
  { href: "/app/profile",      icon: User,      label: "Profil"     },
  { href: "/app/settings",     icon: Settings,  label: "Paramètres" },
];

const gameItems = [
  { href: "/app/crash",    label: "Crash"   },
  { href: "/app/roulette", label: "Roulette"},
  { href: "/app/malette",  label: "Malette" },
  { href: "/app/mines",    label: "Mines"   },
  { href: "/app/sport",    label: "Sport"   },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isDark } = useTheme();

  const bg     = isDark ? "bg-[#040a06]" : "bg-gray-200";
  const cardBg = isDark ? "bg-[#080f0a]" : "bg-gray-50";

  return (
    <div className={`min-h-dvh transition-colors ${bg}`}>

      {/* ── MOBILE layout (< md) ─────────────────────────────────────────── */}
      <div className={`md:hidden flex justify-center min-h-dvh`}>
        <div className={`relative w-full max-w-[430px] min-h-dvh flex flex-col shadow-2xl ${cardBg}`}>
          <div className="flex-1 pb-20">
            {children}
          </div>

          <nav
            className="fixed bottom-0 z-50 w-full max-w-[430px] flex justify-around"
            style={{
              background: "linear-gradient(90deg, #0a1f0e 0%, #0f3d1c 40%, #16a34a 100%)",
              boxShadow: "0 -4px 20px rgba(10,31,14,0.45)",
            }}
          >
            {navItems.map(({ href, icon: Icon, label }) => {
              const isActive = location === href || (href !== "/app" && location.startsWith(href));
              return (
                <Link key={href} href={href} className="flex-1">
                  <div className="flex flex-col items-center gap-0.5 py-2 cursor-pointer relative">
                    {isActive && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-[#F5C518]" />
                    )}
                    <Icon
                      className="w-6 h-6 mt-1 transition-colors"
                      style={{ color: isActive ? "#F5C518" : "rgba(255,255,255,0.45)" }}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                    <span
                      className="text-[9px] font-bold uppercase tracking-wide transition-colors"
                      style={{ color: isActive ? "#F5C518" : "rgba(255,255,255,0.45)" }}
                    >
                      {label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── DESKTOP layout (≥ md) ────────────────────────────────────────── */}
      <div className="hidden md:flex min-h-dvh">

        {/* Sidebar */}
        <aside
          className="fixed top-0 left-0 h-full w-60 z-40 flex flex-col"
          style={{
            background: isDark
              ? "linear-gradient(180deg, #060e07 0%, #09180a 100%)"
              : "linear-gradient(180deg, #e8f5e9 0%, #c8e6c9 100%)",
            borderRight: "1px solid rgba(141,198,63,0.15)",
            boxShadow: "4px 0 24px rgba(0,0,0,0.4)",
          }}
        >
          {/* Logo */}
          <div className="px-6 pt-7 pb-6" style={{ borderBottom: "1px solid rgba(141,198,63,0.12)" }}>
            <div className="flex items-baseline gap-0">
              <span
                style={{
                  fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
                  fontWeight: 900, fontStyle: "italic",
                  fontSize: "1.7rem", color: isDark ? "#ffffff" : "#0a1f0e",
                  letterSpacing: "-0.02em", lineHeight: 1,
                }}
              >halgo</span>
              <span
                style={{
                  fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
                  fontWeight: 900, fontStyle: "italic",
                  fontSize: "1.7rem", color: "#8DC63F",
                  letterSpacing: "-0.02em", lineHeight: 1,
                }}
              >Cash</span>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] mt-1"
              style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.35)" }}>
              Rapide · Sécurisé · Fiable
            </p>
          </div>

          {/* Main nav */}
          <nav className="flex-1 px-3 pt-4 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            <p className="px-3 mb-2 text-[9px] font-black uppercase tracking-[0.25em]"
              style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)" }}>
              Navigation
            </p>
            {navItems.map(({ href, icon: Icon, label }) => {
              const isActive = location === href || (href !== "/app" && location.startsWith(href));
              return (
                <Link key={href} href={href}>
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 cursor-pointer transition-all"
                    style={{
                      background: isActive
                        ? "rgba(141,198,63,0.15)"
                        : "transparent",
                      border: isActive
                        ? "1px solid rgba(141,198,63,0.3)"
                        : "1px solid transparent",
                    }}
                  >
                    <Icon
                      className="w-4 h-4 flex-none"
                      style={{ color: isActive ? "#8DC63F" : isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)" }}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                    <span
                      className="text-sm font-bold"
                      style={{ color: isActive ? "#8DC63F" : isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)" }}
                    >
                      {label}
                    </span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#8DC63F]" />
                    )}
                  </div>
                </Link>
              );
            })}

            {/* Games section */}
            <p className="px-3 mt-5 mb-2 text-[9px] font-black uppercase tracking-[0.25em]"
              style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)" }}>
              Jeux
            </p>
            {gameItems.map(({ href, label }) => {
              const isActive = location === href || location.startsWith(href + "/");
              return (
                <Link key={href} href={href}>
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 cursor-pointer transition-all"
                    style={{
                      background: isActive ? "rgba(245,197,24,0.12)" : "transparent",
                      border: isActive ? "1px solid rgba(245,197,24,0.25)" : "1px solid transparent",
                    }}
                  >
                    <Gamepad2
                      className="w-4 h-4 flex-none"
                      style={{ color: isActive ? "#F5C518" : isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
                      strokeWidth={1.8}
                    />
                    <span
                      className="text-sm font-bold"
                      style={{ color: isActive ? "#F5C518" : isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)" }}
                    >
                      {label}
                    </span>
                  </div>
                </Link>
              );
            })}

            {/* Winners quick link */}
            <p className="px-3 mt-5 mb-2 text-[9px] font-black uppercase tracking-[0.25em]"
              style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)" }}>
              Loterie
            </p>
            {[
              { href: "/app/draws",   label: "Tirages"  },
              { href: "/app/winners", label: "Gagnants" },
              { href: "/app/jackpot", label: "Jackpot"  },
              { href: "/app/tickets", label: "Tickets"  },
            ].map(({ href, label }) => {
              const isActive = location === href;
              return (
                <Link key={href} href={href}>
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 cursor-pointer transition-all"
                    style={{
                      background: isActive ? "rgba(129,140,248,0.12)" : "transparent",
                      border: isActive ? "1px solid rgba(129,140,248,0.25)" : "1px solid transparent",
                    }}
                  >
                    <Trophy
                      className="w-4 h-4 flex-none"
                      style={{ color: isActive ? "#818cf8" : isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
                      strokeWidth={1.8}
                    />
                    <span
                      className="text-sm font-bold"
                      style={{ color: isActive ? "#818cf8" : isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)" }}
                    >
                      {label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer version */}
          <div className="px-6 py-4" style={{ borderTop: "1px solid rgba(141,198,63,0.1)" }}>
            <p className="text-[9px]" style={{ color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.25)" }}>
              © 2026 Halgo Cash · RDC
            </p>
          </div>
        </aside>

        {/* Main content */}
        <main
          className="flex-1 ml-60 min-h-dvh overflow-y-auto"
          style={{ background: isDark ? "#080f0a" : "#f5f5f5" }}
        >
          {/* Constrain wide content to readable max-width, centred */}
          <div className="mx-auto w-full max-w-3xl px-6 py-6">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}
