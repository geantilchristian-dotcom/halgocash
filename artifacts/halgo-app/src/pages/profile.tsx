import { useState, useEffect, useCallback } from "react";
import { useUser, useClerk, useAuth } from "@/lib/clerk-compat";
import {
  User, Mail, LogOut, Shield, Phone, Edit3, Check, X, Loader2,
  CheckCircle, Clock, AlertCircle, FileText, Ticket,
  ChevronRight, ChevronDown, UserPlus, Trash2, AlertTriangle,
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useLocation } from "wouter";

interface KycStatus {
  status: "not_submitted" | "pending" | "approved" | "rejected";
  fullName?: string;
  idType?: string;
  adminNote?: string | null;
}

interface PlayerTicketStat { isWinner: boolean; prizeAmount: number | null; }

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".");
}

export default function Profile() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const { isDark } = useTheme();
  const [, navigate] = useLocation();

  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [kyc, setKyc] = useState<KycStatus | null>(null);
  const [kycLoading, setKycLoading] = useState(true);
  const [kycForm, setKycForm] = useState({ fullName: "", birthDate: "", idType: "cni", idNumber: "" });
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [kycError, setKycError] = useState<string | null>(null);
  const [kycOpen, setKycOpen] = useState(false);
  const [stats, setStats] = useState<{ total: number; wins: number; fcWon: number } | null>(null);

  // Account deletion state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Account status (paused/blocked)
  const [accountStatus, setAccountStatus] = useState<"active" | "paused" | "blocked">("active");

  const authFetch = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken().catch(() => null);
    const headers: Record<string, string> = { ...(opts?.headers as Record<string, string> ?? {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...opts, headers, credentials: "include" });
  }, [getToken]);

  useEffect(() => {
    authFetch("/api/kyc")
      .then(r => r.ok ? r.json() as Promise<KycStatus> : null)
      .then(d => {
        if (d) {
          setKyc(d);
          if (d.status === "not_submitted" || d.status === "rejected") setKycOpen(true);
        }
        setKycLoading(false);
      })
      .catch(() => setKycLoading(false));

    authFetch("/api/auth/tickets")
      .then(r => r.ok ? r.json() as Promise<PlayerTicketStat[]> : [])
      .then(tix => {
        const wins = tix.filter(t => t.isWinner);
        setStats({ total: tix.length, wins: wins.length, fcWon: wins.reduce((s, t) => s + (t.prizeAmount ?? 0), 0) });
      })
      .catch(() => {});

    // Check account moderation status
    authFetch("/api/player/status")
      .then(r => r.ok ? r.json() as Promise<{ status: string }> : null)
      .then(d => {
        if (d?.status === "paused" || d?.status === "blocked") {
          setAccountStatus(d.status as "paused" | "blocked");
        }
      })
      .catch(() => {});
  }, [authFetch]);

  const handleSavePhone = async () => {
    if (!user) return;
    const raw = phoneInput.replace(/\s/g, "");
    if (!raw || raw.length < 8) { setPhoneError("Numéro invalide"); return; }
    setSavingPhone(true); setPhoneError(null);
    try {
      await user.update({ unsafeMetadata: { ...user.unsafeMetadata, phone: `+243${raw}` } });
      setEditingPhone(false); setPhoneInput("");
    } catch { setPhoneError("Erreur lors de la sauvegarde"); }
    finally { setSavingPhone(false); }
  };

  const submitKyc = async () => {
    setKycError(null); setKycSubmitting(true);
    try {
      const res = await authFetch("/api/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kycForm),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setKycError(data.error ?? "Erreur"); return; }
      setKyc({ status: "pending", fullName: kycForm.fullName });
      setKycOpen(false);
    } catch { setKycError("Erreur réseau"); }
    finally { setKycSubmitting(false); }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "SUPPRIMER") return;
    setDeleting(true); setDeleteError(null);
    try {
      const res = await authFetch("/api/players/me", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setDeleteError(data.error ?? "Erreur lors de la suppression");
        return;
      }
      await signOut();
    } catch {
      setDeleteError("Erreur réseau. Réessayez.");
    } finally {
      setDeleting(false);
    }
  };

  const clerkPhone = user?.phoneNumbers?.[0]?.phoneNumber ?? null;
  const metaPhone = (user?.unsafeMetadata?.phone as string | undefined) ?? null;
  const savedPhone = clerkPhone ?? metaPhone;
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

  const kycStatusInfo = {
    not_submitted: { icon: Shield,       color: "text-gray-400",  bgCls: "bg-gray-500/10 border-gray-500/20",  label: "Non vérifié"         },
    pending:       { icon: Clock,        color: "text-amber-400", bgCls: "bg-amber-500/10 border-amber-500/20", label: "En cours d'examen"   },
    approved:      { icon: CheckCircle,  color: "text-green-400", bgCls: "bg-green-500/10 border-green-500/20", label: "Identité vérifiée ✓" },
    rejected:      { icon: AlertCircle,  color: "text-red-400",   bgCls: "bg-red-500/10 border-red-500/20",    label: "Dossier refusé"      },
  };
  const kycInfo = kyc ? (kycStatusInfo[kyc.status] ?? kycStatusInfo.not_submitted) : kycStatusInfo.not_submitted;
  const KycIcon = kycInfo.icon;

  return (
    <div className={`min-h-dvh pb-24 transition-colors ${page}`}>
      {/* Header */}
      <div className="px-5 pt-10 pb-14" style={{ background: "linear-gradient(135deg, #0f3d1c 0%, #1a5c2a 100%)" }}>
        <h1 className="text-white font-black text-2xl uppercase tracking-wider">PROFIL</h1>
        <p className="text-white/60 text-sm mt-1">Vos informations personnelles</p>
      </div>

      {/* Account status warning */}
      {accountStatus !== "active" && (
        <div className="mx-4 -mt-2 mb-1">
          <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${accountStatus === "blocked" ? "bg-red-900/40 border border-red-700/40" : "bg-amber-900/40 border border-amber-700/40"}`}>
            <AlertTriangle className={`w-5 h-5 shrink-0 ${accountStatus === "blocked" ? "text-red-400" : "text-amber-400"}`} />
            <div>
              <p className={`font-bold text-sm ${accountStatus === "blocked" ? "text-red-300" : "text-amber-300"}`}>
                {accountStatus === "blocked" ? "Compte bloqué" : "Compte suspendu"}
              </p>
              <p className="text-xs text-white/50 mt-0.5">
                {accountStatus === "blocked"
                  ? "Votre compte a été bloqué. Contactez le support."
                  : "Votre compte est temporairement suspendu. Contactez le support."}
              </p>
            </div>
          </div>
        </div>
      )}

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
            <p className={`text-sm ${sub}`}>Joueur Halgo Cash</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${kycInfo.bgCls} ${kycInfo.color}`}>
            <KycIcon className="w-3 h-3" />{kycInfo.label}
          </span>
        </div>
      </div>

      <div className="mx-4 mt-4 space-y-3">

        {/* Stats */}
        {stats && (
          <div className={`rounded-2xl p-4 shadow-sm border transition-colors ${card}`}>
            <p className={`text-xs font-black uppercase tracking-wider mb-3 ${sub}`}>Statistiques</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Tickets", value: String(stats.total), color: isDark ? "text-[#8DC63F]" : "text-[#0f3d1c]" },
                { label: "Gagnants", value: String(stats.wins), color: "text-green-500" },
                { label: "FC gagnés", value: formatFC(stats.fcWon), color: "text-[#F5C518]" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`font-black text-lg ${s.color}`}>{s.value}</p>
                  <p className={`text-[9px] uppercase tracking-wide ${sub}`}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className={`rounded-2xl shadow-sm border overflow-hidden transition-colors ${card}`}>
          {[
            { icon: Ticket,   label: "Mes tickets", path: "/app/tickets"    },
            { icon: UserPlus, label: "Parrainage",  path: "/app/parrainage" },
          ].map(({ icon: Icon, label, path }) => (
            <button key={path} onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0 transition-colors ${isDark ? "hover:bg-white/5 border-white/5" : "hover:bg-gray-50 border-gray-50"}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBg}`}>
                <Icon className={`w-4 h-4 ${iconColor}`} />
              </div>
              <span className={`font-semibold text-sm flex-1 text-left ${cardText}`}>{label}</span>
              <ChevronRight className={`w-4 h-4 ${sub}`} />
            </button>
          ))}
        </div>

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
              {savedPhone ? (
                <p className={`font-bold ${cardText}`}>{savedPhone}</p>
              ) : (
                <p className={`text-sm italic ${isDark ? "text-gray-500" : "text-gray-400"}`}>Non défini</p>
              )}
            </div>
            {!editingPhone && (
              <button onClick={() => { setEditingPhone(true); setPhoneInput(metaPhone?.replace("+243", "") ?? ""); }}
                className={`p-2 rounded-full transition-colors ${isDark ? "bg-white/10 hover:bg-white/20" : "bg-gray-100 hover:bg-gray-200"}`}>
                <Edit3 className={`w-3.5 h-3.5 ${iconColor}`} />
              </button>
            )}
          </div>
          {editingPhone && (
            <div className="mt-3 space-y-2">
              <div className="flex">
                <div className={`flex items-center gap-1.5 px-3 rounded-l-xl border-y border-l text-sm font-bold shrink-0 ${isDark ? "bg-white/5 border-white/20 text-white" : "bg-gray-100 border-gray-200 text-gray-700"}`}>
                  <span>🇨🇩</span> +243
                </div>
                <input type="tel" inputMode="numeric" placeholder="8X XXX XXXX" value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className={`flex-1 px-3 py-2.5 rounded-r-xl border text-sm outline-none transition-all ${inputCls}`} />
              </div>
              {phoneError && <p className="text-red-400 text-xs">{phoneError}</p>}
              <div className="flex gap-2">
                <button onClick={handleSavePhone} disabled={savingPhone || !phoneInput}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #3aab3a, #2d8a2d)", color: "#fff" }}>
                  {savingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Enregistrer</>}
                </button>
                <button onClick={() => { setEditingPhone(false); setPhoneError(null); }}
                  className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1 ${isDark ? "bg-white/10 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
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

        {/* KYC section */}
        <div className={`rounded-2xl shadow-sm border overflow-hidden transition-colors ${card}`}>
          <button
            onClick={() => { if (kyc?.status !== "pending" && kyc?.status !== "approved") setKycOpen(!kycOpen); }}
            className="w-full flex items-center gap-3 px-4 py-3.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${kycInfo.bgCls}`}>
              <KycIcon className={`w-4 h-4 ${kycInfo.color}`} />
            </div>
            <div className="flex-1 text-left">
              <p className={`text-xs uppercase tracking-wide ${sub}`}>Vérification d'identité (KYC)</p>
              <p className={`font-bold text-sm ${kycInfo.color}`}>{kycLoading ? "Chargement…" : kycInfo.label}</p>
            </div>
            {!kycLoading && kyc?.status !== "pending" && kyc?.status !== "approved" && (
              <ChevronDown className={`w-4 h-4 transition-transform ${kycOpen ? "rotate-180" : ""} ${sub}`} />
            )}
          </button>

          {kyc?.status === "pending" && (
            <div className="px-4 pb-4">
              <p className="text-sm text-amber-400/80 leading-snug">Votre dossier est en cours d'examen. Vous serez notifié dès que la vérification sera terminée.</p>
            </div>
          )}
          {kyc?.status === "approved" && (
            <div className="px-4 pb-4">
              <p className="text-sm text-green-400/80 leading-snug">Votre identité a été vérifiée avec succès. Vous pouvez effectuer des retraits sans restriction.</p>
            </div>
          )}
          {kyc?.status === "rejected" && kyc.adminNote && (
            <div className="px-4 pb-2">
              <p className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${sub}`}>Motif du refus :</p>
              <p className="text-sm text-red-400">{kyc.adminNote}</p>
            </div>
          )}

          {kycOpen && kyc?.status !== "pending" && kyc?.status !== "approved" && (
            <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <p className={`text-xs mt-3 leading-snug ${sub}`}>Remplissez ce formulaire pour vérifier votre identité et accéder à toutes les fonctionnalités sans restriction.</p>

              {[
                { label: "Nom complet", key: "fullName" as const, type: "text", placeholder: "Jean Mukeba Kabila" },
                { label: "Date de naissance", key: "birthDate" as const, type: "date", placeholder: "" },
                { label: "Numéro de la pièce d'identité", key: "idNumber" as const, type: "text", placeholder: "123456789" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <p className={`text-xs font-bold mb-1.5 ${sub}`}>{label}</p>
                  <input type={type} placeholder={placeholder} value={kycForm[key]}
                    onChange={e => setKycForm(f => ({ ...f, [key]: e.target.value }))}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all ${inputCls}`} />
                </div>
              ))}

              <div>
                <p className={`text-xs font-bold mb-1.5 ${sub}`}>Type de pièce d'identité</p>
                <select value={kycForm.idType} onChange={e => setKycForm(f => ({ ...f, idType: e.target.value }))}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none ${inputCls}`}>
                  <option value="cni">Carte Nationale d'Identité (CNI)</option>
                  <option value="passport">Passeport</option>
                  <option value="permis">Permis de conduire</option>
                </select>
              </div>

              {kycError && (
                <p className="text-red-400 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{kycError}
                </p>
              )}

              <button onClick={submitKyc}
                disabled={kycSubmitting || !kycForm.fullName || !kycForm.birthDate || !kycForm.idNumber}
                className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.97]"
                style={{ background: "linear-gradient(135deg, #3aab3a, #2d8a2d)", color: "#fff" }}>
                {kycSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {kycSubmitting ? "Envoi en cours…" : "Soumettre mon dossier KYC"}
              </button>
            </div>
          )}
        </div>

        {/* Déconnexion */}
        <button onClick={() => signOut()}
          className={`w-full rounded-2xl p-4 shadow-sm border flex items-center gap-3 transition-colors ${isDark ? "bg-red-900/20 border-red-900/30 hover:bg-red-900/30" : "bg-white border-gray-100 hover:bg-red-50"}`}>
          <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center">
            <LogOut className="w-4 h-4 text-red-500" />
          </div>
          <span className="font-bold text-red-500">Déconnexion</span>
        </button>

        {/* Supprimer le compte */}
        <button onClick={() => setDeleteOpen(true)}
          className={`w-full rounded-2xl p-4 shadow-sm border flex items-center gap-3 transition-colors ${isDark ? "bg-zinc-900/60 border-white/5 hover:bg-red-900/10" : "bg-white border-gray-100 hover:bg-red-50"}`}>
          <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-red-500/70" />
          </div>
          <div className="text-left">
            <p className={`font-bold text-sm ${isDark ? "text-red-400/70" : "text-red-500/70"}`}>Supprimer mon compte</p>
            <p className={`text-xs ${sub}`}>Efface toutes vos données Halgo Cash</p>
          </div>
        </button>

      </div>

      {/* Delete account modal */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-8">
          <div className={`w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4 ${isDark ? "bg-[#0f1a10] border border-white/10" : "bg-white"}`}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className={`font-black text-base ${cardText}`}>Supprimer mon compte</p>
                <p className={`text-xs ${sub}`}>Action irréversible</p>
              </div>
            </div>

            <div className={`rounded-xl p-3 text-sm leading-snug ${isDark ? "bg-red-900/20 border border-red-800/30 text-red-200" : "bg-red-50 border border-red-100 text-red-700"}`}>
              Toutes vos données seront supprimées : profil, crédits, KYC et messages. Vos tickets et retraits sont conservés pour des raisons comptables.
            </div>

            <div>
              <p className={`text-xs font-bold mb-2 ${sub}`}>Tapez <span className="font-mono text-red-400">SUPPRIMER</span> pour confirmer</p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="SUPPRIMER"
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none font-mono ${inputCls}`}
              />
            </div>

            {deleteError && (
              <p className="text-red-400 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{deleteError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); setDeleteError(null); }}
                className={`flex-1 py-3 rounded-xl font-bold text-sm ${isDark ? "bg-white/10 text-gray-300" : "bg-gray-100 text-gray-600"}`}
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirm !== "SUPPRIMER"}
                className="flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all bg-red-600 text-white"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
