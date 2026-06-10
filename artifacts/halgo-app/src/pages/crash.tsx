import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, TrendingUp, Users, CheckCircle } from "lucide-react";

type Phase = "waiting" | "flying" | "crashed";

interface HistoryEntry { cp: number }
interface FeedEntry { id: string; mult: number; amount: number; ts: number }

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

// ── Shared deterministic crash point ─────────────────────────────────────
// All users get the same crash point for the same round.
// Round layout (30s total):
//   [0 – POST_CRASH_S*1000)  → "prochain match" display (5s)
//   [POST_CRASH_MS – FLIGHT_START_MS) → décollage countdown (10s)
//   [FLIGHT_START_MS – 30000)         → vol / flight
const ROUND_MS = 30000;       // 30s per round slot
const POST_CRASH_S = 5;       // 5s "prochain match" after crash
const WAIT = 10;              // 10s décollage countdown
const POST_CRASH_MS = POST_CRASH_S * 1000;          // 5 000 ms
const FLIGHT_START_MS = POST_CRASH_MS + WAIT * 1000; // 15 000 ms

function seededCrashPoint(roundId: number): number {
  let x = roundId ^ 0xdeadbeef;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b5) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b5) | 0;
  const r = ((x ^ (x >>> 16)) >>> 0) / 0x100000000;
  if (r < 0.04) return 1.0;
  return Math.max(1.01, Math.round((1 / (1 - r)) * 100) / 100);
}

function currentRoundId(): number {
  return Math.floor(Date.now() / ROUND_MS);
}

function msIntoRound(): number {
  return Date.now() % ROUND_MS;
}

// ── Odds: multiplier = e^(K*t) ─────────────────────────────────────────
const K = 0.07;
function tToM(t: number) { return Math.exp(K * t); }
function mToT(m: number) { return Math.log(Math.max(1, m)) / K; }

// ── Player ID from localStorage ────────────────────────────────────────
function getOrCreatePlayerId(): string {
  try {
    const stored = localStorage.getItem("halgo_player_id");
    if (stored) return stored;
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const id = "HG#" + suffix;
    localStorage.setItem("halgo_player_id", id);
    return id;
  } catch { return "HG#????" }
}

// ── Balance from localStorage ──────────────────────────────────────────
function readLocalBalance(): number {
  try {
    const v = localStorage.getItem("halgo_balance");
    return v !== null ? Math.max(0, parseFloat(v)) : 50000;
  } catch { return 50000; }
}
function writeLocalBalance(n: number) {
  try { localStorage.setItem("halgo_balance", String(Math.max(0, Math.round(n)))); } catch { /* ignore */ }
}

// ── Seeded history ──────────────────────────────────────────────────────
const SEED_HISTORY: HistoryEntry[] = [
  { cp: 2.14 }, { cp: 1.03 }, { cp: 8.73 }, { cp: 1.02 }, { cp: 4.55 },
  { cp: 1.22 }, { cp: 15.33 }, { cp: 3.01 }, { cp: 1.55 }, { cp: 6.78 },
];

// ── Fake player names for live feed ────────────────────────────────────
const FAKE_IDS = [
  "User#3821","Player#4477","Joueur#1592","User#8832","Client#2019",
  "Pro#5541","User#7731","VIP#4422","Joueur#9921","Player#3312",
  "User#6614","Joueur#0087","Client#5505","VIP#1199","User#3374",
  "Pro#8823","Player#6609","User#4411","Joueur#7756","Client#8834",
];

