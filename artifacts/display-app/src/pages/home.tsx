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
type GameMode = "halgo-cash" | "roulette" | "malette";

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

interface SpinResult {
  id: number;
  segmentIdx: number;
  label: string;
  multiplier: number;
  color: string;
  betAmount: number;
  wonAmount: number;
  netChange: number;
  spinAt: string;
}

interface RouletteState {
  lastSpin: SpinResult | null;
  recentSpins: SpinResult[];
  segments: Array<{ label: string; multiplier: number; color: string }>;
}

// ── Wheel constants ────────────────────────────────────────────────────────────
const SEG_WEIGHTS = [0.5, 1.5, 3, 5, 10, 15, 20, 45];
const TOTAL_WEIGHT = SEG_WEIGHTS.reduce((a, b) => a + b, 0);
const SEG_COLORS = [
  "#FFD700", "#9B59B6", "#3498DB", "#1ABC9C",
  "#27AE60", "#F1C40F", "#E67E22", "#555555",
];
const SEG_LABELS = ["JACKPOT", "MÉGA", "GRAND", "MAJEUR", "MINEUR", "PETIT", "TRÈS PETIT", "PERDU"];

// Cumulative start angles (degrees) for each segment
const SEG_START: number[] = [];
const SEG_CENTER: number[] = [];
let cumDeg = 0;
for (let i = 0; i < SEG_WEIGHTS.length; i++) {
  const deg = (SEG_WEIGHTS[i]! / TOTAL_WEIGHT) * 360;
  SEG_START.push(cumDeg);
  SEG_CENTER.push(cumDeg + deg / 2);
  cumDeg += deg;
}

// conic-gradient string
const WHEEL_GRADIENT = (() => {
  const parts: string[] = [];
  let acc = 0;
  for (let i = 0; i < SEG_WEIGHTS.length; i++) {
    const pct = (SEG_WEIGHTS[i]! / TOTAL_WEIGHT) * 100;
    parts.push(`${SEG_COLORS[i]} ${acc.toFixed(2)}% ${(acc + pct).toFixed(2)}%`);
    acc += pct;
  }
  return `conic-gradient(from -90deg, ${parts.join(", ")})`;
})();

