import { useState, useCallback, useEffect } from "react";
import { useBalance } from "@/lib/balance-context";
import { useLocation } from "wouter";
import { ArrowLeft, Gem, Bomb, TrendingUp, Loader2 } from "lucide-react";

function formatFC(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/[\u00a0\s]/g, " ");
}

const MINE_COUNTS = [3, 5, 10, 15, 20];
const GRID_SIZE = 25;

type CellState = "hidden" | "safe" | "mine" | "mine_revealed";
type Phase = "setup" | "playing" | "won" | "lost";

interface ActiveGame {
  gameId: number;
  betAmount: number;
  mineCount: number;
  revealedCells: number[];
  multiplier: number;
  cashoutAmount: number;
}

export default function MinesPage() {
  const [, navigate] = useLocation();
  const { balance: ctxBalance, setBalance, authFetch } = useBalance();
  const balance = ctxBalance ?? 0;

  const [phase, setPhase] = useState<Phase>("setup");
  const [mineCount, setMineCount] = useState(3);
  const [betInput, setBetInput] = useState("1000");
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [cells, setCells] = useState<CellState[]>(Array(GRID_SIZE).fill("hidden"));
  const [minePositions, setMinePositions] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [revealingCell, setRevealingCell] = useState<number | null>(null);
  const [cashingOut, setCashingOut] = useState(false);

  // Check for active game on mount
  useEffect(() => {
    authFetch("/api/mines/active").then(r => r.ok ? r.json() : null).then((d: ActiveGame | null) => {
      if (!d) return;
      setGame(d);
      const newCells: CellState[] = Array(GRID_SIZE).fill("hidden");
      for (const idx of d.revealedCells) newCells[idx] = "safe";
      setCells(newCells);
      setMineCount(d.mineCount);
      setBetInput(String(d.betAmount));
      setPhase("playing");
    }).catch(() => {});
  }, [authFetch]);

  const handleStart = async () => {
    const bet = parseInt(betInput, 10);
    if (isNaN(bet) || bet < 100) return;
    setLoading(true);
    try {
      const res = await authFetch("/api/mines/start", {
        method: "POST",
        body: JSON.stringify({ betAmount: bet, mineCount }),
      });
      if (!res.ok) {
        const e = await res.json() as { error?: string };
        alert(e.error ?? "Erreur");
        return;
      }
      const data = await res.json() as ActiveGame;
      setGame(data);
      setCells(Array(GRID_SIZE).fill("hidden"));
      setMinePositions([]);
      setPhase("playing");
      setBalance(Math.max(0, balance - bet));
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = async (idx: number) => {
    if (!game || phase !== "playing" || cells[idx] !== "hidden" || revealingCell !== null) return;
    setRevealingCell(idx);
    try {
      const res = await authFetch("/api/mines/reveal", {
        method: "POST",
        body: JSON.stringify({ gameId: game.gameId, cellIndex: idx }),
      });
      if (!res.ok) return;
      const data = await res.json() as {
        safe: boolean;
        multiplier: number;
        cashoutAmount?: number;
        minePositions?: number[];
        revealedCells: number[];
        allRevealed?: boolean;
      };

      const newCells: CellState[] = Array(GRID_SIZE).fill("hidden");
      for (const c of data.revealedCells) newCells[c] = "safe";

      if (!data.safe) {
        newCells[idx] = "mine";
        const minePosArr = data.minePositions ?? [];
        for (const m of minePosArr) {
          if (m !== idx) newCells[m] = "mine_revealed";
        }
        setMinePositions(minePosArr);
        setCells(newCells);
        setPhase("lost");
        setGame(null);
        return;
      }

      setCells(newCells);
      setGame(prev => prev ? { ...prev, revealedCells: data.revealedCells, multiplier: data.multiplier, cashoutAmount: data.cashoutAmount ?? prev.cashoutAmount } : null);

      if (data.allRevealed) {
        setPhase("won");
        setBalance(balance + (data.cashoutAmount ?? 0));
        setGame(null);
      }
    } finally {
      setRevealingCell(null);
    }
  };

  const handleCashout = async () => {
    if (!game || phase !== "playing" || game.revealedCells.length === 0) return;
    setCashingOut(true);
    try {
      const res = await authFetch("/api/mines/cashout", {
        method: "POST",
        body: JSON.stringify({ gameId: game.gameId }),
      });
      if (!res.ok) return;
      const data = await res.json() as { cashoutAmount: number; multiplier: number; minePositions: number[] };

      const newCells = [...cells];
      for (const m of data.minePositions) {
        if (newCells[m] === "hidden") newCells[m] = "mine_revealed";
      }
      setCells(newCells);
      setMinePositions(data.minePositions);
      setGame(prev => prev ? { ...prev, cashoutAmount: data.cashoutAmount, multiplier: data.multiplier } : null);
      setPhase("won");
      setBalance(balance + data.cashoutAmount);
    } finally {
      setCashingOut(false);
    }
  };

  const handleReset = () => {
    setPhase("setup");
    setCells(Array(GRID_SIZE).fill("hidden"));
    setMinePositions([]);
    setGame(null);
    setRevealingCell(null);
  };

  const safeSoFar = cells.filter(c => c === "safe").length;
  const maxSafe = GRID_SIZE - mineCount;

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "linear-gradient(160deg,#050e12 0%,#081418 50%,#040c10 100%)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button
          onClick={() => navigate("/app")}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <ArrowLeft style={{ width: 18, height: 18, color: "rgba(255,255,255,0.7)" }} />
        </button>
        <div>
          <h1 className="font-black text-white text-[18px] leading-none tracking-wide uppercase">MINES</h1>
          <p className="text-[10px] font-medium mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Évitez les mines, encaissez vos gains
          </p>
        </div>
        {balance !== null && (
          <div
            className="ml-auto px-3 py-1.5 rounded-xl text-[11px] font-black"
            style={{ background: "rgba(26,188,156,0.12)", border: "1px solid rgba(26,188,156,0.25)", color: "#1abc9c" }}
          >
            {formatFC(balance)} FC
          </div>
        )}
      </div>

      <div className="flex-1 px-4 pb-24 space-y-4 overflow-y-auto">

        {/* Setup panel */}
        {phase === "setup" && (
          <div
            className="rounded-2xl p-4 space-y-4"
            style={{ background: "rgba(26,188,156,0.06)", border: "1px solid rgba(26,188,156,0.15)" }}
          >
            {/* Mine count */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                Nombre de mines
              </p>
              <div className="flex gap-2">
                {MINE_COUNTS.map(n => (
                  <button
                    key={n}
                    onClick={() => setMineCount(n)}
                    className="flex-1 py-2.5 rounded-xl font-black text-[12px] transition-all active:scale-95"
                    style={mineCount === n ? {
                      background: "linear-gradient(135deg,#0d7a60,#1abc9c)",
                      color: "#fff",
                      boxShadow: "0 4px 14px rgba(26,188,156,0.45)",
                    } : {
                      background: "rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.5)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Bet amount */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                Mise (FC)
              </p>
              <div className="relative">
                <input
                  type="number"
                  min={100}
                  value={betInput}
                  onChange={e => setBetInput(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 font-black text-[15px] text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(26,188,156,0.25)" }}
                  placeholder="ex. 1000"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {[500, 1000, 5000, 10000].map(v => (
                  <button
                    key={v}
                    onClick={() => setBetInput(String(v))}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all active:scale-95"
                    style={{ background: "rgba(26,188,156,0.1)", color: "#1abc9c", border: "1px solid rgba(26,188,156,0.2)" }}
                  >
                    {v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
            </div>

            {/* Info row */}
            <div
              className="rounded-xl p-3 flex items-center justify-between"
              style={{ background: "rgba(0,0,0,0.3)" }}
            >
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Cases sûres</p>
                <p className="font-black text-white text-[14px]">{GRID_SIZE - mineCount}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>1ère case x</p>
                <p className="font-black text-[14px]" style={{ color: "#1abc9c" }}>
                  ×{(25 / (25 - mineCount) * 0.97).toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Max potentiel</p>
                <p className="font-black text-[14px]" style={{ color: "#F5C518" }}>
                  ×{(() => {
                    let m = 1;
                    const safeCount = GRID_SIZE - mineCount;
                    for (let i = 0; i < safeCount; i++) m *= (GRID_SIZE - i) / (safeCount - i);
                    return (m * 0.97).toFixed(0);
                  })()}
                </p>
              </div>
            </div>

            <button
              onClick={() => void handleStart()}
              disabled={loading || !betInput || parseInt(betInput, 10) < 100}
              className="w-full py-4 rounded-2xl font-black text-[14px] uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg,#0d7a60,#1abc9c)",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(26,188,156,0.4)",
              }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gem className="w-5 h-5" />}
              {loading ? "Lancement…" : "JOUER"}
            </button>
          </div>
        )}

        {/* Playing panel */}
        {(phase === "playing" || phase === "won" || phase === "lost") && (
          <>
            {/* Multiplier bar */}
            <div
              className="rounded-2xl p-4 flex items-center justify-between"
              style={{ background: "rgba(26,188,156,0.06)", border: "1px solid rgba(26,188,156,0.15)" }}
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Multiplicateur</p>
                <p className="font-black text-[28px] leading-none" style={{ color: "#1abc9c", textShadow: "0 0 20px rgba(26,188,156,0.5)" }}>
                  ×{game?.multiplier.toFixed(2) ?? (phase === "won" || phase === "lost" ? "—" : "1.00")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {phase === "won" ? "Gagné" : phase === "lost" ? "Perdu" : "Encaissement"}
                </p>
                <p className="font-black text-[18px] leading-none" style={{
                  color: phase === "won" ? "#1abc9c" : phase === "lost" ? "#ef4444" : "#fff"
                }}>
                  {formatFC(
                    phase === "won" ? (game?.cashoutAmount ?? 0) :
                    phase === "lost" ? 0 :
                    (game?.cashoutAmount ?? 0)
                  )} FC
                </p>
              </div>
            </div>

            {/* Progress */}
            {phase === "playing" && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${(safeSoFar / maxSafe) * 100}%`, background: "linear-gradient(90deg,#0d7a60,#1abc9c)" }}
                  />
                </div>
                <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {safeSoFar}/{maxSafe}
                </span>
              </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-5 gap-2">
              {cells.map((state, idx) => {
                const isRevealing = revealingCell === idx;
                return (
                  <button
                    key={idx}
                    disabled={phase !== "playing" || state !== "hidden" || revealingCell !== null}
                    onClick={() => void handleReveal(idx)}
                    className="aspect-square rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 disabled:cursor-default"
                    style={{
                      background: state === "safe"
                        ? "linear-gradient(135deg,#0d4a38,#1abc9c33)"
                        : state === "mine"
                        ? "linear-gradient(135deg,#4a0d0d,#ef444433)"
                        : state === "mine_revealed"
                        ? "rgba(239,68,68,0.12)"
                        : "rgba(255,255,255,0.05)",
                      border: state === "safe"
                        ? "1px solid rgba(26,188,156,0.45)"
                        : state === "mine" || state === "mine_revealed"
                        ? "1px solid rgba(239,68,68,0.35)"
                        : "1px solid rgba(255,255,255,0.1)",
                      boxShadow: state === "safe"
                        ? "0 0 12px rgba(26,188,156,0.2)"
                        : state === "mine"
                        ? "0 0 16px rgba(239,68,68,0.4)"
                        : "none",
                    }}
                  >
                    {isRevealing && (
                      <Loader2 style={{ width: 16, height: 16, color: "#1abc9c" }} className="animate-spin" />
                    )}
                    {!isRevealing && state === "safe" && (
                      <Gem style={{ width: 18, height: 18, color: "#1abc9c", filter: "drop-shadow(0 0 6px rgba(26,188,156,0.8))" }} />
                    )}
                    {!isRevealing && (state === "mine" || state === "mine_revealed") && (
                      <Bomb style={{ width: 18, height: 18, color: state === "mine" ? "#ef4444" : "rgba(239,68,68,0.5)", filter: state === "mine" ? "drop-shadow(0 0 8px rgba(239,68,68,0.9))" : "none" }} />
                    )}
                    {!isRevealing && state === "hidden" && (
                      <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            {phase === "playing" && (
              <button
                onClick={() => void handleCashout()}
                disabled={cashingOut || (game?.revealedCells.length ?? 0) === 0}
                className="w-full py-4 rounded-2xl font-black text-[14px] uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg,#c8960a,#F5C518)",
                  color: "#3a1f00",
                  boxShadow: "0 4px 20px rgba(245,197,24,0.3)",
                }}
              >
                {cashingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
                {cashingOut ? "Encaissement…" : `ENCAISSER — ×${game?.multiplier.toFixed(2) ?? "1.00"}`}
              </button>
            )}

            {(phase === "won" || phase === "lost") && (
              <div
                className="rounded-2xl p-5 flex flex-col items-center gap-3 text-center"
                style={{
                  background: phase === "won"
                    ? "linear-gradient(160deg,#0a2a1e,#0d3d28)"
                    : "linear-gradient(160deg,#2a0a0a,#3d0d0d)",
                  border: `1px solid ${phase === "won" ? "rgba(26,188,156,0.3)" : "rgba(239,68,68,0.3)"}`,
                }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    background: phase === "won"
                      ? "radial-gradient(circle,#1abc9c55,transparent)"
                      : "radial-gradient(circle,#ef444455,transparent)",
                    border: `2px solid ${phase === "won" ? "#1abc9c" : "#ef4444"}`,
                  }}
                >
                  {phase === "won"
                    ? <Gem style={{ width: 28, height: 28, color: "#1abc9c" }} />
                    : <Bomb style={{ width: 28, height: 28, color: "#ef4444" }} />
                  }
                </div>
                <div>
                  <p className="font-black text-white text-[18px]">
                    {phase === "won" ? "ENCAISSÉ !" : "MINE TOUCHÉE !"}
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {phase === "won"
                      ? `+${formatFC(game?.cashoutAmount ?? 0)} FC crédités`
                      : `Mise de ${formatFC(parseInt(betInput, 10))} FC perdue`
                    }
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="w-full py-3.5 rounded-xl font-black text-[13px] uppercase tracking-wide transition-all active:scale-[0.98]"
                  style={{
                    background: phase === "won"
                      ? "linear-gradient(135deg,#0d7a60,#1abc9c)"
                      : "rgba(255,255,255,0.08)",
                    color: "#fff",
                    border: phase === "lost" ? "1px solid rgba(255,255,255,0.15)" : "none",
                  }}
                >
                  Rejouer
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
