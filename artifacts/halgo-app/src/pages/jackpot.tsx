import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Trophy, Clock, Ticket, Wallet, Users, CheckCircle, Star, Zap, Gift } from "lucide-react";

function useCountdownToSaturday() {
  const getNext = () => {
    const now = new Date();
    const day = now.getDay();
    const daysUntil = day === 6 ? 7 : (6 - day + 7) % 7 || 7;
    const next = new Date(now);
    next.setDate(now.getDate() + daysUntil);
    next.setHours(23, 59, 59, 0);
    return next;
  };
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.floor((getNext().getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, Math.floor((getNext().getTime() - Date.now()) / 1000))), 1000);
    return () => clearInterval(id);
  }, []);
  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return { d, h, m, s, total: remaining };
}

const TIERS = [
  { rank: "1er", label: "Grand Gagnant", amount: "5 000 000 FC", color: "#F5C518", bg: "rgba(245,197,24,0.12)", border: "rgba(245,197,24,0.4)", icon: "🥇" },
  { rank: "2ème", label: "2ème Prix", amount: "500 000 FC", color: "#e2e8f0", bg: "rgba(226,232,240,0.08)", border: "rgba(226,232,240,0.2)", icon: "🥈" },
  { rank: "3ème", label: "3ème Prix", amount: "100 000 FC", color: "#cd7f32", bg: "rgba(205,127,50,0.10)", border: "rgba(205,127,50,0.3)", icon: "🥉" },
  { rank: "4–10", label: "Lots de consolation", amount: "10 000 FC", color: "#8DC63F", bg: "rgba(141,198,63,0.08)", border: "rgba(141,198,63,0.25)", icon: "🎁" },
];

const PAST_WINNERS = [
  { name: "Jean M.", city: "Kinshasa", amount: "5 000 000 FC", date: "7 juin 2026" },
  { name: "Marie K.", city: "Lubumbashi", amount: "5 000 000 FC", date: "31 mai 2026" },
  { name: "Pierre L.", city: "Goma", amount: "5 000 000 FC", date: "24 mai 2026" },
];

const CSS = `
@keyframes jkGlow{0%,100%{box-shadow:0 0 32px rgba(245,197,24,0.2),0 0 0 0 rgba(245,197,24,0.0)}50%{box-shadow:0 0 48px rgba(245,197,24,0.4),0 0 0 6px rgba(245,197,24,0.08)}}
@keyframes jkFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes jkShimmer{0%{background-position:-200% center}100%{background-position:200% center}}
@keyframes jkCount{0%{transform:scale(1)}50%{transform:scale(1.04)}100%{transform:scale(1)}}
`;

