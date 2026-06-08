import { Link, useLocation } from "wouter";
import { Home, User, Settings } from "lucide-react";

const navItems = [
  { href: "/", icon: Home, label: "ACCUEIL" },
  { href: "/profile", icon: User, label: "PROFIL" },
  { href: "/settings", icon: Settings, label: "PARAMÈTRES" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-dvh bg-[#f4f6f4] flex flex-col">
      <div className="flex-1 pb-16">
        {children}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-2 z-50 shadow-[0_-1px_6px_rgba(0,0,0,0.06)]">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = location === href;
          return (
            <Link key={href} href={href}>
              <div className="flex flex-col items-center gap-0.5 px-6 py-1 cursor-pointer">
                <Icon className={`w-6 h-6 transition-colors ${isActive ? "text-[#143024]" : "text-gray-400"}`} />
                <span className={`text-[9px] font-bold uppercase tracking-wide transition-colors ${isActive ? "text-[#143024]" : "text-gray-400"}`}>
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
