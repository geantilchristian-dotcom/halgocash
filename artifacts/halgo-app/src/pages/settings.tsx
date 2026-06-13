import { Bell, Globe, Lock, HelpCircle, ChevronRight, Moon, Sun, Smartphone, X, Download } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTheme } from "@/lib/theme-context";

export default function Settings() {
  const { isDark, toggle } = useTheme();
  const [showDownload, setShowDownload] = useState(false);

  const card = isDark ? "bg-[#0f2418] border-white/10" : "bg-white border-gray-100";
  const cardText = isDark ? "text-gray-200" : "text-gray-900";
  const sub = isDark ? "text-gray-500" : "text-gray-400";
  const page = isDark ? "bg-[#080f0a]" : "bg-[#f4f6f4]";
  const sectionLabel = isDark ? "text-gray-500" : "text-gray-400";
  const iconBg = isDark ? "bg-white/10" : "bg-[#eaf3ec]";
  const iconColor = isDark ? "text-[#8DC63F]" : "text-[#143024]";
  const divider = isDark ? "border-white/5" : "border-gray-100";

  return (
    <div className={`min-h-dvh transition-colors ${page}`}>
      {/* Header */}
      <div
        className="px-5 pt-10 pb-14"
        style={{ background: "linear-gradient(135deg, #0f3d1c 0%, #1a5c2a 100%)" }}
      >
        <h1 className="text-white font-black text-2xl uppercase tracking-wider">PARAMÈTRES</h1>
        <p className="text-white/60 text-sm mt-1">Configurer votre application</p>
      </div>

      <div className="-mt-6 mx-4 space-y-4">

        {/* Apparence */}
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider mb-2 px-1 ${sectionLabel}`}>Apparence</p>
          <div className={`rounded-2xl shadow-sm border overflow-hidden transition-colors ${card}`}>
            <button
              onClick={toggle}
              className={`w-full flex items-center gap-3 p-4 transition-colors text-left ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                {isDark ? <Moon className={`w-4 h-4 ${iconColor}`} /> : <Sun className={`w-4 h-4 ${iconColor}`} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${cardText}`}>Mode {isDark ? "sombre" : "clair"}</p>
                <p className={`text-xs ${sub}`}>{isDark ? "Thème nuit activé" : "Thème jour activé"}</p>
              </div>
              {/* Toggle pill */}
              <div
                className={`relative w-11 h-6 rounded-full transition-all duration-300 ${isDark ? "bg-[#3aab3a]" : "bg-gray-200"}`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${isDark ? "left-[calc(100%-1.375rem)]" : "left-0.5"}`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Général */}
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider mb-2 px-1 ${sectionLabel}`}>Général</p>
          <div className={`rounded-2xl shadow-sm border overflow-hidden transition-colors ${card}`}>
            {[
              { icon: Bell, label: "Notifications", sub: "Activer les alertes" },
              { icon: Globe, label: "Langue", sub: "Français" },
            ].map((item, idx) => (
              <button key={item.label}
                className={`w-full flex items-center gap-3 p-4 transition-colors text-left ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"} ${idx > 0 ? `border-t ${divider}` : ""}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                  <item.icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${cardText}`}>{item.label}</p>
                  <p className={`text-xs ${sub}`}>{item.sub}</p>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 ${isDark ? "text-white/20" : "text-gray-300"}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Sécurité */}
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider mb-2 px-1 ${sectionLabel}`}>Sécurité</p>
          <div className={`rounded-2xl shadow-sm border overflow-hidden transition-colors ${card}`}>
            <button className={`w-full flex items-center gap-3 p-4 transition-colors text-left ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                <Lock className={`w-4 h-4 ${iconColor}`} />
              </div>
              <div className="flex-1">
                <p className={`font-bold text-sm ${cardText}`}>Changer le mot de passe</p>
                <p className={`text-xs ${sub}`}>Modifier votre mot de passe</p>
              </div>
              <ChevronRight className={`w-4 h-4 shrink-0 ${isDark ? "text-white/20" : "text-gray-300"}`} />
            </button>
          </div>
        </div>

        {/* Aide */}
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider mb-2 px-1 ${sectionLabel}`}>Aide</p>
          <div className={`rounded-2xl shadow-sm border overflow-hidden transition-colors ${card}`}>
            <button className={`w-full flex items-center gap-3 p-4 transition-colors text-left ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                <HelpCircle className={`w-4 h-4 ${iconColor}`} />
              </div>
              <div className="flex-1">
                <p className={`font-bold text-sm ${cardText}`}>Aide & Support</p>
                <p className={`text-xs ${sub}`}>FAQ et contact</p>
              </div>
              <ChevronRight className={`w-4 h-4 shrink-0 ${isDark ? "text-white/20" : "text-gray-300"}`} />
            </button>
          </div>
        </div>

        {/* Application mobile */}
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider mb-2 px-1 ${sectionLabel}`}>Application mobile</p>
          <div className={`rounded-2xl shadow-sm border overflow-hidden transition-colors ${card}`}>
            <button
              onClick={() => setShowDownload(true)}
              className={`w-full flex items-center gap-3 p-4 transition-colors text-left ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                <Smartphone className={`w-4 h-4 ${iconColor}`} />
              </div>
              <div className="flex-1">
                <p className={`font-bold text-sm ${cardText}`}>Télécharger l'application</p>
                <p className={`text-xs ${sub}`}>Disponible sur Android &amp; iOS</p>
              </div>
              <span
                className="text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg shrink-0"
                style={{ background: "rgba(141,198,63,0.15)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.3)" }}
              >
                GRATUIT
              </span>
            </button>
            <div className={`border-t ${divider}`} />
            <div
              className={`w-full flex items-center gap-3 p-4 text-left opacity-60 cursor-not-allowed`}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(141,198,63,0.10)" }}
              >
                <Download className="w-4 h-4" style={{ color: "#8DC63F" }} />
              </div>
              <div className="flex-1">
                <p className={`font-bold text-sm ${cardText}`}>Télécharger APK Android</p>
                <p className={`text-xs ${sub}`}>Installation directe · Bientôt disponible</p>
              </div>
              <span
                className="text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg shrink-0"
                style={{ background: "rgba(120,120,120,0.12)", color: "#888", border: "1px solid rgba(120,120,120,0.2)" }}
              >
                BIENTÔT
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Download modal ── */}
      {showDownload && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDownload(false)} />
          <div
            className="relative w-full max-w-sm rounded-t-3xl pb-10 px-5 pt-2"
            style={{ background: "#0d1f12", boxShadow: "0 -8px 48px rgba(0,0,0,0.6)" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />
            <button
              onClick={() => setShowDownload(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <X style={{ width: 15, height: 15, color: "rgba(255,255,255,0.5)" }} />
            </button>
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg,#1a5c2a,#8DC63F)", boxShadow: "0 4px 16px rgba(141,198,63,0.4)" }}
              >
                <Smartphone style={{ width: 22, height: 22, color: "#fff" }} strokeWidth={2} />
              </div>
              <div>
                <p className="font-black text-white text-base">HALGO CASH</p>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>Application mobile officielle</p>
              </div>
            </div>
            <div
              className="flex flex-col items-center gap-2 rounded-2xl p-4 mb-5"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="p-3 rounded-xl bg-white">
                <QRCodeSVG value="https://halgocash.com" size={140} />
              </div>
              <p className="text-[11px] text-center font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
                Scannez avec l'appareil photo de votre téléphone
              </p>
            </div>
            {/* Direct APK download — bientôt disponible */}
            <div
              className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl mb-3 opacity-50 cursor-not-allowed"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <Download style={{ width: 20, height: 20, color: "#8DC63F", flexShrink: 0 }} />
              <div className="flex-1 text-left">
                <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.5)" }}>Installation directe</p>
                <p className="text-[14px] font-black text-white leading-tight">APK Android · Bientôt disponible</p>
              </div>
              <span className="text-[10px] font-black bg-white/10 text-white/60 px-2 py-0.5 rounded-lg shrink-0">BIENTÔT</span>
            </div>
            <div className="flex gap-3">
              <a
                href="https://play.google.com/store"
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-2xl active:scale-95 transition-transform"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <span className="text-xl leading-none">▶</span>
                <div className="text-left min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>Disponible sur</p>
                  <p className="text-[13px] font-black text-white leading-tight">Google Play</p>
                </div>
              </a>
              <a
                href="https://apps.apple.com"
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-2xl active:scale-95 transition-transform"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <span className="text-xl leading-none"></span>
                <div className="text-left min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>Disponible sur</p>
                  <p className="text-[13px] font-black text-white leading-tight">App Store</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
