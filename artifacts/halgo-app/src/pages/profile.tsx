import { useState } from "react";
import { useUser, useClerk } from "@clerk/react";
import { User, Mail, LogOut, Shield, Phone, Edit3, Check, X, Loader2 } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

export default function Profile() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { isDark } = useTheme();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const clerkPhone = user?.phoneNumbers?.[0]?.phoneNumber ?? null;
  const metaPhone = (user?.unsafeMetadata?.phone as string | undefined) ?? null;
  const savedPhone = clerkPhone ?? metaPhone;
  const hasPhone = !!savedPhone;

  const handleSavePhone = async () => {
    if (!user) return;
    const raw = phoneInput.replace(/\s/g, "");
    if (!raw || raw.length < 8) { setPhoneError("Numéro invalide"); return; }
    setSavingPhone(true);
    setPhoneError(null);
    try {
      await user.update({ unsafeMetadata: { ...user.unsafeMetadata, phone: `+243${raw}` } });
      setEditingPhone(false);
      setPhoneInput("");
    } catch {
      setPhoneError("Erreur lors de la sauvegarde");
    } finally {
      setSavingPhone(false);
    }
  };

  const displayName = user?.fullName ?? user?.username ?? "—";
  const userId = `HG${(user?.id ?? "").slice(-8).toUpperCase()}`;

  const card = isDark ? "bg-[#0f2418] border-white/10" : "bg-white border-gray-100";
  const cardText = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const page = isDark ? "bg-[#080f0a]" : "bg-[#f4f6f4]";
  const iconBg = isDark ? "bg-white/10" : "bg-[#eaf3ec]";
  const iconColor = isDark ? "text-[#8DC63F]" : "text-[#143024]";
  const inputCls = isDark
    ? "bg-black/30 border-white/20 text-white placeholder-gray-600 focus:border-[#3aab3a]"
    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#3aab3a]";

  return (
    <div className={`min-h-dvh transition-colors ${page}`}>
      {/* Header */}
      <div
        className="px-5 pt-10 pb-14"
        style={{ background: "linear-gradient(135deg, #0f3d1c 0%, #1a5c2a 100%)" }}
      >
        <h1 className="text-white font-black text-2xl uppercase tracking-wider">PROFIL</h1>
        <p className="text-white/60 text-sm mt-1">Vos informations personnelles</p>
      </div>

      {/* Avatar card */}
      <div className="-mt-6 mx-4">
        <div className={`rounded-2xl p-5 shadow-sm border flex flex-col items-center gap-3 transition-colors ${card}`}>
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="avatar" className="w-20 h-20 rounded-full object-cover shadow-lg ring-4 ring-[#3aab3a]/30" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0f3d1c] to-[#1a5c2a] flex items-center justify-center shadow-lg">
              <User className="w-10 h-10 text-white" />
            </div>
          )}
          <div className="text-center">
            <p className={`font-black text-xl uppercase ${cardText}`}>{displayName}</p>
            <p className={`text-sm ${sub}`}>Joueur Halgo</p>
          </div>
        </div>
      </div>

      <div className="mx-4 mt-4 space-y-3">

        {/* Nom */}
        <div className={`rounded-2xl p-4 shadow-sm border flex items-center gap-3 transition-colors ${card}`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
            <User className={`w-4 h-4 ${iconColor}`} />
          </div>
          <div>
            <p className={`text-xs uppercase tracking-wide ${sub}`}>Nom complet</p>
            <p className={`font-bold ${cardText}`}>{displayName}</p>
          </div>
        </div>

        {/* Email */}
        <div className={`rounded-2xl p-4 shadow-sm border flex items-center gap-3 transition-colors ${card}`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
            <Mail className={`w-4 h-4 ${iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs uppercase tracking-wide ${sub}`}>Adresse mail</p>
            <p className={`font-bold truncate ${cardText}`}>{user?.primaryEmailAddress?.emailAddress || "—"}</p>
          </div>
        </div>

        {/* Téléphone */}
        <div className={`rounded-2xl p-4 shadow-sm border transition-colors ${card}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
              <Phone className={`w-4 h-4 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs uppercase tracking-wide ${sub}`}>Numéro de téléphone</p>
              {hasPhone ? (
                <p className={`font-bold ${cardText}`}>{savedPhone}</p>
              ) : (
                <p className={`text-sm italic ${isDark ? "text-gray-500" : "text-gray-400"}`}>Non défini</p>
              )}
            </div>
            {!editingPhone && (
              <button
                onClick={() => { setEditingPhone(true); setPhoneInput(metaPhone?.replace("+243", "") ?? ""); }}
                className={`p-2 rounded-full transition-colors ${isDark ? "bg-white/10 hover:bg-white/20" : "bg-gray-100 hover:bg-gray-200"}`}
              >
                <Edit3 className={`w-3.5 h-3.5 ${iconColor}`} />
              </button>
            )}
          </div>

          {/* Edit form */}
          {editingPhone && (
            <div className="mt-3 space-y-2">
              <div className="flex">
                <div className={`flex items-center gap-1.5 px-3 rounded-l-xl border-y border-l text-sm font-bold shrink-0 ${isDark ? "bg-white/5 border-white/20 text-white" : "bg-gray-100 border-gray-200 text-gray-700"}`}>
                  <span>🇨🇩</span> +243
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="8X XXX XXXX"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className={`flex-1 px-3 py-2.5 rounded-r-xl border text-sm outline-none transition-all ${inputCls}`}
                />
              </div>
              {phoneError && <p className="text-red-400 text-xs">{phoneError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSavePhone}
                  disabled={savingPhone || !phoneInput}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  style={{ background: "linear-gradient(135deg, #3aab3a, #2d8a2d)", color: "#fff" }}
                >
                  {savingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Enregistrer</>}
                </button>
                <button
                  onClick={() => { setEditingPhone(false); setPhoneError(null); }}
                  className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1 transition-all ${isDark ? "bg-white/10 text-gray-300" : "bg-gray-100 text-gray-600"}`}
                >
                  <X className="w-4 h-4" /> Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ID Halgo */}
        <div className={`rounded-2xl p-4 shadow-sm border flex items-center gap-3 transition-colors ${card}`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
            <Shield className={`w-4 h-4 ${iconColor}`} />
          </div>
          <div>
            <p className={`text-xs uppercase tracking-wide ${sub}`}>ID Halgo</p>
            <p className={`font-bold font-mono ${isDark ? "text-[#8DC63F]" : "text-[#0f3d1c]"}`}>{isLoaded ? userId : "—"}</p>
          </div>
        </div>

        {/* Déconnexion */}
        <button
          onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })}
          className={`w-full rounded-2xl p-4 shadow-sm border flex items-center gap-3 transition-colors ${isDark ? "bg-red-900/20 border-red-900/30 hover:bg-red-900/30" : "bg-white border-gray-100 hover:bg-red-50"}`}
        >
          <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center">
            <LogOut className="w-4 h-4 text-red-500" />
          </div>
          <span className="font-bold text-red-500">Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
