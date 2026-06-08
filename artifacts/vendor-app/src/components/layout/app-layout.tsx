import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ScanBarcode, CheckCircle, Ticket, Trophy, User, LogOut } from "lucide-react";
import { useVendor } from "../../lib/vendor-context";
import { useAuth } from "../../lib/auth-context";
import { useListVendors } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { selectedVendorId, setSelectedVendorId } = useVendor();
  const { user, logout } = useAuth();
  const { data: vendors } = useListVendors();

  const navItems = [
    { href: "/", label: "Scan", icon: ScanBarcode },
    { href: "/validate", label: "Sell", icon: CheckCircle },
    { href: "/claim", label: "Claim", icon: Trophy },
    { href: "/draws", label: "Draws", icon: Ticket },
  ];

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-muted/30">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-4 bg-black text-white shrink-0 shadow-md z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary text-black flex items-center justify-center font-bold font-mono text-xl">H</div>
          <span className="font-bold text-lg tracking-tight uppercase">Halgo Cash</span>
        </div>
        
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <Select 
            value={selectedVendorId?.toString() ?? ""} 
            onValueChange={(v) => setSelectedVendorId(parseInt(v, 10))}
          >
            <SelectTrigger className="w-[140px] h-9 bg-white/10 border-none text-white focus:ring-primary">
              <SelectValue placeholder="Select Vendor" />
            </SelectTrigger>
            <SelectContent>
              {vendors?.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id.toString()}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {user && (
            <button
              onClick={() => logout()}
              className="text-gray-400 hover:text-white transition-colors p-1"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20 p-4 md:p-6 max-w-md mx-auto w-full">
        {!selectedVendorId ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold">Select Vendor</h2>
            <p className="text-muted-foreground text-sm">Please select a vendor profile from the top menu to start processing tickets.</p>
          </div>
        ) : (
          children
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-border flex shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 md:max-w-md md:mx-auto">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div className={`h-full flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className={`w-6 h-6 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
