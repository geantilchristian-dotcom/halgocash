import { useUser, useClerk } from "@clerk/react";
import { User, Mail, LogOut, Shield } from "lucide-react";

export default function Profile() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-dvh bg-[#f4f6f4]">
      <div className="bg-[#143024] px-5 pt-10 pb-12">
        <h1 className="text-white font-black text-2xl uppercase tracking-wider">PROFIL</h1>
        <p className="text-white/60 text-sm mt-1">Vos informations personnelles</p>
      </div>

      <div className="-mt-6 mx-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center gap-3">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="avatar" className="w-20 h-20 rounded-full object-cover shadow-lg" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#143024] flex items-center justify-center shadow-lg">
              <User className="w-10 h-10 text-white" />
            </div>
          )}
          <div className="text-center">
            <p className="font-black text-xl text-gray-900 uppercase">{user?.fullName || user?.username || "—"}</p>
            <p className="text-sm text-gray-500">Joueur</p>
          </div>
        </div>
      </div>

      <div className="mx-4 mt-4 space-y-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#eaf3ec] flex items-center justify-center">
            <User className="w-4 h-4 text-[#143024]" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Nom</p>
            <p className="font-bold text-gray-800">{user?.fullName || user?.username || "—"}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#eaf3ec] flex items-center justify-center">
            <Mail className="w-4 h-4 text-[#143024]" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
            <p className="font-bold text-gray-800">{user?.primaryEmailAddress?.emailAddress || "—"}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#eaf3ec] flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#143024]" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">ID Halgo</p>
            <p className="font-bold text-gray-800">HG{(user?.id ?? "").slice(-8).toUpperCase()}</p>
          </div>
        </div>

        <button
          onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })}
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
