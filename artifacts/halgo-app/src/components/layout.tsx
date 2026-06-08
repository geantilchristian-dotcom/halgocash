import { Link, useLocation } from "wouter";
import { Home, User, Settings, Ticket } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

const navItems = [
  { href: "/app",          icon: Home,    label: "ACCUEIL"  },
  { href: "/app/coupons",  icon: Ticket,  label: "COUPON"   },
  { href: "/app/profile",  icon: User,    label: "PROFIL"   },
  { href: "/app/settings", icon: Settings,label: "PARAMÈTRE"},
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isDark } = useTheme();

  return (
    <div className={`min-h-dvh flex flex-col transition-colors ${isDark ? "bg-[#080f0a]" : "bg-gray-50"}`}>
      <div className="flex-1 pb-20">
        {children}
      </div>

      <nav
        className={`fixed bottom-0 left-0 right-0 flex justify-around z-50 transition-colors ${
          isDark
            ? "bg-[#0f2418] border-t border-white/10 shadow-[0_-1px_6px_rgba(0,0,0,0.4)]"
            : "bg-white border-t border-gray-100 shadow-[0_-1px_6px_rgba(0,0,0,0.06)]"
        }`}
      >
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = location === href || location.startsWith(href + "/");
          return (
            <Link key={href} href={href} className="flex-1">
              <div className="flex flex-col items-center gap-0.5 py-2 cursor-pointer relative">
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-[#F5C518]" />
                )}
                <Icon
                  className={`w-6 h-6 mt-1 transition-colors ${
                    isActive
                      ? isDark ? "text-[#8DC63F]" : "text-[#0f3d1c]"
                      : isDark ? "text-gray-600" : "text-gray-400"
                  }`}
                />
                <span
                  className={`text-[9px] font-bold uppercase tracking-wide transition-colors ${
                    isActive
                      ? isDark ? "text-[#8DC63F]" : "text-[#0f3d1c]"
                      : isDark ? "text-gray-600" : "text-gray-400"
                  }`}
                >
                  {label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