// ── Canvas drawing ──────────────────────────────────────────────────────
function drawCurve(canvas: HTMLCanvasElement, elapsed: number, phase: Phase, crashPoint: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#080f0a";
  ctx.fillRect(0, 0, W, H);

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

  // ── Player ID (persistent) ─────────────────────────────────────────
  const [playerId] = useState<string>(() => getOrCreatePlayerId());

  // ── Display state ──────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("waiting");
  const [multiplier, setMultiplier] = useState(1.0);
  const [countdown, setCountdown] = useState(WAIT);
  const [crashCountdown, setCrashCountdown] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>(SEED_HISTORY);
  const [balance, setBalance] = useState<number>(readLocalBalance);
  const [balanceFlash, setBalanceFlash] = useState(false);

  // Bet UI state
  const [betInput, setBetInput] = useState("1000");
  const [autoCashoutInput, setAutoCashoutInput] = useState("");
  const [betPlaced, setBetPlaced] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashoutMult, setCashoutMult] = useState<number | null>(null);
  const [winAmount, setWinAmount] = useState<number | null>(null);

  // Live feed
  const [feed, setFeed] = useState<FeedEntry[]>([]);

  // ── Refs ────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>("waiting");
  const crashPointRef = useRef(2.0);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const betRef = useRef({ placed: false, amount: 0, cashedOut: false, autoCashout: 0 });
  const feedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRoundRef = useRef<number>(currentRoundId());

  useEffect(() => { betRef.current.autoCashout = parseFloat(autoCashoutInput) || 0; }, [autoCashoutInput]);

  // Sync balance to localStorage whenever it changes
  useEffect(() => { writeLocalBalance(balance); }, [balance]);

  // Resize canvas
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

  // ── Cash-out handler ────────────────────────────────────────────────
  const doCashOut = useCallback((atMult: number, betAmount: number) => {
    if (betRef.current.cashedOut) return;
    betRef.current.cashedOut = true;
    const won = Math.floor(betAmount * atMult);
    setCashedOut(true);
    setCashoutMult(atMult);
    setWinAmount(won);
    setBalance((prev) => {
      const nb = prev + won;
      writeLocalBalance(nb);
      return nb;
    });
    setBalanceFlash(true);
    setTimeout(() => setBalanceFlash(false), 600);
  }, []);

  // ── Fake live feed during flying phase ─────────────────────────────
  const startFeed = useCallback((cp: number) => {
    if (feedTimerRef.current) clearInterval(feedTimerRef.current);
    const activePlayers = [...FAKE_IDS].sort(() => Math.random() - 0.5).slice(0, 8);
    let idx = 0;
    feedTimerRef.current = setInterval(() => {
      if (idx >= activePlayers.length) { clearInterval(feedTimerRef.current!); return; }
      const mult = parseFloat((1.1 + Math.random() * Math.min(cp - 1.1, 3.5)).toFixed(2));
      const amount = [500, 1000, 2000, 5000, 10000][Math.floor(Math.random() * 5)];
      const entry: FeedEntry = {
        id: activePlayers[idx],
        mult,
        amount: Math.floor(amount * mult),
        ts: Date.now(),
      };
      setFeed((prev) => [entry, ...prev].slice(0, 6));
      idx++;
    }, 800 + Math.random() * 600);
  }, []);

  const stopFeed = useCallback(() => {
    if (feedTimerRef.current) { clearInterval(feedTimerRef.current); feedTimerRef.current = null; }
  }, []);

  // ── Game loop ────────────────────────────────────────────────────────
  const startRound = useCallback((roundId: number) => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    stopFeed();

    const cp = seededCrashPoint(roundId);
    crashPointRef.current = cp;
    currentRoundRef.current = roundId;
    phaseRef.current = "waiting";
    betRef.current = { placed: false, amount: 0, cashedOut: false, autoCashout: betRef.current.autoCashout };

    setPhase("waiting");
    setMultiplier(1.0);
    setBetPlaced(false);
    setCashedOut(false);
    setCashoutMult(null);
    setWinAmount(null);
    setFeed([]);

    const canvas = canvasRef.current;
    if (canvas) drawCurve(canvas, 0, "waiting", cp);

    // ── Determine current phase based on global round clock ────────────────
    // Round layout: [0-5s] prochain match | [5-15s] décollage | [15-30s] vol
    const msInto = msIntoRound();

    if (msInto >= FLIGHT_START_MS) {
      // Already in flight — fast-forward to current position
      launchFlight(msInto - FLIGHT_START_MS);
    } else if (msInto >= POST_CRASH_MS) {
      // In décollage / waiting phase — show remaining countdown
      const waitElapsedMs = msInto - POST_CRASH_MS;
      const waitLeft = Math.ceil((WAIT * 1000 - waitElapsedMs) / 1000);
      setCountdown(Math.max(1, waitLeft));
      let remaining = waitLeft;
      const cdInterval = setInterval(() => {
        remaining -= 1;
        setCountdown(Math.max(0, remaining));
        if (remaining <= 0) {
          clearInterval(cdInterval);
          launchFlight(0);
        }
      }, 1000);
    } else {
      // In post-crash phase (0-5s of round) — show "prochain match" countdown
      // then transition to décollage
      phaseRef.current = "crashed";
      setPhase("crashed");
      const postLeft = Math.ceil((POST_CRASH_MS - msInto) / 1000);
      setCrashCountdown(Math.max(1, postLeft));
      let postRemaining = postLeft;
      const cdPost = setInterval(() => {
        postRemaining -= 1;
        setCrashCountdown(Math.max(0, postRemaining));
        if (postRemaining <= 0) {
          clearInterval(cdPost);
          // Begin décollage
          phaseRef.current = "waiting";
          setPhase("waiting");
          setMultiplier(1.0);
          if (canvas) drawCurve(canvas, 0, "waiting", cp);
          let waitRemaining = WAIT;
          setCountdown(waitRemaining);
          const cdWait = setInterval(() => {
            waitRemaining -= 1;
            setCountdown(Math.max(0, waitRemaining));
            if (waitRemaining <= 0) {
              clearInterval(cdWait);
              launchFlight(0);
            }
          }, 1000);
        }
      }, 1000);
    }

    function launchFlight(skipMs: number) {
      phaseRef.current = "flying";
      setPhase("flying");
      // Fast-forward: subtract already-elapsed flight time so multiplier is correct on refresh
      startTimeRef.current = performance.now() - skipMs;
      startFeed(cp);

      function tick(now: number) {
        const elapsed = (now - startTimeRef.current) / 1000;
        const m = tToM(elapsed);
        setMultiplier(m);

        const c = canvasRef.current;
        if (c) drawCurve(c, elapsed, "flying", crashPointRef.current);

        // Auto cash out
        const autoAt = betRef.current.autoCashout;
        if (betRef.current.placed && !betRef.current.cashedOut && autoAt > 1.0 && m >= autoAt) {
          doCashOut(parseFloat(m.toFixed(2)), betRef.current.amount);
        }

        // Check crash
        if (m >= crashPointRef.current) {
          const finalM = parseFloat(crashPointRef.current.toFixed(2));
          setMultiplier(finalM);
          phaseRef.current = "crashed";
          setPhase("crashed");
          stopFeed();
          if (c) drawCurve(c, mToT(finalM), "crashed", finalM);
          setHistory((h) => [{ cp: finalM }, ...h].slice(0, 12));

          // 5s countdown → next round
          setCrashCountdown(POST_CRASH_S);
          let remaining = POST_CRASH_S;
          const cdPostCrash = setInterval(() => {
            remaining -= 1;
            setCrashCountdown(Math.max(0, remaining));
            if (remaining <= 0) {
              clearInterval(cdPostCrash);
              startRound(currentRoundId());
            }
          }, 1000);
          return;
        }

        rafRef.current = requestAnimationFrame(tick);
      }

      rafRef.current = requestAnimationFrame(tick);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doCashOut, startFeed, stopFeed]);

  // Start on mount — sync to global round clock (startRound handles all 3 phases)
  useEffect(() => {
    startRound(currentRoundId());
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopFeed();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Bet actions ─────────────────────────────────────────────────────
  const placeBet = () => {
    if (phase !== "waiting") return;
    const amt = parseInt(betInput.replace(/\D/g, ""), 10);
    if (!amt || amt < 100) return;
    if (amt > balance) return;
    betRef.current.placed = true;
    betRef.current.amount = amt;
    betRef.current.cashedOut = false;
    setBetPlaced(true);
    setBalance((prev) => {
      const nb = prev - amt;
      writeLocalBalance(nb);
      return nb;
    });
  };

  const cancelBet = () => {
    if (phase !== "waiting" || !betRef.current.placed) return;
    const amt = betRef.current.amount;
    betRef.current.placed = false;
    betRef.current.amount = 0;
    setBetPlaced(false);
    setBalance((prev) => {
      writeLocalBalance(prev + amt);
      return prev + amt;
    });
  };

  const cashOut = () => {
    if (phase !== "flying" || !betRef.current.placed || betRef.current.cashedOut) return;
    doCashOut(parseFloat(multiplier.toFixed(2)), betRef.current.amount);
  };

  const color = phase === "crashed" ? "#ef4444" : multColor(multiplier);
  const quickAmounts = [500, 1000, 2000, 5000];
  const betAmt = parseInt(betInput) || 0;
  const canBet = betAmt >= 100 && betAmt <= balance;

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

        <div className="flex items-center gap-2">
          <TrendingUp style={{ width: 18, height: 18, color: "#8DC63F" }} />
          <span className="font-black tracking-wide" style={{ fontSize: "1rem", color: "#fff" }}>
            HALGO <span style={{ color: "#8DC63F" }}>CRASH</span>
          </span>
          <span
            className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase"
            style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            LIVE
          </span>
        </div>

        <div className="flex flex-col items-end gap-0.5">
          <div
            className="flex items-center gap-1.5 px-3 h-8 rounded-full transition-all"
            style={{
              background: balanceFlash ? "rgba(141,198,63,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${balanceFlash ? "rgba(141,198,63,0.4)" : "rgba(255,255,255,0.1)"}`,
              transition: "all 0.3s",
            }}
          >
            <span className="font-black text-[11px]" style={{ color: balanceFlash ? "#8DC63F" : "#fff" }}>
              {fFC(balance)} <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>FC</span>
            </span>
          </div>
          <span className="text-[9px] font-black tracking-wide" style={{ color: "rgba(141,198,63,0.6)" }}>
            {playerId}
          </span>
        </div>
      </header>

      {/* ── Canvas area ── */}
      <div
        ref={containerRef}
        className="relative shrink-0"
        style={{ height: 240, background: "#080f0a" }}
      >
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />

        {/* Big multiplier overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {phase === "waiting" ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>
                DÉCOLLAGE DANS
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
                  MISE · {fFC(betRef.current.amount)} FC
                </span>
              )}
            </div>
          ) : phase === "crashed" ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(239,68,68,0.7)" }}>CRASHÉ À</span>
              <span
                className="font-black leading-none"
                style={{ fontSize: "3.5rem", color: "#ef4444", fontFamily: "'Oswald', sans-serif", textShadow: "0 0 40px rgba(239,68,68,0.5)" }}
              >
                {fMult(multiplier)}
              </span>
              <span className="text-[11px] font-bold px-3 py-1 rounded-full mt-1" style={{ background: "rgba(239,68,68,0.12)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(239,68,68,0.2)" }}>
                Prochain match dans {crashCountdown}s
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

        {/* Players count — only during flight */}
        {phase === "flying" && (
          <div className="absolute bottom-2 right-3 flex items-center gap-1" style={{ opacity: 0.5 }}>
            <Users style={{ width: 10, height: 10, color: "#8DC63F" }} />
            <span className="text-[9px] font-bold" style={{ color: "#8DC63F" }}>
              {Math.floor(620 + Math.sin(Date.now() / 4000) * 180)} joueurs
            </span>
          </div>
        )}

        {/* ── ARRÊTER button — overlaid at bottom of canvas, above history ── */}
        {phase === "flying" && betPlaced && !cashedOut && (
          <button
            onClick={cashOut}
            className="absolute bottom-3 left-3 right-3 py-3 rounded-2xl font-black uppercase tracking-wide text-[14px] transition-all active:scale-[0.97] flex items-center justify-center gap-3"
            style={{
              background: `linear-gradient(135deg,${color}dd,${color}99)`,
              color: "#fff",
              boxShadow: `0 4px 20px ${hexToRgba(color, 0.55)}`,
              animation: "crashPulse 0.7s ease-in-out infinite",
            }}
          >
            <span>🛑 ARRÊTER — {fMult(multiplier)}</span>
            <span className="text-[12px] font-bold opacity-90">· +{fFC(Math.floor(betAmt * multiplier))} FC</span>
          </button>
        )}

        {/* Cashed-out badge in canvas */}
        {phase === "flying" && betPlaced && cashedOut && cashoutMult !== null && (
          <div
            className="absolute bottom-3 left-3 right-3 py-2.5 rounded-2xl font-black uppercase tracking-wide text-[13px] flex items-center justify-center gap-2"
            style={{ background: "rgba(141,198,63,0.18)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.35)" }}
          >
            ✓ ENCAISSÉ À {fMult(cashoutMult)} · +{fFC(Math.floor(betRef.current.amount * cashoutMult))} FC
          </div>
        )}
      </div>

      {/* ── Match history row (moved here so players see it before deciding) ── */}
      <div
        className="flex items-center gap-2 px-4 py-2 shrink-0"
        style={{ background: "#0b1410", borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <span className="text-[9px] font-black uppercase tracking-widest shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
          Historique
        </span>
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
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
      </div>

      {/* ── Win / Loss banner ── */}
      {phase === "crashed" && betPlaced && cashedOut && winAmount !== null && (
        <div
          className="mx-4 mt-2 px-4 py-3 rounded-2xl flex items-center justify-between shrink-0"
          style={{ background: "linear-gradient(135deg,rgba(141,198,63,0.15),rgba(141,198,63,0.05))", border: "1px solid rgba(141,198,63,0.3)" }}
        >
          <span className="text-[12px] font-black text-white flex items-center gap-1.5">
            <CheckCircle style={{ width: 14, height: 14, color: "#8DC63F" }} />
            VOUS AVEZ GAGNÉ
          </span>
          <span className="font-black" style={{ color: "#8DC63F", fontSize: "1.1rem" }}>+{fFC(winAmount)} FC</span>
        </div>
      )}

      {phase === "crashed" && betPlaced && !cashedOut && (
        <div
          className="mx-4 mt-2 px-4 py-3 rounded-2xl flex items-center justify-between shrink-0"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <span className="text-[12px] font-black" style={{ color: "#ef4444" }}>💸 PERDU</span>
          <span className="font-black text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            -{fFC(betRef.current.amount)} FC
          </span>
        </div>
      )}

      {/* ── Bet Panel ── */}
      <div
        className="mt-2 mx-4 mb-4 rounded-2xl overflow-hidden shrink-0"
        style={{ background: "#0d1d12", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex-1 py-2.5 text-center text-[11px] font-black uppercase tracking-wide" style={{ color: "#8DC63F", borderBottom: "2px solid #8DC63F" }}>
            Mise manuelle
          </div>
          <div className="flex-1 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>
            Auto
          </div>
        </div>

        <div className="px-4 pt-3 pb-4 space-y-3">
          {/* Amount input */}
          <div>
            <div
              className="flex items-center rounded-xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <button
                onClick={() => setBetInput((v) => String(Math.max(100, (parseInt(v) || 0) - 500)))}
                disabled={betPlaced}
                className="w-10 h-10 flex items-center justify-center font-black text-lg transition-all active:scale-90 disabled:opacity-30"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >−</button>
              <input
                type="number"
                value={betInput}
                onChange={(e) => setBetInput(e.target.value)}
                disabled={betPlaced}
                className="flex-1 bg-transparent text-center font-black text-white outline-none disabled:opacity-50"
                style={{ fontSize: "1rem" }}
                min={100}
              />
              <button
                onClick={() => setBetInput((v) => String((parseInt(v) || 0) + 500))}
                disabled={betPlaced}
                className="w-10 h-10 flex items-center justify-center font-black text-lg transition-all active:scale-90 disabled:opacity-30"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >+</button>
            </div>
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
              {balance > 0 && (
                <button
                  onClick={() => setBetInput(String(Math.floor(balance)))}
                  disabled={betPlaced}
                  className="flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 disabled:opacity-30"
                  style={{ background: "rgba(141,198,63,0.08)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.15)" }}
                >MAX</button>
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
                onChange={(e) => {
                  setAutoCashoutInput(e.target.value);
                  betRef.current.autoCashout = parseFloat(e.target.value) || 0;
                }}
                placeholder="ex: 2.00"
                className="flex-1 bg-transparent px-3 h-9 font-bold text-white outline-none text-[13px]"
                step="0.1"
                min="1.1"
              />
              <span className="px-3 text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>×</span>
            </div>
          </div>

          {/* ── Main action button ── */}

          {/* WAITING + no bet */}
          {phase === "waiting" && !betPlaced && (
            <button
              onClick={placeBet}
              disabled={!canBet}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] transition-all active:scale-[0.97] disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#1a6b2f,#22a84a)", color: "#fff", boxShadow: "0 4px 20px rgba(34,168,74,0.35)" }}
            >
              PLACER LA MISE · {fFC(betAmt)} FC
            </button>
          )}

          {/* WAITING + bet placed */}
          {phase === "waiting" && betPlaced && (
            <button
              onClick={cancelBet}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] transition-all active:scale-[0.97]"
              style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              ✕ ANNULER LA MISE
            </button>
          )}

          {/* FLYING + no bet */}
          {phase === "flying" && !betPlaced && (
            <button disabled className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] opacity-30"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
              EN VOL — ATTENDEZ LE PROCHAIN TOUR
            </button>
          )}

          {/* FLYING + bet + not cashed out → ARRÊTER button is in the canvas above */}
          {phase === "flying" && betPlaced && !cashedOut && (
            <div className="w-full py-3 rounded-2xl text-center text-[12px] font-bold"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" }}>
              ↑ Appuyez sur ARRÊTER pour encaisser
            </div>
          )}

          {/* FLYING + bet + cashed out */}
          {phase === "flying" && betPlaced && cashedOut && (
            <button disabled className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px]"
              style={{ background: "rgba(141,198,63,0.12)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.3)" }}>
              ✓ ENCAISSÉ À {cashoutMult !== null ? fMult(cashoutMult) : "--"}
            </button>
          )}

          {/* CRASHED */}
          {phase === "crashed" && (
            <button disabled className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] opacity-40"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
              PROCHAIN DÉCOLLAGE DANS {crashCountdown}s…
            </button>
          )}
        </div>
      </div>

      {/* ── Live cashout feed — bottom of page so it never pushes controls ── */}
      {feed.length > 0 && (
        <div
          className="mx-4 mt-2 mb-2 px-3 py-2 rounded-xl shrink-0 space-y-1 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {feed.slice(0, 5).map((entry) => (
            <div key={entry.ts} className="flex items-center justify-between gap-2 animate-slide-in">
              <span className="text-[10px] font-bold truncate flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", flexShrink: 0, display: "inline-block" }} />
                {entry.id}
              </span>
              <span className="text-[10px] font-black shrink-0" style={{ color: multColor(entry.mult) }}>
                encaissé à {fMult(entry.mult)}
              </span>
              <span className="text-[10px] font-bold shrink-0 text-white">
                +{fFC(entry.amount)} FC
              </span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes crashPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 24px rgba(74,222,128,0.4); }
          50% { transform: scale(1.015); box-shadow: 0 6px 32px rgba(74,222,128,0.65); }
        }
        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
