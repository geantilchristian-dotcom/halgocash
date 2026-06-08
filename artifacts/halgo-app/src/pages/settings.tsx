import { Bell, Globe, Lock, HelpCircle, ChevronRight, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

export default function Settings() {
  const { isDark, toggle } = useTheme();

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

      </div>
    </div>
  );
}