// ── Game Selector ──────────────────────────────────────────────────────────────
function GameSelector({ onSelect }: { onSelect: (g: GameMode) => void }) {
  const { data: draw } = useGetLatestDraw({
    query: { refetchInterval: 15000, queryKey: getGetLatestDrawQueryKey() },
  });
  const [malette, setMalette] = useState<MaletteState | null>(null);
  const [roulette, setRoulette] = useState<RouletteState | null>(null);

  useEffect(() => {
    fetch("/api/display/malette").then(r => r.json()).then((d: MaletteState) => setMalette(d)).catch(() => {});
    fetch("/api/display/roulette").then(r => r.json()).then((d: RouletteState) => setRoulette(d)).catch(() => {});
  }, []);

  const jackpot = Number(draw?.jackpotAmount ?? 0);
  const recentSpinCount = roulette?.recentSpins?.length ?? 0;

  const cards: { game: GameMode; icon: string; label: string; sub: string; color: string; glow: string }[] = [
    {
      game: "halgo-cash",
      icon: "🎟️",
      label: "HALGO CASH",
      sub: jackpot > 0 ? `Jackpot : ${FC(jackpot)}` : "Tirage en cours",
      color: "#f5c518",
      glow: "rgba(245,197,24,0.4)",
    },
    {
      game: "roulette",
      icon: "🎡",
      label: "ROULETTE HALGO",
      sub: recentSpinCount > 0
        ? `${recentSpinCount} spin${recentSpinCount > 1 ? "s" : ""} récent${recentSpinCount > 1 ? "s" : ""}`
        : roulette?.lastSpin ? `Dernier : ${roulette.lastSpin.label}` : "En attente…",
      color: "#e74c3c",
      glow: "rgba(231,76,60,0.4)",
    },
    {
      game: "malette",
      icon: "🧳",
      label: "MALETTE SECRÈTE",
      sub: malette?.status === "betting"
        ? `Round #${malette.roundId} en cours`
        : malette?.status === "closed"
        ? `Round #${malette.roundId} terminé`
        : "En attente du prochain round",
      color: "#3498db",
      glow: "rgba(52,152,219,0.4)",
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

      <p className="text-white/40 text-sm font-bold uppercase tracking-[0.4em] mb-10">Choisissez le jeu à afficher</p>

      <div className="flex gap-8 px-8">
        {cards.map((c) => (
          <motion.button
            key={c.game}
            onClick={() => onSelect(c.game)}
            whileHover={{ scale: 1.04, y: -6 }}
            whileTap={{ scale: 0.97 }}
            className="flex flex-col items-center justify-center rounded-3xl cursor-pointer"
            style={{
              width: "clamp(200px, 26vw, 310px)",
              height: "clamp(200px, 28vw, 330px)",
              background: `radial-gradient(ellipse at top, ${c.glow.replace("0.4", "0.12")} 0%, rgba(255,255,255,0.03) 100%)`,
              border: `2px solid ${c.color}44`,
              boxShadow: `0 0 40px ${c.glow.replace("0.4", "0.15")}`,
            }}
          >
            <span style={{ fontSize: "clamp(3rem, 5.5vw, 4.5rem)" }}>{c.icon}</span>
            <p className="font-black text-lg mt-4 tracking-[0.12em] text-center px-3" style={{ color: c.color }}>{c.label}</p>
            <p className="text-white/50 text-sm mt-2 font-medium text-center px-4">{c.sub}</p>
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

// ── Halgo Cash View ────────────────────────────────────────────────────────────
function PulseRing() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f5c518] opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#f5c518]" />
    </span>
  );
}

type Winner = { drawNumber: number; maskedCode: string; prizeAmount: string | number };

function HalgoCashView({ onBack }: { onBack: () => void }) {
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
    }
  }, [winners]);

  const rows: Winner[] = winners ?? [];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(160deg, #050d05 0%, #0a180a 60%, #060a1a 100%)" }}>
      <header className="flex-none flex flex-col items-center justify-center pt-6 pb-5 px-8 relative"
        style={{ background: "linear-gradient(180deg, rgba(245,197,24,0.12) 0%, transparent 100%)", borderBottom: "2px solid rgba(245,197,24,0.25)" }}>
        <div className="absolute top-4 left-6 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-black text-lg" style={{ background: "#f5c518", boxShadow: "0 0 20px rgba(245,197,24,0.5)" }}>HC</div>
          <div>
            <p className="text-white font-black text-base leading-none uppercase tracking-wide">Halgo Cash</p>
            <p className="text-[#f5c518] text-[10px] font-bold tracking-[0.3em] uppercase">🎟️ Loterie en direct</p>
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
        <motion.p key={jackpot} initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 110, damping: 12 }}
          className="font-black leading-none text-center"
          style={{ fontSize: "clamp(2.8rem, 7vw, 5.5rem)", color: "#f5c518", textShadow: "0 0 60px rgba(245,197,24,0.55), 0 2px 0 rgba(0,0,0,0.6)", letterSpacing: "-0.02em" }}>
          {jackpot > 0 ? FC(jackpot) : "— FC"}
        </motion.p>
      </header>

      <div className="flex-1 flex flex-col min-h-0 px-6 pt-4 pb-2">
        <div className="flex-none grid items-center mb-2 rounded-xl px-5 py-3"
          style={{ gridTemplateColumns: "2fr 1fr 2fr 2fr", background: "rgba(245,197,24,0.15)", border: "1px solid rgba(245,197,24,0.35)" }}>
          <span className="text-[#f5c518] font-black text-sm uppercase tracking-widest">ID Billet</span>
          <span className="text-[#f5c518] font-black text-sm uppercase tracking-widest text-center">Statut</span>
          <span className="text-[#f5c518] font-black text-sm uppercase tracking-widest text-right">Montant</span>
          <span className="text-[#f5c518] font-black text-sm uppercase tracking-widest text-right">Code</span>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#050d05] to-transparent z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#060a1a] to-transparent z-10 pointer-events-none" />
          <div className="h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {rows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
                <div className="text-7xl">🎟️</div>
                <p className="text-white text-xl font-bold uppercase tracking-widest">Aucun gagnant pour l'instant</p>
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
                      <motion.div key={key} layout
                        initial={{ opacity: 0, y: -30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4 }}
                        className="grid items-center px-5 py-3 rounded-xl relative overflow-hidden"
                        style={{
                          gridTemplateColumns: "2fr 1fr 2fr 2fr",
                          background: isNew ? "linear-gradient(90deg, rgba(245,197,24,0.22), rgba(245,197,24,0.08))" : i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)",
                          border: isNew ? "1px solid rgba(245,197,24,0.6)" : isBig ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(255,255,255,0.07)",
                          boxShadow: isNew ? "0 0 30px rgba(245,197,24,0.2)" : "none",
                        }}>
                        {isNew && (
                          <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
                            initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ duration: 0.8 }} />
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
                          <span className="font-black text-xl tabular-nums" style={{ color: isBig ? "#22c55e" : "rgba(255,255,255,0.9)" }}>
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

      <footer className="flex-none py-4 text-center" style={{ borderTop: "2px solid rgba(34,197,94,0.3)" }}>
        <motion.p animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2.5, repeat: Infinity }}
          className="font-black uppercase tracking-[0.3em] text-[#22c55e]"
          style={{ fontSize: "clamp(1rem, 2.5vw, 1.4rem)", textShadow: "0 0 30px rgba(34,197,94,0.4)" }}>
          ✦ Devenez le prochain sur la liste des gagnants ✦
        </motion.p>
      </footer>
    </div>
  );
}

