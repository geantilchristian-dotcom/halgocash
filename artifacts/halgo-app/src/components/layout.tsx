import { Link, useLocation } from "wouter";
import { Home, User, Settings } from "lucide-react";

const navItems = [
  { href: "/app", icon: Home, label: "ACCUEIL" },
  { href: "/app/profile", icon: User, label: "PROFIL" },
  { href: "/app/settings", icon: Settings, label: "PARAMÈTRE" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      <div className="flex-1 pb-20">
        {children}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around z-50 shadow-[0_-1px_6px_rgba(0,0,0,0.06)]">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = location === href || location.startsWith(href + "/");
          return (
            <Link key={href} href={href} className="flex-1">
              <div className="flex flex-col items-center gap-0.5 py-2 cursor-pointer relative">
                {/* Yellow underline indicator at top when active */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-[#F5C518]" />
                )}
                <Icon className={`w-6 h-6 mt-1 transition-colors ${isActive ? "text-[#0f3d1c]" : "text-gray-400"}`} />
                <span className={`text-[9px] font-bold uppercase tracking-wide transition-colors ${isActive ? "text-[#0f3d1c]" : "text-gray-400"}`}>
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
