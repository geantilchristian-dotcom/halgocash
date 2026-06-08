import { Bell, Globe, Lock, HelpCircle, ChevronRight } from "lucide-react";

const sections = [
  {
    title: "Général",
    items: [
      { icon: Bell, label: "Notifications", sub: "Activer les alertes" },
      { icon: Globe, label: "Langue", sub: "Français" },
    ],
  },
  {
    title: "Sécurité",
    items: [
      { icon: Lock, label: "Changer le mot de passe", sub: "Modifier votre mot de passe" },
    ],
  },
  {
    title: "Aide",
    items: [
      { icon: HelpCircle, label: "Aide & Support", sub: "FAQ et contact" },
    ],
  },
];

export default function Settings() {
  return (
    <div className="min-h-dvh bg-[#f4f6f4]">
      {/* Header */}
      <div className="bg-[#143024] px-5 pt-10 pb-12">
        <h1 className="text-white font-black text-2xl uppercase tracking-wider">PARAMÈTRES</h1>
        <p className="text-white/60 text-sm mt-1">Configurer votre application</p>
      </div>

      <div className="-mt-6 mx-4 space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{section.title}</p>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {section.items.map((item, idx) => (
                <button
                  key={item.label}
                  className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left ${idx > 0 ? "border-t border-gray-100" : ""}`}
                >
                  <div className="w-9 h-9 rounded-full bg-[#eaf3ec] flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-[#143024]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.sub}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