// ── Roulette View ──────────────────────────────────────────────────────────────
function RouletteWheel({ spinToIdx, spinning }: { spinToIdx: number | null; spinning: boolean }) {
  const [rotation, setRotation] = useState(0);
  const baseRef = useRef(0);

  useEffect(() => {
    if (!spinning || spinToIdx === null) return;
    const center = SEG_CENTER[spinToIdx] ?? 0;
    // Pointer is at top (0°). To land at center of segment, we rotate so that segment center is at top.
    // The wheel starts with segment 0 at -90° (from conic-gradient `from -90deg`).
    // To point at segment i center: rotation = -(center) + 360*5 (5 full spins for drama)
    const target = baseRef.current + 5 * 360 + (360 - center);
    setRotation(target);
    baseRef.current = target % 360;
  }, [spinToIdx, spinning]);

  return (
    <div className="relative" style={{ width: "clamp(180px, 22vw, 280px)", height: "clamp(180px, 22vw, 280px)" }}>
      {/* Wheel */}
      <motion.div
        className="w-full h-full rounded-full"
        style={{
          background: WHEEL_GRADIENT,
          boxShadow: "0 0 60px rgba(231,76,60,0.4), inset 0 0 30px rgba(0,0,0,0.4)",
        }}
        animate={{ rotate: rotation }}
        transition={{ duration: spinning ? 3.5 : 0, ease: [0.15, 0.85, 0.35, 1.0] }}
      />
      {/* Center hub */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-8 h-8 rounded-full bg-white/90 shadow-xl border-2 border-white/50" />
      </div>
      {/* Pointer (top) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 pointer-events-none">
        <div style={{
          width: 0,
          height: 0,
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
          borderTop: "22px solid white",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
        }} />
      </div>
    </div>
  );
}

function RouletteView({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<RouletteState | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [displaySpin, setDisplaySpin] = useState<SpinResult | null>(null);
  const lastIdRef = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch("/api/display/roulette");
      const d: RouletteState = await r.json();
      setData(d);
      const ls = d.lastSpin;
      if (ls && ls.id !== lastIdRef.current) {
        lastIdRef.current = ls.id;
        setSpinning(true);
        setDisplaySpin(ls);
        setTimeout(() => setSpinning(false), 3800);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void fetchData();
    const t = setInterval(() => void fetchData(), 3000);
    return () => clearInterval(t);
  }, [fetchData]);

  const seg = displaySpin ? {
    color: SEG_COLORS[displaySpin.segmentIdx] ?? "#555",
    label: SEG_LABELS[displaySpin.segmentIdx] ?? "PERDU",
  } : null;

  const recentSpins = data?.recentSpins ?? [];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0a0000 0%, #180808 60%, #0a0005 100%)" }}>
      {/* Header */}
      <header className="flex-none flex items-center justify-between px-8 pt-5 pb-4"
        style={{ borderBottom: "2px solid rgba(231,76,60,0.3)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base" style={{ background: "#e74c3c", boxShadow: "0 0 20px rgba(231,76,60,0.5)" }}>HC</div>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-wide">Halgo Cash</p>
            <p className="text-[10px] font-bold tracking-[0.3em] uppercase" style={{ color: "#e74c3c" }}>🎡 Roulette Halgo en direct</p>
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

      {/* Main — wheel left, spins right */}
      <div className="flex-1 flex min-h-0 gap-0">
        {/* Left: wheel + result */}
        <div className="w-[42%] flex flex-col items-center justify-center gap-6 px-8"
          style={{ borderRight: "1px solid rgba(231,76,60,0.2)" }}>

          <RouletteWheel spinToIdx={displaySpin?.segmentIdx ?? null} spinning={spinning} />

          {/* Segment legend */}
          <div className="grid grid-cols-2 gap-1.5 w-full max-w-xs">
            {SEG_LABELS.map((lbl, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                style={{
                  background: displaySpin?.segmentIdx === i ? `${SEG_COLORS[i]}22` : "rgba(255,255,255,0.03)",
                  border: displaySpin?.segmentIdx === i ? `1px solid ${SEG_COLORS[i]}88` : "1px solid rgba(255,255,255,0.06)",
                }}>
                <div className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: SEG_COLORS[i] }} />
                <span className="text-[10px] font-black uppercase tracking-wider text-white/70 truncate">{lbl}</span>
              </div>
            ))}
          </div>

          {/* Last result badge */}
          <AnimatePresence mode="wait">
            {displaySpin && seg && (
              <motion.div key={displaySpin.id}
                initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.5, type: "spring" }}
                className="flex flex-col items-center gap-1 px-8 py-4 rounded-2xl w-full max-w-xs"
                style={{ background: `${seg.color}18`, border: `2px solid ${seg.color}66`, boxShadow: `0 0 30px ${seg.color}33` }}>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Dernier résultat</p>
                <p className="font-black text-2xl tracking-wider" style={{ color: seg.color }}>{seg.label}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-white/60 text-sm">×{displaySpin.multiplier}</span>
                  <span className="text-white/30">|</span>
                  <span className="font-black text-sm" style={{ color: displaySpin.netChange >= 0 ? "#22c55e" : "#ef4444" }}>
                    {displaySpin.netChange >= 0 ? "+" : ""}{FC(displaySpin.netChange)}
                  </span>
                </div>
              </motion.div>
            )}
            {!displaySpin && (
              <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center text-white/30 text-sm font-bold uppercase tracking-widest">
                En attente du premier spin…
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: recent spins feed */}
        <div className="flex-1 flex flex-col min-h-0 px-6 pt-5 pb-3">
          <p className="text-white/30 text-xs font-black uppercase tracking-[0.4em] mb-3">Historique des spins</p>

          {/* Column headers */}
          <div className="flex-none grid items-center mb-2 rounded-xl px-4 py-2"
            style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr", background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.25)" }}>
            <span className="text-[#e74c3c] font-black text-xs uppercase tracking-widest">Résultat</span>
            <span className="text-[#e74c3c] font-black text-xs uppercase tracking-widest text-center">×Mult</span>
            <span className="text-[#e74c3c] font-black text-xs uppercase tracking-widest text-right">Mise</span>
            <span className="text-[#e74c3c] font-black text-xs uppercase tracking-widest text-right">Gain net</span>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0a0000] to-transparent z-10 pointer-events-none" />
            <div className="h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {recentSpins.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 opacity-30">
                  <div className="text-6xl">🎡</div>
                  <p className="text-white text-base font-bold uppercase tracking-widest">Aucun spin pour l'instant</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 pb-4">
                  <AnimatePresence initial={false}>
                    {recentSpins.map((s, i) => {
                      const isFirst = i === 0;
                      const color = SEG_COLORS[s.segmentIdx] ?? "#555";
                      const isWin = s.netChange > 0;
                      const isLoss = s.netChange < 0;
                      return (
                        <motion.div key={s.id}
                          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: i * 0.015 }}
                          className="grid items-center px-4 py-2.5 rounded-xl"
                          style={{
                            gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
                            background: isFirst ? `${color}18` : i % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                            border: isFirst ? `1px solid ${color}55` : "1px solid rgba(255,255,255,0.06)",
                          }}>
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: color }} />
                            <span className="font-black text-sm" style={{ color: isFirst ? color : "rgba(255,255,255,0.8)" }}>{s.label}</span>
                          </div>
                          <div className="text-center">
                            <span className="font-black text-sm tabular-nums" style={{ color: color }}>×{s.multiplier}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-white/50 text-sm font-mono tabular-nums">{FC(s.betAmount)}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-sm tabular-nums"
                              style={{ color: isWin ? "#22c55e" : isLoss ? "#ef4444" : "rgba(255,255,255,0.4)" }}>
                              {s.netChange >= 0 ? "+" : ""}{FC(s.netChange)}
                            </span>
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
      </div>

      {/* Footer */}
      <footer className="flex-none py-3 text-center" style={{ borderTop: "2px solid rgba(231,76,60,0.2)" }}>
        <motion.p animate={{ opacity: [0.5, 0.9, 0.5] }} transition={{ duration: 3, repeat: Infinity }}
          className="text-xs font-black uppercase tracking-[0.4em]" style={{ color: "rgba(231,76,60,0.6)" }}>
          ✦ Tentez votre chance — Misez via l'application Halgo Cash ✦
        </motion.p>
      </footer>
    </div>
  );
}