export default function JackpotPage() {
  const [, navigate] = useLocation();
  const cd = useCountdownToSaturday();

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "linear-gradient(180deg,#060f08 0%,#0a1a0d 100%)" }}>
      <style>{CSS}</style>

      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button
          onClick={() => navigate("/app")}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: "rgba(255,255,255,0.07)" }}
        >
          <ChevronLeft style={{ width: 20, height: 20, color: "#fff" }} />
        </button>
        <span className="font-black text-white text-[16px] uppercase tracking-wider">Jackpot du Samedi</span>
        <span className="ml-auto px-2 py-0.5 rounded-full text-[9px] font-black uppercase" style={{ background: "#F5C518", color: "#3a1f00" }}>LIVE</span>
      </header>

      <div className="flex-1 px-4 pb-28 space-y-5 overflow-y-auto">

        {/* ── Main prize card ── */}
        <div
          className="rounded-3xl p-6 flex flex-col items-center gap-3 relative overflow-hidden"
          style={{
            background: "linear-gradient(160deg,#1a1000 0%,#2c1c00 50%,#130d00 100%)",
            border: "1.5px solid rgba(245,197,24,0.45)",
            animation: "jkGlow 3s ease-in-out infinite",
          }}
        >
          {/* Shimmer bar */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.3) 50%,transparent 100%)",
              backgroundSize: "200% 100%",
              animation: "jkShimmer 3.5s linear infinite",
            }}
          />

          {/* Trophy icon */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center relative z-10"
            style={{
              background: "radial-gradient(circle at 38% 32%,#f5d060,#c8960a 55%,#7a5800)",
              boxShadow: "0 0 24px rgba(245,197,24,0.6),0 0 48px rgba(245,197,24,0.2)",
              animation: "jkFloat 3s ease-in-out infinite",
            }}
          >
            <Trophy style={{ width: 38, height: 38, color: "#3a1f00", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.4))" }} strokeWidth={2} />
          </div>

          {/* Prize label */}
          <p className="text-[11px] font-black uppercase tracking-[0.2em] relative z-10" style={{ color: "rgba(245,197,24,0.7)" }}>
            CAGNOTTE PRINCIPALE
          </p>

          {/* Prize amount */}
          <div className="flex items-baseline gap-2 relative z-10" style={{ animation: "jkCount 4s ease-in-out infinite" }}>
            <span
              className="font-black leading-none"
              style={{
                fontSize: "2.8rem",
                color: "#F5C518",
                textShadow: "0 0 24px rgba(245,197,24,0.5)",
                fontFamily: "'Plus Jakarta Sans','Montserrat',sans-serif",
              }}
            >
              5 000 000
            </span>
            <span className="font-black text-xl" style={{ color: "rgba(245,197,24,0.6)" }}>FC</span>
          </div>

          {/* Subtitle */}
          <p className="text-[11px] font-semibold relative z-10" style={{ color: "rgba(255,255,255,0.45)" }}>
            Tirage chaque <strong className="text-white">samedi à minuit</strong>
          </p>
        </div>

        {/* ── Countdown ── */}
        <div
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock style={{ width: 14, height: 14, color: "#F5C518" }} />
            <span className="text-[11px] font-black uppercase tracking-wider text-white">Prochain tirage dans</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { val: cd.d, label: "JOURS" },
              { val: cd.h, label: "HEURES" },
              { val: cd.m, label: "MIN" },
              { val: cd.s, label: "SEC" },
            ].map(({ val, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 py-2 rounded-xl"
                style={{ background: "rgba(245,197,24,0.08)", border: "1px solid rgba(245,197,24,0.2)" }}
              >
                <span
                  className="font-black leading-none"
                  style={{ fontSize: "1.5rem", color: "#F5C518", fontFamily: "'Courier New',monospace" }}
                >
                  {String(val).padStart(2, "0")}
                </span>
                <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── How to participate ── */}
        <div className="space-y-2.5">
          <p className="text-[12px] font-black uppercase tracking-wider text-white">Comment participer</p>

          <div
            className="flex items-start gap-3 p-4 rounded-2xl"
            style={{ background: "rgba(141,198,63,0.07)", border: "1px solid rgba(141,198,63,0.2)" }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(141,198,63,0.15)" }}>
              <Ticket style={{ width: 18, height: 18, color: "#8DC63F" }} />
            </div>
            <div>
              <p className="font-black text-[12px] text-white">Gratter un ticket</p>
              <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                Activez un ticket Halgo Cash officiel. Chaque code valide = 1 participation au tirage du samedi.
              </p>
            </div>
          </div>

          <div
            className="flex items-start gap-3 p-4 rounded-2xl"
            style={{ background: "rgba(245,197,24,0.07)", border: "1px solid rgba(245,197,24,0.2)" }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,197,24,0.15)" }}>
              <Wallet style={{ width: 18, height: 18, color: "#F5C518" }} />
            </div>
            <div>
              <p className="font-black text-[12px] text-white">Miser depuis mon solde</p>
              <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                Misez minimum <strong className="text-white">500 FC</strong> depuis votre solde. Chaque tranche de 500 FC = 1 participation supplémentaire.
              </p>
            </div>
          </div>
        </div>

        {/* ── Prize tiers ── */}
        <div className="space-y-2.5">
          <p className="text-[12px] font-black uppercase tracking-wider text-white">Palmarès des prix</p>
          <div className="space-y-2">
            {TIERS.map((t) => (
              <div
                key={t.rank}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: t.bg, border: `1px solid ${t.border}` }}
              >
                <span className="text-[22px]">{t.icon}</span>
                <div className="flex-1">
                  <p className="font-black text-white text-[12px]">{t.rank} — {t.label}</p>
                </div>
                <span className="font-black text-[13px]" style={{ color: t.color }}>{t.amount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Rules ── */}
        <div
          className="rounded-2xl p-4 space-y-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-[12px] font-black uppercase tracking-wider text-white mb-3">Règlement</p>
          {[
            "Le tirage a lieu chaque samedi à 00:00 (heure de Kinshasa)",
            "Chaque ticket activé ou tranche de 500 FC misée = 1 participation",
            "Le gagnant est sélectionné aléatoirement parmi tous les participants",
            "Les gains sont crédités automatiquement sur le solde du gagnant",
            "Un même participant peut gagner plusieurs semaines",
            "Participation réservée aux utilisateurs vérifiés (+18 ans)",
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle style={{ width: 12, height: 12, color: "#8DC63F", marginTop: 2, flexShrink: 0 }} />
              <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{rule}</p>
            </div>
          ))}
        </div>

        {/* ── Past winners ── */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Star style={{ width: 14, height: 14, color: "#F5C518" }} />
            <p className="text-[12px] font-black uppercase tracking-wider text-white">Derniers gagnants</p>
          </div>
          <div className="space-y-2">
            {PAST_WINNERS.map((w, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-black text-[13px] text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#1a6b2f,#22a84a)" }}
                >
                  {w.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-[12px]">{w.name} · {w.city}</p>
                  <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{w.date}</p>
                </div>
                <span className="font-black text-[12px]" style={{ color: "#F5C518" }}>+{w.amount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <button
          onClick={() => navigate("/app")}
          className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[14px] transition-all active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#c8960a,#F5C518)", color: "#3a1f00", boxShadow: "0 4px 20px rgba(200,150,10,0.5)" }}
        >
          <span className="flex items-center justify-center gap-2">
            <Zap style={{ width: 16, height: 16 }} />
            PARTICIPER AU JACKPOT
          </span>
        </button>

      </div>
    </div>
  );
}
