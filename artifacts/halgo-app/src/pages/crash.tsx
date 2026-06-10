import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { ArrowLeft, TrendingUp, Users, Clock } from "lucide-react";

type Phase = "waiting" | "flying" | "crashed";

interface HistoryEntry { cp: number }

function fFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".");
}
function fMult(m: number) { return m.toFixed(2) + "×"; }

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function multColor(m: number) {
  if (m < 2) return "#4ade80";
  if (m < 5) return "#facc15";
  if (m < 10) return "#f97316";
  return "#ef4444";
}

// Crash point distribution: ~4% instant crash; rest exponential
function genCrashPoint(): number {
  const r = Math.random();
  if (r < 0.04) return 1.0;
  return Math.max(1.01, Math.round((1 / (1 - r)) * 100) / 100);
}

const K = 0.07; // growth rate: multiplier = e^(K*t)
function tToM(t: number) { return Math.exp(K * t); }
function mToT(m: number) { return Math.log(Math.max(1, m)) / K; }

const WAIT = 5; // seconds between rounds

// Initial seeded history
const SEED_HISTORY: HistoryEntry[] = [
  { cp: 2.14 }, { cp: 1.03 }, { cp: 8.73 }, { cp: 1.02 }, { cp: 4.55 },
  { cp: 1.22 }, { cp: 15.33 }, { cp: 3.01 }, { cp: 1.55 }, { cp: 6.78 },
];