// ── Malette Secrète View ───────────────────────────────────────────────────────
const CASE_COLORS = ["#F5C518", "#FF8C42", "#60C0FF", "#CC88FF"];
const CASE_NAMES  = ["Case 1", "Case 2", "Case 3", "Case 4"];

function MaletteCountdown({ ms }: { ms: number }) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  const urgent = s < 10;
  return (
    <motion.div animate={urgent ? { scale: [1, 1.04, 1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}
      className="font-mono font-black tabular-nums"
      style={{
        fontSize: "clamp(4rem, 12vw, 10rem)",
        color: urgent ? "#ef4444" : "#3498db",
        textShadow: urgent ? "0 0 80px rgba(239,68,68,0.6)" : "0 0 80px rgba(52,152,219,0.5)",
        letterSpacing: "-0.02em", lineHeight: 1,
      }}>
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
      if (closesAtRef.current !== null) setTimeLeft(Math.max(0, closesAtRef.current - Date.now()));
    }, 200);
    return () => clearInterval(t);
  }, []);

  const maxBet = state?.betsPerCase ? Math.max(...state.betsPerCase, 1) : 1;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(160deg, #00050a 0%, #001030 60%, #000510 100%)" }}>
      <header className="flex-none flex items-center justify-between px-8 pt-5 pb-3"
        style={{ borderBottom: "1px solid rgba(52,152,219,0.3)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base" style={{ background: "#3498db", boxShadow: "0 0 20px rgba(52,152,219,0.5)" }}>HC</div>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-wide">Halgo Cash</p>
            <p className="text-[10px] font-bold tracking-[0.3em] uppercase" style={{ color: "#3498db" }}>🧳 Malette Secrète en direct</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {state?.roundId && <span className="font-mono font-bold text-sm" style={{ color: "rgba(52,152,219,0.6)" }}>Round #{state.roundId}</span>}
          <Clock />
          <button onClick={onBack}
            className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white border border-white/10 hover:border-white/30 transition-colors">
            Changer
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
        <AnimatePresence mode="wait">
          {state?.status === "betting" && (
            <motion.div key="betting" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-center text-white/40 text-sm font-bold uppercase tracking-[0.4em] mb-2">Paris en cours — fermeture dans</p>
              <div className="flex justify-center"><MaletteCountdown ms={timeLeft} /></div>
            </motion.div>
          )}
          {state?.status === "closed" && (
            <motion.div key="closed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center">
              <p className="text-white/40 text-sm font-bold uppercase tracking-[0.4em] mb-2">Résultat du Round #{state.roundId}</p>
              <motion.p className="font-black text-5xl" style={{ color: "#22c55e", textShadow: "0 0 40px rgba(34,197,94,0.5)" }}
                animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1, repeat: Infinity }}>
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

        <div className="grid grid-cols-4 gap-5 w-full max-w-5xl">
          {CASE_COLORS.map((color, i) => {
            const betAmt = state?.betsPerCase?.[i] ?? 0;
            const mult = state?.multipliers?.[i];
            const isWinner = state?.status === "closed" && mult != null && mult > 0;
            const barPct = state?.betsPerCase ? (betAmt / maxBet) * 100 : 0;
            return (
              <motion.div key={i}
                animate={isWinner ? { scale: [1, 1.06, 1] } : {}} transition={{ duration: 0.8, repeat: isWinner ? Infinity : 0 }}
                className="flex flex-col items-center rounded-2xl overflow-hidden"
                style={{
                  background: isWinner ? `linear-gradient(135deg, ${color}33, ${color}18)` : "rgba(255,255,255,0.04)",
                  border: isWinner ? `2px solid ${color}cc` : `2px solid ${color}33`,
                  boxShadow: isWinner ? `0 0 40px ${color}55` : "none",
                  minHeight: 180, padding: "1.5rem 1rem",
                }}>
                <div className="font-black text-6xl mb-2" style={{ filter: `drop-shadow(0 0 16px ${color}88)` }}>🧳</div>
                <p className="font-black text-sm uppercase tracking-widest" style={{ color }}>{CASE_NAMES[i]}</p>
                <div className="w-full h-1.5 rounded-full mt-3 mb-2" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <motion.div className="h-full rounded-full" style={{ background: color }}
                    animate={{ width: `${barPct}%` }} transition={{ duration: 0.5 }} />
                </div>
                <p className="font-black text-sm tabular-nums" style={{ color: isWinner ? color : "rgba(255,255,255,0.7)" }}>
                  {betAmt > 0 ? FC(betAmt) : "—"}
                </p>
                {isWinner && mult != null && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-2 px-3 py-1 rounded-lg font-black text-sm"
                    style={{ background: `${color}33`, color, border: `1px solid ${color}66` }}>
                    ×{mult.toFixed(1)} GAGNÉ
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {state?.status === "betting" && (state.totalBets ?? 0) > 0 && (
          <p className="text-white/30 text-sm font-bold">
            Total des mises : <span style={{ color: "rgba(52,152,219,0.7)" }}>{FC(state.totalBets!)}</span>
          </p>
        )}
      </div>

      <footer className="flex-none py-3 text-center" style={{ borderTop: "1px solid rgba(52,152,219,0.15)" }}>
        <motion.p animate={{ opacity: [0.5, 0.9, 0.5] }} transition={{ duration: 3, repeat: Infinity }}
          className="text-xs font-black uppercase tracking-[0.4em]" style={{ color: "rgba(52,152,219,0.6)" }}>
          ✦ Misez sur la bonne malette via l'application Halgo Cash ✦
        </motion.p>
      </footer>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleBack(); };
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
      {selectedGame === "halgo-cash" && (
        <motion.div key="halgo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <HalgoCashView onBack={handleBack} />
        </motion.div>
      )}
      {selectedGame === "roulette" && (
        <motion.div key="roulette" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <RouletteView onBack={handleBack} />
        </motion.div>
      )}
      {selectedGame === "malette" && (
        <motion.div key="malette" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <MaletteView onBack={handleBack} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
