import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  useGetLatestDraw, 
  useGetStats, 
  useListWinners,
  getGetLatestDrawQueryKey, 
  getGetStatsQueryKey, 
  getListWinnersQueryKey 
} from "@workspace/api-client-react";

export default function Home() {
  const { data: latestDraw } = useGetLatestDraw({
    query: {
      refetchInterval: 30000,
      queryKey: getGetLatestDrawQueryKey(),
    },
  });

  const { data: stats } = useGetStats({
    query: {
      refetchInterval: 30000,
      queryKey: getGetStatsQueryKey(),
    },
  });

  const { data: winners } = useListWinners(
    { limit: 20 },
    { query: { refetchInterval: 60000, queryKey: getListWinnersQueryKey({ limit: 20 }) } }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CD", {
      style: "currency",
      currency: "CDF",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const isPending = !latestDraw?.winningTicketCode && latestDraw?.status === "active";

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col overflow-hidden relative selection:bg-primary selection:text-primary-foreground">
      {/* Background ambient effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-accent rounded-full blur-[150px]" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full px-12 py-8 flex justify-between items-center border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-[0_0_30px_rgba(255,215,0,0.5)]">
            <span className="text-black font-black text-3xl tracking-tighter">HC</span>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase">Halgo Cash</h1>
            <p className="text-primary font-medium tracking-widest text-sm uppercase opacity-90">Live Draw</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white/60 text-lg font-medium uppercase tracking-wider">Draw Number</p>
          <p className="text-5xl font-mono font-bold text-white shadow-black drop-shadow-md">
            #{latestDraw?.drawNumber?.toString().padStart(4, "0") || "0000"}
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center p-12 gap-12">
        {/* Jackpot Section */}
        <motion.div 
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center w-full max-w-5xl"
        >
          <h2 className="text-primary text-3xl md:text-4xl font-bold uppercase tracking-[0.2em] mb-4">Current Jackpot</h2>
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <span className="relative text-7xl md:text-[8rem] lg:text-[10rem] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/60 drop-shadow-2xl">
              {formatCurrency(latestDraw?.jackpotAmount || 0)}
            </span>
          </div>
        </motion.div>

        {/* Winner Reveal Section */}
        <div className="w-full max-w-4xl bg-black/40 border border-white/10 p-12 rounded-3xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent" />
          
          <div className="text-center space-y-6 relative z-10">
            <h3 className="text-white/60 text-xl font-medium uppercase tracking-widest">Winning Ticket</h3>
            
            <div className="h-32 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {isPending ? (
                  <motion.div
                    key="pending"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="flex gap-3">
                      {[0,1,2].map((i) => (
                        <motion.div 
                          key={i}
                          animate={{ 
                            scale: [1, 1.5, 1],
                            opacity: [0.3, 1, 0.3]
                          }}
                          transition={{ 
                            duration: 1.5, 
                            repeat: Infinity, 
                            delay: i * 0.2 
                          }}
                          className="w-6 h-6 rounded-full bg-accent shadow-[0_0_15px_rgba(230,57,100,0.6)]"
                        />
                      ))}
                    </div>
                    <p className="text-2xl font-bold text-accent uppercase tracking-widest animate-pulse">Draw Pending</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="revealed"
                    initial={{ opacity: 0, scale: 0.5, rotateX: -20 }}
                    animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                    transition={{ type: "spring", damping: 15, stiffness: 100 }}
                    className="flex items-center justify-center"
                  >
                    <div className="bg-secondary/20 border-2 border-secondary px-10 py-6 rounded-2xl shadow-[0_0_50px_rgba(33,197,94,0.3)]">
                      <span className="text-6xl font-mono font-bold text-secondary tracking-widest">
                        {latestDraw?.winningTicketCode || "NO WINNER"}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="grid grid-cols-3 gap-8 w-full max-w-5xl"
        >
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center backdrop-blur-sm">
            <p className="text-white/50 text-sm uppercase tracking-wider mb-2">Total Prizes Paid</p>
            <p className="text-3xl font-bold text-white">{formatCurrency(stats?.totalPrizesPaid || 0)}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center backdrop-blur-sm">
            <p className="text-white/50 text-sm uppercase tracking-wider mb-2">Active Vendors</p>
            <p className="text-3xl font-bold text-white">{stats?.activeVendors || 0}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center backdrop-blur-sm">
            <p className="text-white/50 text-sm uppercase tracking-wider mb-2">Completed Draws</p>
            <p className="text-3xl font-bold text-white">{stats?.completedDraws || 0}</p>
          </div>
        </motion.div>
      </main>

      {/* Scrolling Ticker (Recent Winners / Draws) */}
      <footer className="relative z-20 bg-primary border-t-4 border-primary-border overflow-hidden py-4">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-primary to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-primary to-transparent z-10" />
        
        <div className="flex w-[200%] animate-ticker hover:[animation-play-state:paused]">
          {/* Repeat content twice for smooth infinite scrolling */}
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex-1 flex items-center justify-around whitespace-nowrap">
              {winners?.slice(0, 10).map((winner, idx) => (
                <div key={idx} className="flex items-center gap-4 mx-8">
                  <div className="bg-black text-primary px-3 py-1 rounded font-bold text-sm uppercase">Winner #{winner.drawNumber}</div>
                  <span className="text-black font-mono font-bold text-2xl">
                    {winner.maskedCode}
                  </span>
                  <span className="text-black/60 font-black text-2xl">•</span>
                  <span className="text-black font-bold text-2xl">
                    {formatCurrency(winner.prizeAmount)}
                  </span>
                  <span className="text-black/60 font-black text-2xl mx-8">||</span>
                </div>
              ))}
              {/* Fallback if not enough data */}
              {(!winners || winners.length === 0) && (
                <div className="flex items-center gap-4 mx-8">
                  <div className="bg-black text-primary px-3 py-1 rounded font-bold text-sm uppercase">Join Now</div>
                  <span className="text-black font-bold text-2xl uppercase tracking-wider">
                    Play Halgo Cash Today
                  </span>
                  <span className="text-black/60 font-black text-2xl mx-8">||</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