function drawCurve(
  canvas: HTMLCanvasElement,
  elapsed: number,
  phase: Phase,
  crashPoint: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = "#080f0a";
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = "rgba(141,198,63,0.06)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 7; i++) {
    const x = (W * i) / 7;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let i = 1; i < 5; i++) {
    const y = (H * i) / 5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  if (elapsed <= 0 && phase !== "crashed") return;

  const maxElapsed = phase === "crashed" ? mToT(crashPoint) : elapsed;
  const windowSec = Math.max(18, maxElapsed * 1.25);
  const startT = Math.max(0, maxElapsed - windowSec);
  const marginL = 24;
  const usableW = W - marginL - 16;
  const usableH = H - 40;
  const maxM = Math.max(crashPoint * 1.3, 2.5);

  const tx = (t: number) => marginL + ((t - startT) / windowSec) * usableW;
  const my = (m: number) => {
    const logScale = Math.log(Math.max(1.001, m)) / Math.log(Math.max(1.001, maxM));
    return usableH - logScale * (usableH - 16);
  };

  const STEPS = 100;
  const pts: [number, number][] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * maxElapsed;
    pts.push([tx(t), my(tToM(t))]);
  }
  if (pts.length < 2) return;

  const [lx, ly] = pts[pts.length - 1];
  const color = phase === "crashed" ? "#ef4444" : multColor(tToM(elapsed));

  // Fill under curve
  ctx.beginPath();
  ctx.moveTo(pts[0][0], usableH);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(lx, usableH);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, 0, 0, usableH);
  fill.addColorStop(0, hexToRgba(color, 0.22));
  fill.addColorStop(1, hexToRgba(color, 0.02));
  ctx.fillStyle = fill;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Icon at tip
  ctx.save();
  ctx.translate(lx, ly);
  if (phase === "flying" && pts.length >= 2) {
    const [px, py] = pts[pts.length - 2];
    const angle = Math.atan2(ly - py, lx - px);
    ctx.rotate(angle);
    ctx.font = "22px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🚀", 0, 0);
  } else if (phase === "crashed") {
    ctx.font = "26px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💥", 0, -10);
  }
  ctx.restore();

  // Multiplier labels on y axis
  const labels = [2, 5, 10, 20, 50].filter((l) => l <= maxM * 0.95);
  ctx.font = "9px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.textAlign = "left";
  for (const label of labels) {
    const y = my(label);
    if (y > 10 && y < H - 5) {
      ctx.fillText(label + "×", 2, y + 3);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(marginL - 4, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

export default function CrashGame() {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();

  // ── Display state ──
  const [phase, setPhase] = useState<Phase>("waiting");
  const [multiplier, setMultiplier] = useState(1.0);
  const [countdown, setCountdown] = useState(WAIT);
  const [history, setHistory] = useState<HistoryEntry[]>(SEED_HISTORY);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceFlash, setBalanceFlash] = useState(false);

  // Bet UI state
  const [betInput, setBetInput] = useState("1000");
  const [autoCashoutInput, setAutoCashoutInput] = useState("");
  const [betPlaced, setBetPlaced] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashoutMult, setCashoutMult] = useState<number | null>(null);
  const [winAmount, setWinAmount] = useState<number | null>(null);

  // ── Refs (mutable, used in RAF) ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("waiting");
  const crashPointRef = useRef(2.0);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const betRef = useRef({ placed: false, amount: 0, cashedOut: false, autoCashout: 0 });

  // Keep betRef in sync with UI
  useEffect(() => { betRef.current.autoCashout = parseFloat(autoCashoutInput) || 0; }, [autoCashoutInput]);

  const authFetch = useCallback(async (url: string, opts: RequestInit = {}) => {
    const token = await getToken().catch(() => null);
    const headers: Record<string, string> = { ...(opts.headers as Record<string, string> ?? {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...opts, headers, credentials: "include" });
  }, [getToken]);

  // Fetch balance once on mount
  useEffect(() => {
    authFetch("/api/auth/balance")
      .then((r) => r.json())
      .then((d: { balance: number }) => setBalance(d.balance ?? 0))
      .catch(() => setBalance(0));
  }, [authFetch]);

  // Cash-out handler (called from RAF or button)
  const doCashOut = useCallback((atMult: number, betAmount: number) => {
    if (betRef.current.cashedOut) return;
    betRef.current.cashedOut = true;
    const won = Math.floor(betAmount * atMult);
    setCashedOut(true);
    setCashoutMult(atMult);
    setWinAmount(won);
    setBalance((prev) => {
      const nb = (prev ?? 0) + won;
      try { localStorage.setItem("halgo_balance", String(nb)); } catch { /* ignore */ }
      return nb;
    });
    setBalanceFlash(true);
    setTimeout(() => setBalanceFlash(false), 600);
  }, []);

  // ── Game loop ──
  const startRound = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    const cp = genCrashPoint();
    crashPointRef.current = cp;
    phaseRef.current = "waiting";
    betRef.current = { placed: false, amount: 0, cashedOut: false, autoCashout: betRef.current.autoCashout };

    setPhase("waiting");
    setMultiplier(1.0);
    setBetPlaced(false);
    setCashedOut(false);
    setCashoutMult(null);
    setWinAmount(null);

    const canvas = canvasRef.current;
    if (canvas) drawCurve(canvas, 0, "waiting", cp);

    let remaining = WAIT;
    setCountdown(remaining);

    const cdInterval = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(cdInterval);
        launchFlight();
      }
    }, 1000);

    function launchFlight() {
      phaseRef.current = "flying";
      setPhase("flying");
      startTimeRef.current = performance.now();

      function tick(now: number) {
        const elapsed = (now - startTimeRef.current) / 1000;
        const m = tToM(elapsed);
        setMultiplier(m);

        const c = canvasRef.current;
        if (c) drawCurve(c, elapsed, "flying", crashPointRef.current);

        // Auto cash out
        const autoAt = betRef.current.autoCashout;
        if (betRef.current.placed && !betRef.current.cashedOut && autoAt > 1 && m >= autoAt) {
          doCashOut(m, betRef.current.amount);
        }

        // Check crash
        if (m >= crashPointRef.current) {
          const finalM = crashPointRef.current;
          setMultiplier(finalM);
          phaseRef.current = "crashed";
          setPhase("crashed");
          if (c) drawCurve(c, mToT(finalM), "crashed", finalM);
          setHistory((h) => [{ cp: finalM }, ...h].slice(0, 12));
          setTimeout(() => startRound(), 3500);
          return;
        }

        rafRef.current = requestAnimationFrame(tick);
      }

      rafRef.current = requestAnimationFrame(tick);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doCashOut]);

  // Start on mount
  useEffect(() => {
    startRound();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize canvas to match container
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Bet actions ──
  const placeBet = () => {
    if (phase !== "waiting") return;
    const amt = parseInt(betInput.replace(/\D/g, ""), 10);
    if (!amt || amt < 100) return;
    if (balance !== null && amt > balance) return;
    betRef.current.placed = true;
    betRef.current.amount = amt;
    betRef.current.cashedOut = false;
    setBetPlaced(true);
    setBalance((prev) => {
      const nb = (prev ?? 0) - amt;
      try { localStorage.setItem("halgo_balance", String(nb)); } catch { /* ignore */ }
      return nb;
    });
  };

  const cancelBet = () => {
    if (phase !== "waiting" || !betRef.current.placed) return;
    const amt = betRef.current.amount;
    betRef.current.placed = false;
    betRef.current.amount = 0;
    setBetPlaced(false);
    setBalance((prev) => (prev ?? 0) + amt);
  };

  const cashOut = () => {
    if (phase !== "flying" || !betRef.current.placed || betRef.current.cashedOut) return;
    doCashOut(multiplier, betRef.current.amount);
  };

  const color = phase === "crashed" ? "#ef4444" : multColor(multiplier);
  const quickAmounts = [500, 1000, 2000, 5000];

  return (
    <div
      className="min-h-dvh flex flex-col select-none"
      style={{ background: "#080f0a", maxWidth: 480, margin: "0 auto" }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: "#0c1610", borderBottom: "1px solid rgba(141,198,63,0.12)" }}
      >
        <button
          onClick={() => setLocation("/app")}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <ArrowLeft style={{ width: 18, height: 18, color: "rgba(255,255,255,0.7)" }} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2">
          <TrendingUp style={{ width: 18, height: 18, color: "#8DC63F" }} />
          <span
            className="font-black tracking-wide"
            style={{ fontSize: "1rem", color: "#fff", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            HALGO <span style={{ color: "#8DC63F" }}>CRASH</span>
          </span>
          <span
            className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase"
            style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            LIVE
          </span>
        </div>

        {/* Balance */}
        <div
          className="flex items-center gap-1.5 px-3 h-8 rounded-full transition-all"
          style={{
            background: balanceFlash ? "rgba(141,198,63,0.15)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${balanceFlash ? "rgba(141,198,63,0.4)" : "rgba(255,255,255,0.1)"}`,
            transition: "all 0.3s",
          }}
        >
          {balance === null ? (
            <div className="w-16 h-3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
          ) : (
            <span className="font-black text-[11px]" style={{ color: balanceFlash ? "#8DC63F" : "#fff" }}>
              {fFC(balance)} <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>FC</span>
            </span>
          )}
        </div>
      </header>

      {/* ── History row ── */}
      <div
        className="flex gap-1.5 px-4 py-2 overflow-x-auto shrink-0"
        style={{ scrollbarWidth: "none", background: "#0b1410" }}
      >
        {history.map((h, i) => {
          const c = h.cp < 2 ? "#ef4444" : h.cp < 5 ? "#facc15" : "#4ade80";
          return (
            <span
              key={i}
              className="shrink-0 text-[10px] font-black px-2.5 py-1 rounded-lg"
              style={{ background: hexToRgba(c, 0.12), color: c, border: `1px solid ${hexToRgba(c, 0.25)}` }}
            >
              {fMult(h.cp)}
            </span>
          );
        })}
      </div>

      {/* ── Canvas area ── */}
      <div
        ref={containerRef}
        className="relative shrink-0"
        style={{ height: 260, background: "#080f0a" }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        {/* Big multiplier overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {phase === "waiting" ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>
                PROCHAIN TOUR DANS
              </span>
              <span
                className="font-black leading-none"
                style={{ fontSize: "3.5rem", color: "#fff", fontFamily: "'Oswald', sans-serif", textShadow: "0 0 40px rgba(255,255,255,0.2)" }}
              >
                {countdown}s
              </span>
              {betPlaced && (
                <span
                  className="text-[11px] font-black px-3 py-1 rounded-full mt-1"
                  style={{ background: "rgba(141,198,63,0.15)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.3)" }}
                >
                  MISE PLACÉE · {fFC(betRef.current.amount)} FC
                </span>
              )}
            </div>
          ) : phase === "crashed" ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(239,68,68,0.7)" }}>
                CRASHÉ À
              </span>
              <span
                className="font-black leading-none"
                style={{ fontSize: "3.5rem", color: "#ef4444", fontFamily: "'Oswald', sans-serif", textShadow: "0 0 40px rgba(239,68,68,0.5)" }}
              >
                {fMult(multiplier)}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span
                className="font-black leading-none"
                style={{
                  fontSize: "3.8rem",
                  color,
                  fontFamily: "'Oswald', sans-serif",
                  textShadow: `0 0 40px ${hexToRgba(color, 0.6)}`,
                  transition: "color 0.3s",
                }}
              >
                {fMult(multiplier)}
              </span>
              {cashedOut && cashoutMult !== null && (
                <span
                  className="text-[11px] font-black px-3 py-1 rounded-full"
                  style={{ background: "rgba(141,198,63,0.15)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.3)" }}
                >
                  ✓ ENCAISSÉ À {fMult(cashoutMult)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Players count */}
        <div
          className="absolute bottom-2 right-3 flex items-center gap-1"
          style={{ opacity: 0.45 }}
        >
          <Users style={{ width: 10, height: 10, color: "#8DC63F" }} />
          <span className="text-[9px] font-bold" style={{ color: "#8DC63F" }}>
            {Math.floor(800 + Math.sin(Date.now() / 5000) * 200)} joueurs
          </span>
        </div>
      </div>

      {/* ── Win banner ── */}
      {phase === "crashed" && betPlaced && cashedOut && winAmount !== null && (
        <div
          className="mx-4 mt-3 px-4 py-3 rounded-2xl flex items-center justify-between shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(141,198,63,0.15), rgba(141,198,63,0.05))",
            border: "1px solid rgba(141,198,63,0.3)",
          }}
        >
          <span className="text-[12px] font-black text-white">🎉 VOUS AVEZ GAGNÉ</span>
          <span className="font-black" style={{ color: "#8DC63F", fontSize: "1.1rem" }}>
            +{fFC(winAmount)} FC
          </span>
        </div>
      )}

      {phase === "crashed" && betPlaced && !cashedOut && (
        <div
          className="mx-4 mt-3 px-4 py-3 rounded-2xl flex items-center justify-between shrink-0"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <span className="text-[12px] font-black" style={{ color: "#ef4444" }}>💸 PERDU</span>
          <span className="font-black text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            -{fFC(betRef.current.amount)} FC
          </span>
        </div>
      )}

      {/* ── Bet Panel ── */}
      <div
        className="mt-3 mx-4 mb-4 rounded-2xl overflow-hidden shrink-0"
        style={{ background: "#0d1d12", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Tabs */}
        <div className="flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div
            className="flex-1 py-2.5 text-center text-[11px] font-black uppercase tracking-wide"
            style={{ color: "#8DC63F", borderBottom: "2px solid #8DC63F" }}
          >
            Mise manuelle
          </div>
          <div
            className="flex-1 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            Auto
          </div>
        </div>

        <div className="px-4 pt-3 pb-4 space-y-3">
          {/* Amount input */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
                Montant (FC)
              </span>
            </div>
            <div
              className="flex items-center rounded-xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <button
                onClick={() => setBetInput((v) => String(Math.max(100, (parseInt(v) || 0) - 500)))}
                disabled={phase === "flying" && betPlaced}
                className="w-10 h-10 flex items-center justify-center font-black text-lg transition-all active:scale-90 disabled:opacity-30"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                −
              </button>
              <input
                type="number"
                value={betInput}
                onChange={(e) => setBetInput(e.target.value)}
                disabled={(phase === "flying" && betPlaced) || betPlaced}
                className="flex-1 bg-transparent text-center font-black text-white outline-none disabled:opacity-50"
                style={{ fontSize: "1rem" }}
                min={100}
              />
              <button
                onClick={() => setBetInput((v) => String((parseInt(v) || 0) + 500))}
                disabled={phase === "flying" && betPlaced}
                className="w-10 h-10 flex items-center justify-center font-black text-lg transition-all active:scale-90 disabled:opacity-30"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                +
              </button>
            </div>
            {/* Quick amounts */}
            <div className="flex gap-1.5 mt-2">
              {quickAmounts.map((a) => (
                <button
                  key={a}
                  onClick={() => setBetInput(String(a))}
                  disabled={betPlaced}
                  className="flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 disabled:opacity-30"
                  style={{ background: "rgba(141,198,63,0.08)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.15)" }}
                >
                  {a >= 1000 ? `${a / 1000}K` : a}
                </button>
              ))}
              {balance && balance > 0 && (
                <button
                  onClick={() => setBetInput(String(Math.floor(balance)))}
                  disabled={betPlaced}
                  className="flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 disabled:opacity-30"
                  style={{ background: "rgba(141,198,63,0.08)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.15)" }}
                >
                  MAX
                </button>
              )}
            </div>
          </div>

          {/* Auto cash-out */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
              Encaissement auto (multiplicateur)
            </span>
            <div
              className="flex items-center rounded-xl mt-1.5 overflow-hidden"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <input
                type="number"
                value={autoCashoutInput}
                onChange={(e) => setAutoCashoutInput(e.target.value)}
                placeholder="ex: 2.00"
                className="flex-1 bg-transparent px-3 h-9 font-bold text-white outline-none text-[13px]"
                step="0.1"
                min="1.1"
              />
              <span className="px-3 text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>×</span>
            </div>
          </div>

          {/* Main action button */}
          {phase === "waiting" && !betPlaced && (
            <button
              onClick={placeBet}
              disabled={!betInput || parseInt(betInput) < 100 || (balance !== null && parseInt(betInput) > balance)}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] transition-all active:scale-[0.97] disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, #1a6b2f, #22a84a)",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(34,168,74,0.35)",
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <Clock style={{ width: 16, height: 16 }} />
                PLACER LA MISE · {fFC(parseInt(betInput) || 0)} FC
              </div>
            </button>
          )}

          {phase === "waiting" && betPlaced && (
            <button
              onClick={cancelBet}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] transition-all active:scale-[0.97]"
              style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              ANNULER LA MISE
            </button>
          )}

          {phase === "flying" && !betPlaced && (
            <button
              disabled
              className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] opacity-30"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
            >
              EN VOL — ATTENDEZ LE PROCHAIN TOUR
            </button>
          )}

          {phase === "flying" && betPlaced && !cashedOut && (
            <button
              onClick={cashOut}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] transition-all active:scale-[0.96]"
              style={{
                background: `linear-gradient(135deg, ${color}cc, ${color}88)`,
                color: "#fff",
                boxShadow: `0 4px 24px ${hexToRgba(color, 0.5)}`,
                animation: "pulse 0.8s ease-in-out infinite",
              }}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span>ENCAISSER — {fMult(multiplier)}</span>
                <span className="text-[10px] font-bold opacity-80">
                  +{fFC(Math.floor((parseInt(betInput) || 0) * multiplier))} FC
                </span>
              </div>
            </button>
          )}

          {phase === "flying" && betPlaced && cashedOut && (
            <button
              disabled
              className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px]"
              style={{ background: "rgba(141,198,63,0.12)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.3)" }}
            >
              ✓ ENCAISSÉ À {cashoutMult !== null ? fMult(cashoutMult) : "--"}
            </button>
          )}

          {phase === "crashed" && (
            <button
              disabled
              className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] opacity-40"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
            >
              <div className="flex items-center justify-center gap-2">
                <Clock style={{ width: 16, height: 16 }} />
                PROCHAIN TOUR DANS {WAIT}s…
              </div>
            </button>
          )}
        </div>
      </div>

      {/* ── How it works ── */}
      <div
        className="mx-4 mb-6 px-4 py-3 rounded-xl"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <p className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
          COMMENT JOUER
        </p>
        <div className="space-y-1">
          {[
            "Placez votre mise avant le décollage",
            "Le multiplicateur monte en continu",
            "Appuyez sur ENCAISSER avant le crash",
            "Plus vous attendez, plus vous gagnez",
          ].map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[9px] font-black rounded-full w-3.5 h-3.5 shrink-0 flex items-center justify-center mt-0.5"
                style={{ background: "rgba(141,198,63,0.2)", color: "#8DC63F" }}>
                {i + 1}
              </span>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
}
