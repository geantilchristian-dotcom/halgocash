import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Ticket as TicketIcon, Users, Trophy, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/draws", label: "Draws", icon: Coins },
  { href: "/tickets", label: "Tickets", icon: TicketIcon },
  { href: "/vendors", label: "Vendors", icon: Users },
  { href: "/winners", label: "Winners", icon: Trophy },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <aside className="w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col shrink-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold font-sans tracking-tight">Halgo Cash</h1>
          <p className="text-xs text-sidebar-foreground/60 uppercase tracking-widest mt-1">Control Room</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", isActive ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground" : "text-sidebar-foreground/80")}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
