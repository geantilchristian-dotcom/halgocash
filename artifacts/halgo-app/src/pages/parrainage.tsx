import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/clerk-compat";
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeft, Copy, CheckCircle, Users, Share2, Gift, Trophy, Star } from "lucide-react";
import { useLocation } from "wouter";

interface Profile {
  referralCode: string;
  referralCount: number;
  referralTickets: number;
}

function formatCode(raw: string) {
  return raw.slice(0, 3) + "-" + raw.slice(3);
}

const LEVELS = [
  { name: "Débutant", min: 0,  max: 0,  color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  { name: "Bronze",   min: 1,  max: 2,  color: "#d97706", bg: "rgba(217,119,6,0.12)"   },
  { name: "Argent",   min: 3,  max: 9,  color: "#94a3b8", bg: "rgba(148,163,184,0.15)" },
  { name: "Or",       min: 10, max: 24, color: "#F5C518", bg: "rgba(245,197,24,0.12)"  },
  { name: "Platine",  min: 25, max: Infinity, color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
];

function getLevel(n: number) {
  return LEVELS.find(l => n >= l.min && n <= l.max) ?? LEVELS[0]!;
}

export default function ParrainagePage() {
  const { getToken } = useAuth();
  const [, navigate] = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [copied, setCopied] = useState(false);

  const authFetch = useCallback(async (url: string) => {
    const token = await getToken().catch(() => null);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { headers, credentials: "include" });
  }, [getToken]);

  useEffect(() => {
    authFetch("/api/auth/profile").then(r => r.ok ? r.json() : null).then((d: Profile | null) => { if (d) setProfile(d); }).catch(() => {});
  }, [authFetch]);

  const referralCode = profile?.referralCode ?? "";
  const referralCount = profile?.referralCount ?? 0;
  const level = getLevel(referralCount);
  const shareUrl = `https://www.halgocash.com?ref=${referralCode}`;
  const shareText = `Rejoins-moi sur Halgo Cash ⚡ et reçois 200 FC de bonus ! Utilise mon code parrainage : ${referralCode ? formatCode(referralCode) : "—"}\n${shareUrl}`;

  const copy = () => {
    navigator.clipboard.writeText(shareText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = () => {
    if (navigator.share) navigator.share({ text: shareText }).catch(() => {});
    else copy();
  };

  const nextLevel = LEVELS.find(l => l.min > referralCount);
  const needed = nextLevel ? nextLevel.min - referralCount : 0;

  return (
    <div className="min-h-dvh pb-24" style={{ background: "#0b1612" }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-6" style={{ background: "linear-gradient(135deg,#0d2e14 0%,#1a4a22 100%)" }}>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate("/app")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
            <ChevronLeft style={{ width: 18, height: 18, color: "#fff" }} />
          </button>
          <div>
            <h1 className="text-white font-black text-xl uppercase tracking-wide">Parrainage</h1>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>Invitez vos amis et gagnez des tickets</p>
          </div>
        </div>

        {/* Level badge */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
          style={{ background: level.bg, border: `1px solid ${level.color}30` }}>
          <Star style={{ width: 20, height: 20, color: level.color }} />
          <div>
            <p className="font-black text-sm" style={{ color: level.color }}>Niveau {level.name}</p>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              {referralCount} filleul{referralCount !== 1 ? "s" : ""}
              {nextLevel && needed > 0 && ` · encore ${needed} pour ${nextLevel.name}`}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="font-black text-2xl text-white">{referralCount}</p>
            <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>filleuls</p>
          </div>
        </div>

        {/* QR Code card */}
        <div className="flex flex-col items-center gap-4 px-5 py-5 rounded-2xl"
          style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(141,198,63,0.2)" }}>
          {referralCode ? (
            <>
              <div className="p-3 rounded-2xl" style={{ background: "#fff" }}>
                <QRCodeSVG value={shareUrl} size={160} bgColor="#ffffff" fgColor="#0a1f0e" level="M" />
              </div>
              <p className="font-mono font-black text-2xl tracking-[0.25em]" style={{ color: "#8DC63F" }}>
                {formatCode(referralCode)}
              </p>
              <p className="text-[10px] text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
                Partagez ce QR ou ce code pour inviter vos amis
              </p>
            </>
          ) : (
            <div className="py-8 flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Chargement…</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-3">
        {/* Share buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={share}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wide transition-all active:scale-[0.97]"
            style={{ background: "linear-gradient(135deg,#3aab3a,#4dc44d)", color: "#0a2e14" }}>
            <Share2 style={{ width: 16, height: 16 }} /> Partager
          </button>
          <button onClick={copy}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wide transition-all active:scale-[0.97]"
            style={{ background: copied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)", color: copied ? "#22c55e" : "#fff", border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.12)"}` }}>
            {copied ? <CheckCircle style={{ width: 16, height: 16 }} /> : <Copy style={{ width: 16, height: 16 }} />}
            {copied ? "Copié !" : "Copier"}
          </button>
        </div>

        {/* Rewards */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-white font-black text-[13px] uppercase tracking-wider">Récompenses</p>
          {[
            { icon: Gift, text: "Votre ami reçoit 200 FC de bonus à l'inscription", color: "#22c55e" },
            { icon: Trophy, text: "Vous recevez 1 ticket gratuit à gratter par ami inscrit", color: "#F5C518" },
            { icon: Star, text: "Gagnez des niveaux : Bronze, Argent, Or, Platine", color: "#8DC63F" },
          ].map(({ icon: Icon, text, color }) => (
            <div key={text} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${color}20` }}>
                <Icon style={{ width: 15, height: 15, color }} />
              </div>
              <p className="text-[12px] leading-snug" style={{ color: "rgba(255,255,255,0.7)" }}>{text}</p>
            </div>
          ))}
        </div>

        {/* Levels */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-white font-black text-[13px] uppercase tracking-wider mb-3">Niveaux de parrainage</p>
          <div className="space-y-2">
            {LEVELS.map(l => (
              <div key={l.name} className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${referralCount >= l.min ? "opacity-100" : "opacity-40"}`}
                style={{ background: l.bg, border: `1px solid ${l.color}30` }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                  <p className="font-black text-[12px]" style={{ color: l.color }}>{l.name}</p>
                </div>
                <p className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {l.min === 0 ? "0 filleul" : l.max === Infinity ? `${l.min}+ filleuls` : `${l.min}–${l.max} filleuls`}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
