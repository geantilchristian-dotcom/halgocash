import { motion, AnimatePresence } from "framer-motion";
import {
  useGetLatestDraw,
  useListWinners,
  getGetLatestDrawQueryKey,
  getListWinnersQueryKey,
} from "@workspace/api-client-react";
import { useEffect, useRef, useState, useCallback } from "react";

const FC = (n: number) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FC";

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-xl text-white/60 tabular-nums">
      {time.toLocaleTimeString("fr-FR")}
    </span>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
type GameMode = "malette" | "sport" | "loterie";

interface MaletteState {
  status: "betting" | "closed" | "idle";
  roundId?: number;
  closesAt?: string;
  timeLeft?: number;
  betsPerCase?: number[];
  totalBets?: number;
  multipliers?: number[] | null;
  totalCollected?: number;
  closedAt?: string;
}

interface SportMatch {
  id: number;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  oddsHome: string;
  oddsDraw: string;
  oddsAway: string;
  status: string;
}

// ── Game Selector ──────────────────────────────────────────────────────────────
function GameSelector({ onSelect }: { onSelect: (g: GameMode) => void }) {
  const { data: draw } = useGetLatestDraw({
    query: { refetchInterval: 15000, queryKey: getGetLatestDrawQueryKey() },
  });
  const [malette, setMalette] = useState<MaletteState | null>(null);
  const [matchCount, setMatchCount] = useState(0);

  useEffect(() => {
    fetch("/api/display/malette")
      .then(r => r.json())
      .then((d: MaletteState) => setMalette(d))
      .catch(() => {});
    fetch("/api/sport/matches")
      .then(r => r.json())
      .then((d: { matches: SportMatch[] }) => setMatchCount(d.matches?.length ?? 0))
      .catch(() => {});
  }, []);

  const jackpot = Number(draw?.jackpotAmount ?? 0);

  const cards: { game: GameMode; icon: string; label: string; sub: string; color: string; glow: string }[] = [
    {
      game: "malette",
      icon: "🧳",
      label: "MALETTE",
      sub: malette?.status === "betting"
        ? `Round #${malette.roundId} en cours`
        : malette?.status === "closed"
        ? `Round #${malette.roundId} terminé`
        : "En attente…",
      color: "#F5C518",
      glow: "rgba(245,197,24,0.4)",
    },
    {
      game: "sport",
      icon: "⚽",
      label: "SPORT",
      sub: matchCount > 0 ? `${matchCount} match${matchCount > 1 ? "s" : ""} disponible${matchCount > 1 ? "s" : ""}` : "Aucun match",
      color: "#22c55e",
      glow: "rgba(34,197,94,0.4)",
    },
    {
      game: "loterie",
      icon: "🎟️",
      label: "LOTERIE",
      sub: jackpot > 0 ? FC(jackpot) : "Jackpot en cours",
      color: "#818cf8",
      glow: "rgba(129,140,248,0.4)",
    },
  ];

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(160deg, #050d05 0%, #0a180a 60%, #060a1a 100%)" }}
    >
      <div className="absolute top-5 left-6 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-black text-lg" style={{ background: "#f5c518" }}>HC</div>
        <div>
          <p className="text-white font-black text-base uppercase tracking-wide">Halgo Cash</p>
          <p className="text-[#f5c518] text-[10px] font-bold tracking-[0.3em] uppercase">Sélection du jeu</p>
        </div>
      </div>
      <div className="absolute top-5 right-6"><Clock /></div>

      <p className="text-white/40 text-sm font-bold uppercase tracking-[0.4em] mb-8">Choisissez le jeu à afficher</p>

      <div className="flex gap-8 px-8">
        {cards.map((c) => (
          <motion.button
            key={c.game}
            onClick={() => onSelect(c.game)}
            whileHover={{ scale: 1.04, y: -6 }}
            whileTap={{ scale: 0.97 }}
            className="flex flex-col items-center justify-center rounded-3xl cursor-pointer"
            style={{
              width: "clamp(200px, 26vw, 320px)",
              height: "clamp(200px, 28vw, 340px)",
              background: `radial-gradient(ellipse at top, ${c.glow.replace("0.4", "0.12")} 0%, rgba(255,255,255,0.03) 100%)`,
              border: `2px solid ${c.color}44`,
              boxShadow: `0 0 40px ${c.glow.replace("0.4", "0.15")}`,
            }}
          >
            <span style={{ fontSize: "clamp(3rem, 6vw, 5rem)" }}>{c.icon}</span>
            <p className="font-black text-2xl mt-4 tracking-[0.15em]" style={{ color: c.color }}>{c.label}</p>
            <p className="text-white/50 text-sm mt-2 font-medium">{c.sub}</p>
            <div
              className="mt-6 px-5 py-2 rounded-xl text-sm font-black uppercase tracking-widest"
              style={{ background: `${c.color}22`, color: c.color, border: `1px solid ${c.color}55` }}
            >
              Afficher
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ── Malette View ──────────────────────────────────────────────────────────────
const CASE_COLORS = ["#F5C518", "#FF8C42", "#60C0FF", "#CC88FF"];
const CASE_NAMES  = ["Malette 1", "Malette 2", "Malette 3", "Malette 4"];

function MaletteCountdown({ ms }: { ms: number }) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  const urgent = s < 10;
  return (
    <motion.div
      animate={urgent ? { scale: [1, 1.04, 1] } : {}}
      transition={{ duration: 0.5, repeat: Infinity }}
      className="font-mono font-black tabular-nums"
      style={{
        fontSize: "clamp(4rem, 12vw, 10rem)",
        color: urgent ? "#ef4444" : "#f5c518",
        textShadow: urgent
          ? "0 0 80px rgba(239,68,68,0.6)"
          : "0 0 80px rgba(245,197,24,0.5)",
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}
    >
      {String(m).padStart(2, "0")}:{String(ss).padStart(2, "0")}
    </motion.div>
  );
}

function MaletteView({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<MaletteState | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const closesAtRef = useRef<number | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch("/api/display/malette");
      const d: MaletteState = await r.json();
      setState(d);
      if (d.status === "betting" && d.closesAt) {
        closesAtRef.current = new Date(d.closesAt).getTime();
        setTimeLeft(Math.max(0, closesAtRef.current - Date.now()));
      } else {
        closesAtRef.current = null;
      }
    } catch {}
  }, []);

  useEffect(() => {
    void fetch_();
    const poll = setInterval(() => void fetch_(), 2500);
    return () => clearInterval(poll);
  }, [fetch_]);

  useEffect(() => {
    const t = setInterval(() => {
      if (closesAtRef.current !== null) {
        setTimeLeft(Math.max(0, closesAtRef.current - Date.now()));
      }
    }, 200);
    return () => clearInterval(t);
  }, []);

  const maxBet = state?.betsPerCase ? Math.max(...state.betsPerCase, 1) : 1;

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0a0500 0%, #150d00 60%, #0a0a1a 100%)" }}
    >
      {/* Header */}
      <header className="flex-none flex items-center justify-between px-8 pt-5 pb-3"
        style={{ borderBottom: "1px solid rgba(245,197,24,0.2)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-black text-base" style={{ background: "#f5c518" }}>HC</div>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-wide">Halgo Cash</p>
            <p className="text-[#f5c518] text-[10px] font-bold tracking-[0.3em] uppercase">🧳 Malette en direct</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {state?.roundId && (
            <span className="text-[#f5c518]/60 font-mono font-bold text-sm">Round #{state.roundId}</span>
          )}
          <Clock />
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
          >
            Changer
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
        {/* Status */}
        <AnimatePresence mode="wait">
          {state?.status === "betting" && (
            <motion.div key="betting" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-center text-white/40 text-sm font-bold uppercase tracking-[0.4em] mb-2">Paris en cours — fermeture dans</p>
              <div className="flex justify-center">
                <MaletteCountdown ms={timeLeft} />
              </div>
            </motion.div>
          )}
          {state?.status === "closed" && (
            <motion.div key="closed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-center">
              <p className="text-white/40 text-sm font-bold uppercase tracking-[0.4em] mb-2">Résultat du Round #{state.roundId}</p>
              <motion.p
                className="font-black text-5xl"
                style={{ color: "#22c55e", textShadow: "0 0 40px rgba(34,197,94,0.5)" }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                🏆 RÉSULTATS
              </motion.p>
            </motion.div>
          )}
          {state?.status === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <p className="text-white/40 text-sm font-bold uppercase tracking-[0.4em]">En attente du prochain round…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cases */}
        <div className="grid grid-cols-4 gap-5 w-full max-w-5xl">
          {CASE_COLORS.map((color, i) => {
            const betAmt = state?.betsPerCase?.[i] ?? 0;
            const mult = state?.multipliers?.[i];
            const isWinner = state?.status === "closed" && mult != null && mult > 0;
            const barPct = state?.betsPerCase ? (betAmt / maxBet) * 100 : 0;

            return (
              <motion.div
                key={i}
                animate={isWinner ? { scale: [1, 1.06, 1] } : {}}
                transition={{ duration: 0.8, repeat: isWinner ? Infinity : 0 }}
                className="flex flex-col items-center rounded-2xl overflow-hidden"
                style={{
                  background: isWinner
                    ? `linear-gradient(135deg, ${color}33, ${color}18)`
                    : "rgba(255,255,255,0.04)",
                  border: isWinner
                    ? `2px solid ${color}cc`
                    : `2px solid ${color}33`,
                  boxShadow: isWinner ? `0 0 40px ${color}55` : "none",
                  minHeight: 180,
                  padding: "1.5rem 1rem",
                }}
              >
                <div className="font-black text-6xl mb-2" style={{ filter: `drop-shadow(0 0 16px ${color}88)` }}>
                  🧳
                </div>
                <p className="font-black text-sm uppercase tracking-widest" style={{ color }}>{CASE_NAMES[i]}</p>

                {/* Bar */}
                <div className="w-full h-1.5 rounded-full mt-3 mb-2" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    animate={{ width: `${barPct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                <p className="font-black text-sm tabular-nums" style={{ color: isWinner ? color : "rgba(255,255,255,0.7)" }}>
                  {betAmt > 0 ? FC(betAmt) : "—"}
                </p>

                {isWinner && mult != null && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 px-3 py-1 rounded-lg font-black text-sm"
                    style={{ background: `${color}33`, color, border: `1px solid ${color}66` }}
                  >
                    ×{mult.toFixed(1)} GAGNÉ
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Total */}
        {state?.status === "betting" && (state.totalBets ?? 0) > 0 && (
          <p className="text-white/30 text-sm font-bold">
            Total des mises : <span className="text-[#f5c518]/70">{FC(state.totalBets!)}</span>
          </p>
        )}
      </div>

      {/* Footer */}
      <footer className="flex-none py-3 text-center" style={{ borderTop: "1px solid rgba(245,197,24,0.12)" }}>
        <motion.p
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="text-[#f5c518]/60 text-xs font-black uppercase tracking-[0.4em]"
        >
          ✦ Misez via l'application Halgo Cash ✦
        </motion.p>
      </footer>
    </div>
  );
}

// ── Sport View ─────────────────────────────────────────────────────────────────
function SportView({ onBack }: { onBack: () => void }) {
  const [matches, setMatches] = useState<SportMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      setLoading(true);
      fetch("/api/sport/matches")
        .then(r => r.json())
        .then((d: { matches: SportMatch[] }) => setMatches(d.matches ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const fmtDate = (s: string) =>
    new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(160deg, #00050a 0%, #001530 60%, #000a05 100%)" }}
    >
      {/* Header */}
      <header className="flex-none flex items-center justify-between px-8 pt-5 pb-4"
        style={{ borderBottom: "2px solid rgba(34,197,94,0.25)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-black text-base" style={{ background: "#22c55e" }}>HC</div>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-wide">Halgo Cash</p>
            <p className="text-[#22c55e] text-[10px] font-bold tracking-[0.3em] uppercase">⚽ Paris Sportifs en direct</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Clock />
          <button onClick={onBack}
            className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white border border-white/10 hover:border-white/30 transition-colors">
            Changer
          </button>
        </div>
      </header>

      {/* Column headers */}
      <div className="flex-none grid items-center mx-6 mt-4 mb-2 rounded-xl px-5 py-3"
        style={{
          gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1.2fr",
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.3)",
        }}>
        <span className="text-[#22c55e] font-black text-xs uppercase tracking-widest">Match</span>
        <span className="text-[#22c55e] font-black text-xs uppercase tracking-widest text-center">1</span>
        <span className="text-[#22c55e] font-black text-xs uppercase tracking-widest text-center">X</span>
        <span className="text-[#22c55e] font-black text-xs uppercase tracking-widest text-center">2</span>
        <span className="text-[#22c55e] font-black text-xs uppercase tracking-widest text-right">Date</span>
      </div>

      {/* Matches */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#00050a] to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#000a05] to-transparent z-10 pointer-events-none" />
        <div className="h-full overflow-y-auto px-6" style={{ scrollbarWidth: "none" }}>
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-white/30 text-sm">Chargement des matchs…</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
              <div className="text-7xl">⚽</div>
              <p className="text-white text-xl font-bold uppercase tracking-widest">Aucun match disponible</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 py-2">
              {matches.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="grid items-center px-5 py-4 rounded-xl"
                  style={{
                    gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1.2fr",
                    background: i % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div className="flex flex-col gap-0.5">
                    <p className="text-white font-black text-sm">{m.homeTeam} <span className="text-white/40">vs</span> {m.awayTeam}</p>
                    <p className="text-[#22c55e]/60 text-xs font-bold uppercase tracking-wider">{m.competition}</p>
                  </div>
                  {[m.oddsHome, m.oddsDraw, m.oddsAway].map((odd, j) => (
                    <div key={j} className="flex justify-center">
                      <span
                        className="font-black text-base tabular-nums px-3 py-1 rounded-lg"
                        style={{
                          background: "rgba(34,197,94,0.1)",
                          color: "#22c55e",
                          border: "1px solid rgba(34,197,94,0.25)",
                        }}
                      >{parseFloat(odd).toFixed(2)}</span>
                    </div>
                  ))}
                  <p className="text-white/40 text-xs font-mono text-right">{fmtDate(m.matchDate)}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="flex-none py-3 text-center" style={{ borderTop: "2px solid rgba(34,197,94,0.2)" }}>
        <motion.p
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="text-[#22c55e]/60 text-xs font-black uppercase tracking-[0.4em]"
        >
          ✦ Pariez sur vos équipes favorites via l'app Halgo Cash ✦
        </motion.p>
      </footer>
    </div>
  );
}

// ── Lotto View (existing) ─────────────────────────────────────────────────────
function PulseRing() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f5c518] opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#f5c518]" />
    </span>
  );
}

type Winner = { drawNumber: number; maskedCode: string; prizeAmount: string | number };

function LottoView({ onBack }: { onBack: () => void }) {
  const { data: draw } = useGetLatestDraw({
    query: { refetchInterval: 10000, queryKey: getGetLatestDrawQueryKey() },
  });
  const { data: winners } = useListWinners(
    { limit: 100 },
    { query: { refetchInterval: 5000, queryKey: getListWinnersQueryKey({ limit: 100 }) } }
  );

  const jackpot = Number(draw?.jackpotAmount ?? 0);
  const seenRef = useRef<Set<string>>(new Set());
  const [newCodes, setNewCodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!winners) return;
    const fresh: string[] = [];
    winners.forEach((w: Winner) => {
      const key = `${w.drawNumber}-${w.maskedCode}`;
      if (!seenRef.current.has(key)) { fresh.push(key); seenRef.current.add(key); }
    });
    if (fresh.length > 0 && seenRef.current.size > fresh.length) {
      setNewCodes(new Set(fresh));
      setTimeout(() => setNewCodes(new Set()), 4000);
    } else {
      fresh.forEach(k => seenRef.current.add(k));
    }
  }, [winners]);

  const rows: Winner[] = winners ?? [];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(160deg, #050d05 0%, #0a180a 60%, #060a1a 100%)", fontFamily: "'Inter', sans-serif" }}>
      <header className="flex-none flex flex-col items-center justify-center pt-6 pb-5 px-8 relative"
        style={{ background: "linear-gradient(180deg, rgba(245,197,24,0.12) 0%, transparent 100%)", borderBottom: "2px solid rgba(245,197,24,0.25)" }}>
        <div className="absolute top-4 left-6 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-black text-lg" style={{ background: "#f5c518", boxShadow: "0 0 20px rgba(245,197,24,0.5)" }}>HC</div>
          <div>
            <p className="text-white font-black text-base leading-none uppercase tracking-wide">Halgo Cash</p>
            <p className="text-[#f5c518] text-[10px] font-bold tracking-[0.3em] uppercase">Loterie en direct</p>
          </div>
        </div>
        <div className="absolute top-4 right-6 flex items-center gap-4">
          <Clock />
          <button onClick={onBack}
            className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white border border-white/10 hover:border-white/30 transition-colors">
            Changer
          </button>
        </div>

        <p className="text-xs font-black uppercase tracking-[0.45em] mb-1" style={{ color: "rgba(245,197,24,0.7)" }}>✦ Jackpot de la semaine ✦</p>
        <motion.p
          key={jackpot}
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 110, damping: 12 }}
          className="font-black leading-none text-center"
          style={{ fontSize: "clamp(2.8rem, 7vw, 5.5rem)", color: "#f5c518", textShadow: "0 0 60px rgba(245,197,24,0.55), 0 2px 0 rgba(0,0,0,0.6)", letterSpacing: "-0.02em" }}
        >
          {jackpot > 0 ? FC(jackpot) : "— FC"}
        </motion.p>
      </header>

      <div className="flex-1 flex flex-col min-h-0 px-6 pt-4 pb-2">
        <div className="flex-none grid items-center mb-2 rounded-xl px-5 py-3"
          style={{ gridTemplateColumns: "2fr 1fr 2fr 2fr", background: "rgba(245,197,24,0.15)", border: "1px solid rgba(245,197,24,0.35)" }}>
          <span className="text-[#f5c518] font-black text-sm uppercase tracking-widest">ID Billet</span>
          <span className="text-[#f5c518] font-black text-sm uppercase tracking-widest text-center">Statut</span>
          <span className="text-[#f5c518] font-black text-sm uppercase tracking-widest text-right">Montant gagné</span>
          <span className="text-[#f5c518] font-black text-sm uppercase tracking-widest text-right">Code billet</span>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#050d05] to-transparent z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#060a1a] to-transparent z-10 pointer-events-none" />
          <div className="h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {rows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
                <div className="text-7xl">🎟️</div>
                <p className="text-white text-xl font-bold uppercase tracking-widest">Aucun gagnant pour l'instant</p>
                <p className="text-white/60 text-sm">Les billets gagnants s'afficheront ici en temps réel</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pb-2">
                <AnimatePresence initial={false}>
                  {rows.map((w: Winner, i: number) => {
                    const key = `${w.drawNumber}-${w.maskedCode}`;
                    const isNew = newCodes.has(key);
                    const prize = Number(w.prizeAmount);
                    const isBig = prize >= 100000;
                    return (
                      <motion.div
                        key={key} layout
                        initial={{ opacity: 0, y: -30, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="grid items-center px-5 py-3 rounded-xl relative overflow-hidden"
                        style={{
                          gridTemplateColumns: "2fr 1fr 2fr 2fr",
                          background: isNew ? "linear-gradient(90deg, rgba(245,197,24,0.22), rgba(245,197,24,0.08))" : i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)",
                          border: isNew ? "1px solid rgba(245,197,24,0.6)" : isBig ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(255,255,255,0.07)",
                          boxShadow: isNew ? "0 0 30px rgba(245,197,24,0.2)" : isBig ? "0 0 20px rgba(34,197,94,0.1)" : "none",
                        }}
                      >
                        {isNew && (
                          <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
                            initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ duration: 0.8, ease: "easeOut" }} />
                        )}
                        <div className="flex items-center gap-3">
                          {isNew && <PulseRing />}
                          <span className="font-mono font-black text-lg tracking-widest" style={{ color: isNew ? "#f5c518" : "rgba(255,255,255,0.85)" }}>
                            {w.drawNumber.toString().padStart(2, "0")}<span className="text-white/30 mx-0.5">—</span>{w.maskedCode.slice(0, 4)}<span className="text-white/20">····</span>
                          </span>
                        </div>
                        <div className="flex justify-center">
                          <span className="font-black text-sm uppercase tracking-wider px-3 py-1 rounded-lg"
                            style={{ background: isNew ? "rgba(245,197,24,0.2)" : "rgba(34,197,94,0.15)", color: isNew ? "#f5c518" : "#22c55e", border: isNew ? "1px solid rgba(245,197,24,0.5)" : "1px solid rgba(34,197,94,0.4)" }}>
                            GAGNÉ
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-xl tabular-nums" style={{ color: isBig ? "#22c55e" : "rgba(255,255,255,0.9)", textShadow: isBig ? "0 0 20px rgba(34,197,94,0.4)" : "none" }}>
                            {FC(prize)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-sm text-white/35 tracking-widest">{w.maskedCode}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="flex-none py-4 text-center relative overflow-hidden"
        style={{ background: "linear-gradient(90deg, #0a1f0a, #0d260d, #0a1f0a)", borderTop: "2px solid rgba(34,197,94,0.3)" }}>
        <motion.p
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="font-black uppercase tracking-[0.3em] text-[#22c55e]"
          style={{ fontSize: "clamp(1rem, 2.5vw, 1.4rem)", textShadow: "0 0 30px rgba(34,197,94,0.4)" }}
        >
          ✦ Devenez le prochain sur la liste des gagnants ✦
        </motion.p>
      </footer>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [selectedGame, setSelectedGame] = useState<GameMode | null>(() => {
    try { return localStorage.getItem("halgo_display_game") as GameMode | null; } catch { return null; }
  });

  const handleSelect = (g: GameMode) => {
    setSelectedGame(g);
    try { localStorage.setItem("halgo_display_game", g); } catch {}
  };

  const handleBack = () => {
    setSelectedGame(null);
    try { localStorage.removeItem("halgo_display_game"); } catch {}
  };

  // Keyboard shortcut: Escape → back to selector
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {!selectedGame && (
        <motion.div key="selector" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <GameSelector onSelect={handleSelect} />
        </motion.div>
      )}
      {selectedGame === "malette" && (
        <motion.div key="malette" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <MaletteView onBack={handleBack} />
        </motion.div>
      )}
      {selectedGame === "sport" && (
        <motion.div key="sport" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <SportView onBack={handleBack} />
        </motion.div>
      )}
      {selectedGame === "loterie" && (
        <motion.div key="loterie" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <LottoView onBack={handleBack} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
