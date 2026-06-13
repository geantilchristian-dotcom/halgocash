import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  CheckCircle,
  QrCode,
  LayoutDashboard,
  History,
  ReceiptText,
  Siren,
  X,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

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

function AlarmButton() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const trigger = async () => {
    setSending(true);
    try {
      await fetch("/api/vendor/alarm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Alarme déclenchée — besoin d'assistance immédiate" }),
      });
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } catch {
      // silent
    }
    setSending(false);
    setShowConfirm(false);
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={sending}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95"
        style={{ background: "rgba(220,38,38,0.18)", color: sent ? "#86efac" : "#fca5a5", border: "1px solid rgba(220,38,38,0.35)" }}
      >
        <Siren className="w-3.5 h-3.5" />
        {sent ? "Envoyée !" : "Alarme"}
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-28 px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-zinc-900 border border-red-800/40 shadow-2xl p-5">
            <button onClick={() => setShowConfirm(false)} className="absolute top-3 right-3 p-1 text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-600/20 border border-red-600/40 flex items-center justify-center">
                <Siren className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-black text-white text-sm">Déclencher une alarme ?</p>
                <p className="text-xs text-zinc-400">L'admin sera alerté immédiatement.</p>
              </div>
            </div>
            <button
              onClick={() => void trigger()}
              disabled={sending}
              className="w-full py-3 rounded-xl bg-red-600 text-white font-black text-sm hover:bg-red-700 active:scale-[0.98] transition-all"
            >
              {sending ? "Envoi…" : "Confirmer l'alarme"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function LogoutButton() {
  const { logout } = useAuth();
  const [, navigate] = useLocation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      navigate("/login");
    } catch {
      // silent
    }
    setLoading(false);
    setShowConfirm(false);
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)" }}
      >
        <LogOut className="w-3.5 h-3.5" />
        Quitter
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-28 px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700/40 shadow-2xl p-5">
            <button onClick={() => setShowConfirm(false)} className="absolute top-3 right-3 p-1 text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-black text-white text-sm">Se déconnecter ?</p>
                <p className="text-xs text-zinc-400">Vous devrez vous reconnecter pour accéder à l'espace vendeur.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-sm hover:bg-zinc-700 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => void handleLogout()}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl font-black text-sm transition-all active:scale-[0.98]"
                style={{ background: HEADER_BG, color: "#8DC63F" }}
              >
                {loading ? "…" : "Se déconnecter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] w-full flex flex-col" style={{ background: "#f2f5f2" }}>

      {/* ── Top header with alarm + logout ── */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ background: HEADER_BG, boxShadow: "0 2px 12px rgba(10,32,16,0.3)" }}
      >
        <div className="flex items-baseline gap-0 select-none">
          <span style={{
            fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
            fontWeight: 900, fontStyle: "italic",
            fontSize: "1.35rem", color: "#ffffff",
            letterSpacing: "-0.02em", lineHeight: 1,
          }}>halgo</span>
          <span style={{
            fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
            fontWeight: 900, fontStyle: "italic",
            fontSize: "1.35rem", color: "#8DC63F",
            letterSpacing: "-0.02em", lineHeight: 1,
          }}>Cash</span>
        </div>
        <div className="flex items-center gap-2">
          <LogoutButton />
          <AlarmButton />
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-auto pb-24 px-4 pt-3 max-w-md mx-auto w-full">
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
