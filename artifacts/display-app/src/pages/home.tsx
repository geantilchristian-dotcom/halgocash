import { motion, AnimatePresence } from "framer-motion";
import {
  useGetLatestDraw,
  useListWinners,
  getGetLatestDrawQueryKey,
  getListWinnersQueryKey,
} from "@workspace/api-client-react";
import { useEffect, useRef, useState } from "react";

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

/* Pulse ring animation for newest winner */
function PulseRing() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f5c518] opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#f5c518]" />
    </span>
  );
}

type Winner = {
  drawNumber: number;
  maskedCode: string;
  prizeAmount: string | number;
};

export default function Home() {
  const { data: draw } = useGetLatestDraw({
    query: { refetchInterval: 10000, queryKey: getGetLatestDrawQueryKey() },
  });
  const { data: winners } = useListWinners(
    { limit: 100 },
    { query: { refetchInterval: 5000, queryKey: getListWinnersQueryKey({ limit: 100 }) } }
  );

  const jackpot = Number(draw?.jackpotAmount ?? 0);

  /* Track previously seen codes to flash new arrivals */
  const seenRef = useRef<Set<string>>(new Set());
  const [newCodes, setNewCodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!winners) return;
    const fresh: string[] = [];
    winners.forEach((w: Winner) => {
      const key = `${w.drawNumber}-${w.maskedCode}`;
      if (!seenRef.current.has(key)) {
        fresh.push(key);
        seenRef.current.add(key);
      }
    });
    if (fresh.length > 0 && seenRef.current.size > fresh.length) {
      // Only flash if this isn't the initial load
      setNewCodes(new Set(fresh));
      setTimeout(() => setNewCodes(new Set()), 4000);
    } else {
      fresh.forEach((k) => seenRef.current.add(k));
    }
  }, [winners]);

  const rows: Winner[] = winners ?? [];

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #050d05 0%, #0a180a 60%, #060a1a 100%)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ── HEADER — Jackpot ── */}
      <header
        className="flex-none flex flex-col items-center justify-center pt-6 pb-5 px-8 relative"
        style={{
          background: "linear-gradient(180deg, rgba(245,197,24,0.12) 0%, transparent 100%)",
          borderBottom: "2px solid rgba(245,197,24,0.25)",
        }}
      >
        {/* top bar: logo + clock */}
        <div className="absolute top-4 left-6 flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-black text-lg"
            style={{ background: "#f5c518", boxShadow: "0 0 20px rgba(245,197,24,0.5)" }}
          >
            HC
          </div>
          <div>
            <p className="text-white font-black text-base leading-none uppercase tracking-wide">Halgo Cash</p>
            <p className="text-[#f5c518] text-[10px] font-bold tracking-[0.3em] uppercase">Loterie en direct</p>
          </div>
        </div>
        <div className="absolute top-5 right-6">
          <Clock />
        </div>

        {/* Jackpot */}
        <p
          className="text-xs font-black uppercase tracking-[0.45em] mb-1"
          style={{ color: "rgba(245,197,24,0.7)" }}
        >
          ✦ Jackpot de la semaine ✦
        </p>
        <motion.p
          key={jackpot}
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 110, damping: 12 }}
          className="font-black leading-none text-center"
          style={{
            fontSize: "clamp(2.8rem, 7vw, 5.5rem)",
            color: "#f5c518",
            textShadow: "0 0 60px rgba(245,197,24,0.55), 0 2px 0 rgba(0,0,0,0.6)",
            letterSpacing: "-0.02em",
          }}
        >
          {jackpot > 0 ? FC(jackpot) : "— FC"}
        </motion.p>
      </header>

      {/* ── TABLE — Gagnants ── */}
      <div className="flex-1 flex flex-col min-h-0 px-6 pt-4 pb-2">
        {/* Table header */}
        <div
          className="flex-none grid items-center mb-2 rounded-xl px-5 py-3"
          style={{
            gridTemplateColumns: "2fr 1fr 2fr 2fr",
            background: "rgba(245,197,24,0.15)",
            border: "1px solid rgba(245,197,24,0.35)",
          }}
        >
          <span className="text-[#f5c518] font-black text-sm uppercase tracking-widest">ID Billet</span>
          <span className="text-[#f5c518] font-black text-sm uppercase tracking-widest text-center">Statut</span>
          <span className="text-[#f5c518] font-black text-sm uppercase tracking-widest text-right">Montant gagné</span>
          <span className="text-[#f5c518] font-black text-sm uppercase tracking-widest text-right">Code billet</span>
        </div>

        {/* Scrollable rows */}
        <div className="flex-1 overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#050d05] to-transparent z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#060a1a] to-transparent z-10 pointer-events-none" />

          <div className="h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {rows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
                <div className="text-7xl">🎟️</div>
                <p className="text-white text-xl font-bold uppercase tracking-widest">
                  Aucun gagnant pour l'instant
                </p>
                <p className="text-white/60 text-sm">
                  Les billets gagnants s'afficheront ici en temps réel
                </p>
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
                        key={key}
                        layout
                        initial={{ opacity: 0, y: -30, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="grid items-center px-5 py-3 rounded-xl relative overflow-hidden"
                        style={{
                          gridTemplateColumns: "2fr 1fr 2fr 2fr",
                          background: isNew
                            ? "linear-gradient(90deg, rgba(245,197,24,0.22), rgba(245,197,24,0.08))"
                            : i % 2 === 0
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(255,255,255,0.025)",
                          border: isNew
                            ? "1px solid rgba(245,197,24,0.6)"
                            : isBig
                            ? "1px solid rgba(34,197,94,0.25)"
                            : "1px solid rgba(255,255,255,0.07)",
                          boxShadow: isNew
                            ? "0 0 30px rgba(245,197,24,0.2)"
                            : isBig
                            ? "0 0 20px rgba(34,197,94,0.1)"
                            : "none",
                        }}
                      >
                        {/* Flash shimmer for new winners */}
                        {isNew && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
                            initial={{ x: "-100%" }}
                            animate={{ x: "100%" }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                          />
                        )}

                        {/* ID Billet */}
                        <div className="flex items-center gap-3">
                          {isNew && <PulseRing />}
                          <span
                            className="font-mono font-black text-lg tracking-widest"
                            style={{ color: isNew ? "#f5c518" : "rgba(255,255,255,0.85)" }}
                          >
                            {w.drawNumber.toString().padStart(2, "0")}
                            <span className="text-white/30 mx-0.5">—</span>
                            {w.maskedCode.slice(0, 4)}
                            <span className="text-white/20">····</span>
                          </span>
                        </div>

                        {/* Statut */}
                        <div className="flex justify-center">
                          <span
                            className="font-black text-sm uppercase tracking-wider px-3 py-1 rounded-lg"
                            style={{
                              background: isNew
                                ? "rgba(245,197,24,0.2)"
                                : "rgba(34,197,94,0.15)",
                              color: isNew ? "#f5c518" : "#22c55e",
                              border: isNew
                                ? "1px solid rgba(245,197,24,0.5)"
                                : "1px solid rgba(34,197,94,0.4)",
                            }}
                          >
                            GAGNÉ
                          </span>
                        </div>

                        {/* Montant */}
                        <div className="text-right">
                          <span
                            className="font-black text-xl tabular-nums"
                            style={{
                              color: isBig ? "#22c55e" : "rgba(255,255,255,0.9)",
                              textShadow: isBig ? "0 0 20px rgba(34,197,94,0.4)" : "none",
                            }}
                          >
                            {FC(prize)}
                          </span>
                        </div>

                        {/* Code billet masqué */}
                        <div className="text-right">
                          <span className="font-mono text-sm text-white/35 tracking-widest">
                            {w.maskedCode}
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

      {/* ── FOOTER — CTA ── */}
      <footer
        className="flex-none py-4 text-center relative overflow-hidden"
        style={{
          background: "linear-gradient(90deg, #0a1f0a, #0d260d, #0a1f0a)",
          borderTop: "2px solid rgba(34,197,94,0.3)",
        }}
      >
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
