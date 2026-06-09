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
    <div className={`min-h-dvh transition-colors ${isDark ? "bg-[#040a06]" : "bg-gray-200"} flex justify-center`}>
      <div className={`relative w-full max-w-[430px] min-h-dvh flex flex-col shadow-2xl transition-colors ${isDark ? "bg-[#080f0a]" : "bg-gray-50"}`}>
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
            const isActive = location === href || location.startsWith(href + "/");
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
  );
}
