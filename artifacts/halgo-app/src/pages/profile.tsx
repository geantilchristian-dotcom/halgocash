import { useAuth } from "@/lib/auth-context";
import { User, Mail, LogOut, Shield } from "lucide-react";

export default function Profile() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-dvh bg-[#f4f6f4]">
      {/* Header */}
      <div className="bg-[#143024] px-5 pt-10 pb-12">
        <h1 className="text-white font-black text-2xl uppercase tracking-wider">PROFIL</h1>
        <p className="text-white/60 text-sm mt-1">Vos informations personnelles</p>
      </div>

      {/* Avatar card floating */}
      <div className="-mt-6 mx-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-[#143024] flex items-center justify-center shadow-lg">
            <User className="w-10 h-10 text-white" />
          </div>
          <div className="text-center">
            <p className="font-black text-xl text-gray-900 uppercase">{user?.username}</p>
            <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Info list */}
      <div className="mx-4 mt-4 space-y-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#eaf3ec] flex items-center justify-center">
            <User className="w-4 h-4 text-[#143024]" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Identifiant</p>
            <p className="font-bold text-gray-800">{user?.username}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#eaf3ec] flex items-center justify-center">
            <Mail className="w-4 h-4 text-[#143024]" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
            <p className="font-bold text-gray-800">{user?.email}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#eaf3ec] flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#143024]" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Rôle</p>
            <p className="font-bold text-gray-800 capitalize">{user?.role}</p>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 hover:bg-red-50 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
            <LogOut className="w-4 h-4 text-red-500" />
          </div>
          <span className="font-bold text-red-500">Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
