import { motion, AnimatePresence } from "framer-motion";
import { useGetLatestDraw, useGetStats, useListWinners, getGetLatestDrawQueryKey, getGetStatsQueryKey, getListWinnersQueryKey } from "@workspace/api-client-react";
import { useEffect, useState } from "react";

const FC = (n: number) =>
  new Intl.NumberFormat("fr-CD", { style: "currency", currency: "CDF", maximumFractionDigits: 0 }).format(n);

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-2xl text-white/70 tabular-nums">
      {time.toLocaleTimeString("fr-FR")}
    </span>
  );
}

export default function Home() {
  const { data: draw } = useGetLatestDraw({ query: { refetchInterval: 15000, queryKey: getGetLatestDrawQueryKey() } });
  const { data: stats } = useGetStats({ query: { refetchInterval: 30000, queryKey: getGetStatsQueryKey() } });
  const { data: winners } = useListWinners({ limit: 50 }, { query: { refetchInterval: 20000, queryKey: getListWinnersQueryKey({ limit: 50 }) } });

  const jackpot = Number(draw?.jackpotAmount ?? 0);
  const bestWinner = winners && winners.length > 0
    ? winners.reduce((best, w) => Number(w.prizeAmount) > Number(best.prizeAmount) ? w : best, winners[0])
    : null;

  return (
    <div className="h-screen w-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── HEADER ── */}
      <header className="flex-none flex items-center justify-between px-10 py-5 bg-black/60 border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#f5c518] flex items-center justify-center shadow-[0_0_24px_rgba(245,197,24,0.5)]">
            <span className="text-black font-black text-2xl tracking-tighter">HC</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-wide leading-none">Halgo Cash</h1>
            <p className="text-[#f5c518] text-xs font-bold tracking-[0.3em] uppercase mt-0.5">Loterie — Tirage en direct</p>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <div className="text-center">
            <p className="text-white/40 text-xs uppercase tracking-widest">Tirage</p>
            <p className="font-mono text-3xl font-black text-white tracking-wider">
              #{(draw?.drawNumber ?? 0).toString().padStart(4, "0")}
            </p>
          </div>
          <div className="text-center">
            <p className="text-white/40 text-xs uppercase tracking-widest">Heure</p>
            <Clock />
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <main className="flex-1 grid grid-cols-12 gap-0 min-h-0">

        {/* LEFT — Jackpot + Billet gagnant */}
        <section className="col-span-5 flex flex-col items-center justify-center gap-6 px-10 border-r border-white/10 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#f5c518]/5 to-transparent pointer-events-none" />

          {/* Jackpot de la semaine */}
          <div className="text-center relative z-10 w-full">
            <p className="text-[#f5c518] text-sm font-bold uppercase tracking-[0.35em] mb-2">Jackpot de la semaine</p>
            <motion.p
              key={jackpot}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 14 }}
              className="text-5xl xl:text-6xl font-black text-white leading-none"
              style={{ textShadow: "0 0 40px rgba(245,197,24,0.4)" }}
            >
              {FC(jackpot)}
            </motion.p>
          </div>

          <div className="w-full h-px bg-white/10" />

          {/* Billet gagnant */}
          <div className="text-center w-full relative z-10">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Billet gagnant</p>
            <AnimatePresence mode="wait">
              {draw?.winningTicketCode ? (
                <motion.div
                  key="winner"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 140, damping: 12 }}
                  className="inline-block border-2 border-[#22c55e] rounded-2xl px-8 py-5 bg-[#22c55e]/10 shadow-[0_0_40px_rgba(34,197,94,0.25)]"
                >
                  <span className="font-mono text-4xl xl:text-5xl font-black text-[#22c55e] tracking-widest">
                    {draw.winningTicketCode}
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="pending"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="inline-block border-2 border-white/20 rounded-2xl px-8 py-5"
                >
                  <span className="font-mono text-3xl font-bold text-white/30 tracking-widest uppercase">
                    {draw?.status === "active" ? "En cours…" : "Pas de gagnant"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="w-full h-px bg-white/10" />

          {/* Meilleur gagnant */}
          <div className="text-center w-full relative z-10">
            <p className="text-[#f5c518] text-xs font-bold uppercase tracking-[0.3em] mb-3">🏆 Meilleur gagnant</p>
            {bestWinner ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4">
                <p className="font-mono text-2xl font-black text-white tracking-widest">{bestWinner.maskedCode}</p>
                <p className="text-[#f5c518] text-lg font-bold mt-1">{FC(Number(bestWinner.prizeAmount))}</p>
                <p className="text-white/30 text-xs mt-1">Tirage #{bestWinner.drawNumber}</p>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4">
                <p className="text-white/30 text-sm uppercase tracking-widest">Aucun gagnant pour l'instant</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 w-full relative z-10">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Billets vendus</p>
              <p className="text-2xl font-black text-white">{(stats?.totalTicketsSold ?? 0).toLocaleString("fr-FR")}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Vendeurs actifs</p>
              <p className="text-2xl font-black text-white">{stats?.activeVendors ?? 0}</p>
            </div>
          </div>
        </section>

        {/* RIGHT — Liste des numéros gagnants */}
        <section className="col-span-7 flex flex-col min-h-0 px-8 py-6">
          <p className="text-white/50 text-xs font-bold uppercase tracking-[0.35em] mb-4 flex-none">
            Numéros grattés &amp; gagnants récents
          </p>

          {winners && winners.length > 0 ? (
            <div className="flex-1 overflow-hidden relative">
              {/* fade mask top/bottom */}
              <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#0a0a0f] to-transparent z-10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#0a0a0f] to-transparent z-10 pointer-events-none" />

              <div className="h-full overflow-y-auto scrollbar-hide pr-1">
                <div className="grid grid-cols-2 gap-3">
                  {winners.map((w, i) => (
                    <motion.div
                      key={`${w.drawNumber}-${w.maskedCode}-${i}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#f5c518]/15 border border-[#f5c518]/30 flex items-center justify-center flex-none">
                          <span className="text-[#f5c518] text-xs font-black">#{w.drawNumber}</span>
                        </div>
                        <span className="font-mono text-base font-bold text-white tracking-widest truncate">
                          {w.maskedCode}
                        </span>
                      </div>
                      <span className="text-[#22c55e] font-black text-sm whitespace-nowrap flex-none">
                        {FC(Number(w.prizeAmount))}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🎟️</div>
                <p className="text-white/30 text-lg uppercase tracking-widest">Aucun numéro gagnant</p>
                <p className="text-white/20 text-sm mt-2">Les billets gagnants apparaîtront ici</p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ── TICKER BAS ── */}
      <footer className="flex-none bg-[#f5c518] py-3 overflow-hidden relative">
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#f5c518] to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#f5c518] to-transparent z-10" />
        <div className="flex animate-ticker whitespace-nowrap">
          {[...Array(3)].map((_, rep) => (
            <span key={rep} className="inline-flex items-center gap-6 text-black font-bold text-sm uppercase tracking-widest mx-4">
              {winners && winners.length > 0
                ? winners.slice(0, 10).map((w, i) => (
                    <span key={i} className="inline-flex items-center gap-3 mr-8">
                      <span className="bg-black text-[#f5c518] px-2 py-0.5 rounded text-xs font-black">#{w.drawNumber}</span>
                      <span className="font-mono font-black">{w.maskedCode}</span>
                      <span className="text-green-800 font-black">{FC(Number(w.prizeAmount))}</span>
                      <span className="text-black/40 mx-2">◆</span>
                    </span>
                  ))
                : <span className="mr-8">Jouez à Halgo Cash — Grattez et gagnez ! ◆ Disponible chez tous nos vendeurs agréés ◆</span>
              }
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
