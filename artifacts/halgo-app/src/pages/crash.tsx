import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, TrendingUp, CheckCircle, Ticket } from "lucide-react";
import { useUser, useAuth } from "@clerk/react";

type Phase = "waiting" | "flying" | "crashed";

interface HistoryEntry { cp: number }
interface FeedEntry { id: string; mult: number; amount: number; ts: number; key: number }
interface BetEntry  { id: string; amount: number; ts: number; key: number }

function fFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/[\u00a0\s]/g, " ");
}
function fMult(m: number) { return m.toFixed(2) + "×"; }

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lerpHex(c0: [number,number,number], c1: [number,number,number], t: number): string {
  const r = Math.round(c0[0] + t * (c1[0] - c0[0]));
  const g = Math.round(c0[1] + t * (c1[1] - c0[1]));
  const b = Math.round(c0[2] + t * (c1[2] - c0[2]));
  return `rgb(${r},${g},${b})`;
}
const COLOR_STOPS: Array<[number, [number,number,number]]> = [
  [1.0,  [74,  222, 128]],
  [2.0,  [163, 230,  53]],
  [4.0,  [250, 204,  21]],
  [7.0,  [251, 146,  60]],
  [12.0, [239,  68,  68]],
  [25.0, [168,  85, 247]],
  [60.0, [236,  72, 153]],
];
function multColor(m: number): string {
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [m0, c0] = COLOR_STOPS[i];
    const [m1, c1] = COLOR_STOPS[i + 1];
    if (m <= m1) return lerpHex(c0, c1, Math.max(0, (m - m0) / (m1 - m0)));
  }
  return `rgb(${COLOR_STOPS[COLOR_STOPS.length - 1][1].join(",")})`;
}

function histColor(cp: number): string {
  if (cp < 1.5) return "#ef4444";
  if (cp < 2.0) return "#f97316";
  if (cp < 4.0) return "#facc15";
  if (cp < 8.0) return "#4ade80";
  if (cp < 20.0) return "#38bdf8";
  if (cp < 50.0) return "#a855f7";
  return "#ec4899";
}

// ── Canvas-drawn rocket ──────────────────────────────────────────────────────
function drawRocket(ctx: CanvasRenderingContext2D, accentColor: string, m: number, now: number) {
  const s = 11;
  const flameIntensity = Math.min(1 + m / 8, 4.5);
  const flameLen = s * flameIntensity;
  const flicker = Math.sin(now / 60) * 0.15 + Math.cos(now / 43) * 0.1;

  const outerFlame = ctx.createLinearGradient(-s * 0.3, 0, -s * 0.3 - flameLen * 1.4, 0);
  outerFlame.addColorStop(0, "rgba(255,180,30,0.0)");
  outerFlame.addColorStop(0.05, "rgba(255,180,30,0.5)");
  outerFlame.addColorStop(0.5, "rgba(255,80,10,0.25)");
  outerFlame.addColorStop(1, "rgba(255,40,0,0)");
  ctx.beginPath();
  ctx.moveTo(-s * 0.25, s * 0.5 * (1 + flicker));
  ctx.quadraticCurveTo(-s * 0.3 - flameLen * 0.7, s * 0.18 * (1 + flicker), -s * 0.3 - flameLen * 1.4, 0);
  ctx.quadraticCurveTo(-s * 0.3 - flameLen * 0.7, -s * 0.18 * (1 + flicker), -s * 0.25, -s * 0.5 * (1 + flicker));
  ctx.fillStyle = outerFlame;
  ctx.fill();

  const innerFlame = ctx.createLinearGradient(-s * 0.2, 0, -s * 0.2 - flameLen, 0);
  innerFlame.addColorStop(0, "rgba(255,240,120,0.95)");
  innerFlame.addColorStop(0.2, "rgba(255,150,30,0.85)");
  innerFlame.addColorStop(0.6, "rgba(255,60,10,0.4)");
  innerFlame.addColorStop(1, "rgba(255,30,0,0)");
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, s * 0.28 * (1 + flicker * 0.5));
  ctx.quadraticCurveTo(-s * 0.2 - flameLen * 0.5, s * 0.08, -s * 0.2 - flameLen, 0);
  ctx.quadraticCurveTo(-s * 0.2 - flameLen * 0.5, -s * 0.08, -s * 0.2, -s * 0.28 * (1 + flicker * 0.5));
  ctx.fillStyle = innerFlame;
  ctx.fill();

  ctx.fillStyle = accentColor;
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, sign * s * 0.32);
    ctx.lineTo(-s * 0.38, sign * s * 0.72);
    ctx.lineTo(-s * 0.22, sign * s * 0.32);
    ctx.closePath();
    ctx.fill();
  }

  const bodyGrd = ctx.createLinearGradient(0, -s * 0.38, 0, s * 0.38);
  bodyGrd.addColorStop(0, "rgba(230,248,255,1)");
  bodyGrd.addColorStop(0.4, "rgba(185,220,245,0.95)");
  bodyGrd.addColorStop(1, "rgba(130,175,215,0.88)");
  ctx.beginPath();
  ctx.moveTo(s * 0.9, 0);
  ctx.bezierCurveTo(s * 0.65, -s * 0.32, s * 0.1, -s * 0.38, -s * 0.18, -s * 0.33);
  ctx.lineTo(-s * 0.22, -s * 0.33);
  ctx.lineTo(-s * 0.22, s * 0.33);
  ctx.lineTo(-s * 0.18, s * 0.33);
  ctx.bezierCurveTo(s * 0.1, s * 0.38, s * 0.65, s * 0.32, s * 0.9, 0);
  ctx.closePath();
  ctx.fillStyle = bodyGrd;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(s * 0.38, 0, s * 0.16, 0, Math.PI * 2);
  const winGrd = ctx.createRadialGradient(s * 0.34, -s * 0.05, 0, s * 0.38, 0, s * 0.16);
  winGrd.addColorStop(0, "rgba(200,240,255,1)");
  winGrd.addColorStop(0.6, "rgba(80,180,230,0.9)");
  winGrd.addColorStop(1, "rgba(30,120,200,0.7)");
  ctx.fillStyle = winGrd;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  r: number;
  color: [number,number,number];
}

// ── Round timing ─────────────────────────────────────────────────────────────
// After crash: 2s crash display → 10s betting window → fly
const ROUND_MS       = 30000;
const CRASH_SHOW_S   = 2;      // how long crash result is shown
const BET_WINDOW_S   = 15;     // betting countdown
const FLIGHT_START_MS = (CRASH_SHOW_S + BET_WINDOW_S) * 1000; // 17 000 ms

function currentRoundId(): number {
  return Math.floor(Date.now() / ROUND_MS);
}
function msIntoRound(): number {
  return Date.now() % ROUND_MS;
}

const K = 0.07;
function tToM(t: number) { return Math.exp(K * t); }
function mToT(m: number) { return Math.log(Math.max(1, m)) / K; }

// ── Player ID ────────────────────────────────────────────────────────────────
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

function readCachedBalance(userId: string): number {
  try { const v = localStorage.getItem(`halgo_balance_${userId}`); return v !== null ? Math.max(0, parseFloat(v)) : 0; }
  catch { return 0; }
}
function writeCachedBalance(userId: string, n: number) {
  try { localStorage.setItem(`halgo_balance_${userId}`, String(Math.max(0, Math.round(n)))); } catch { /* ignore */ }
}

// ── Unique feed ID generator — format ID:145-96F ─────────────────────────────
let _feedIdSeq = 0;
function generateFeedId(): string {
  _feedIdSeq++;
  const n1 = 100 + ((_feedIdSeq * 1031 + 397) % 900);
  const n2 = 10  + ((_feedIdSeq * 719  + 83)  % 90);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const letter = letters[(_feedIdSeq * 13 + 7) % letters.length];
  return `ID:${n1}-${n2}${letter}`;
}


// Bet amounts pool for simulated players
const SIM_BETS = [200, 500, 1000, 2000, 5000, 10000];

// ── Canvas drawing ───────────────────────────────────────────────────────────
function drawCurve(
  canvas: HTMLCanvasElement,
  elapsed: number,
  phase: Phase,
  crashPoint: number,
  lastFlightColor: string,
  particles: Particle[],
  now: number,
): [number, number] | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#080f0a";
  ctx.fillRect(0, 0, W, H);

  if (elapsed <= 0 && phase !== "crashed") {
    ctx.strokeStyle = "rgba(141,198,63,0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 7; i++) { const x = (W*i)/7; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let i = 1; i < 5; i++) { const y = (H*i)/5; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    return null;
  }

  const curM = phase === "crashed" ? crashPoint : tToM(elapsed);
  // Keep the flight colour — never switch to red on crash
  const color = phase === "crashed" ? lastFlightColor : multColor(curM);
  const glowIntensity = Math.min(1 + (curM - 1) / 9, 5);

  if (curM >= 4 && phase === "flying") {
    const edgeAlpha = Math.min((curM - 4) / 30, 0.18);
    const edge = ctx.createRadialGradient(W/2, H, 0, W/2, H, W * 0.9);
    edge.addColorStop(0, `rgba(0,0,0,0)`);
    edge.addColorStop(0.7, `rgba(0,0,0,0)`);
    edge.addColorStop(1, color.replace("rgb", "rgba").replace(")", `,${edgeAlpha})`));
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);
  }

  const gridAlpha = phase === "flying" ? Math.max(0.03, 0.08 - (curM - 1) * 0.003) : 0.06;
  ctx.strokeStyle = `rgba(141,198,63,${gridAlpha})`;
  ctx.lineWidth = 1;
  for (let i = 1; i < 7; i++) { const x = (W*i)/7; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let i = 1; i < 5; i++) { const y = (H*i)/5; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  const maxElapsed = phase === "crashed" ? mToT(crashPoint) : elapsed;
  const windowSec  = Math.max(18, maxElapsed * 1.25);
  const startT     = Math.max(0, maxElapsed - windowSec);
  const marginL    = 24;
  const usableW    = W - marginL - 16;
  const usableH    = H - 40;
  const maxM       = Math.max(crashPoint * 1.3, 2.5);

  const tx = (t: number) => marginL + ((t - startT) / windowSec) * usableW;
  const my = (m: number) => {
    const logScale = Math.log(Math.max(1.001, m)) / Math.log(Math.max(1.001, maxM));
    return usableH - logScale * (usableH - 16);
  };

  const STEPS = 120;
  const pts: [number, number][] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * maxElapsed;
    pts.push([tx(t), my(tToM(t))]);
  }
  if (pts.length < 2) return null;

  const [lx, ly] = pts[pts.length - 1];

  ctx.beginPath();
  ctx.moveTo(pts[0][0], usableH);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(lx, usableH);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, 0, 0, usableH);
  const fillAlpha = Math.min(0.12 + glowIntensity * 0.04, 0.32);
  fill.addColorStop(0, color.replace("rgb", "rgba").replace(")", `,${fillAlpha})`));
  fill.addColorStop(1, color.replace("rgb", "rgba").replace(")", ",0.01)"));
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.lineWidth = 2.5 + glowIntensity * 0.4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const shadowBlur = Math.min(8 + glowIntensity * 6, 40);
  ctx.shadowColor = color;
  ctx.shadowBlur = shadowBlur;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.shadowBlur = 0;

  for (const p of particles) {
    const ratio = p.life / p.maxLife;
    const alpha = ratio * 0.7;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * ratio, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${alpha})`;
    ctx.fill();
  }

  ctx.save();
  ctx.translate(lx, ly);
  if (phase === "flying" && pts.length >= 2) {
    const [px, py] = pts[pts.length - 2];
    const angle = Math.atan2(ly - py, lx - px);
    ctx.rotate(angle);
    if (curM >= 3) {
      const haloR = 22 + glowIntensity * 8;
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, haloR);
      halo.addColorStop(0, color.replace("rgb", "rgba").replace(")", `,${Math.min(0.35, glowIntensity * 0.06)})`));
      halo.addColorStop(1, color.replace("rgb", "rgba").replace(")", ",0)"));
      ctx.beginPath(); ctx.arc(0, 0, haloR, 0, Math.PI * 2);
      ctx.fillStyle = halo; ctx.fill();
    }
    drawRocket(ctx, color, curM, now);
  } else if (phase === "crashed") {
    const rings = [0.9, 0.65, 0.4];
    for (const s of rings) {
      const rr = 28 * s;
      const expl = ctx.createRadialGradient(0, -8, 0, 0, -8, rr);
      expl.addColorStop(0, `rgba(255,200,50,${s * 0.8})`);
      expl.addColorStop(0.4, `rgba(255,80,10,${s * 0.5})`);
      expl.addColorStop(1, `rgba(200,20,0,0)`);
      ctx.beginPath(); ctx.arc(0, -8, rr, 0, Math.PI * 2);
      ctx.fillStyle = expl; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, -8, 7, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,200,0.95)"; ctx.fill();
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
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(marginL - 4, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  return [lx, ly];
}

// ── Server-sent event payload shape ──────────────────────────────────────────
interface CrashStreamEvent {
  phase: "show" | "betting" | "flying";
  roundId: number;
  msIntoRound: number;
  serverMs: number;
  crashPoint?: number;      // only during "flying"
  prevCrashPoint?: number;  // only during "show" (last round's result)
}

// ── Main component ───────────────────────────────────────────────────────────
export default function CrashGame() {
  const [, setLocation] = useLocation();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();

  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = await getToken().catch(() => null);
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string> | undefined ?? {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...options, headers, credentials: "include" });
  }, [getToken]);

  const [playerId] = useState<string>(() => getOrCreatePlayerId());

  const [syncing, setSyncing]           = useState(true);
  const [phase, setPhase]               = useState<Phase>("waiting");
  const [multiplier, setMultiplier]     = useState(1.0);
  const [countdown, setCountdown]       = useState(BET_WINDOW_S);
  const [history, setHistory]           = useState<HistoryEntry[]>([]);
  const [balance, setBalance]           = useState<number>(0);
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const [balanceFlash, setBalanceFlash] = useState(false);

  const [activeTab, setActiveTab]       = useState<"manual" | "auto">("manual");
  const [betInput, setBetInput]         = useState("1000");
  const [autoCashoutInput, setAutoCashoutInput] = useState("");
  const [autoBetEnabled, setAutoBetEnabled] = useState(false);
  const [autoBetAmountInput, setAutoBetAmountInput] = useState("1000");
  const [autoBetPlacing, setAutoBetPlacing] = useState(false);
  const [betPlaced, setBetPlaced]       = useState(false);
  const [cashedOut, setCashedOut]       = useState(false);
  const [cashoutMult, setCashoutMult]   = useState<number | null>(null);
  const [winAmount, setWinAmount]       = useState<number | null>(null);
  const [halfCashedOut, setHalfCashedOut]   = useState(false);
  const [halfCashoutMult, setHalfCashoutMult] = useState<number | null>(null);
  const [halfWonAmount, setHalfWonAmount]   = useState<number | null>(null);

  const [feed, setFeed]                 = useState<FeedEntry[]>([]);
  const [bettingFeed, setBettingFeed]   = useState<BetEntry[]>([]);

  const canvasRef         = useRef<HTMLCanvasElement>(null);
  const containerRef      = useRef<HTMLDivElement>(null);
  const feedScrollRef     = useRef<HTMLDivElement>(null);
  const phaseRef          = useRef<Phase>("waiting");
  const crashPointRef     = useRef(2.0);
  const startTimeRef      = useRef<number>(0);
  const rafRef            = useRef<number | null>(null);
  const betRef            = useRef({ placed: false, amount: 0, cashedOut: false, autoCashout: 0, halfCashedOut: false });
  const currentRoundRef   = useRef<number>(currentRoundId());
  const particlesRef      = useRef<Particle[]>([]);
  const lastParticleRef   = useRef<number>(0);
  const lastTipRef        = useRef<[number, number]>([0, 0]);
  const lastFlightColorRef = useRef<string>("rgb(74,222,128)");
  const feedTickerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bettingTickerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundGenRef       = useRef(0);
  const feedKeyRef        = useRef(0);
  const multiplierRef     = useRef<number>(1.0);
  const autoBetEnabledRef = useRef<boolean>(false);
  const autoBetAmountRef  = useRef<number>(1000);

  useEffect(() => { betRef.current.autoCashout = parseFloat(autoCashoutInput) || 0; }, [autoCashoutInput]);
  useEffect(() => { autoBetEnabledRef.current = autoBetEnabled; }, [autoBetEnabled]);
  useEffect(() => { autoBetAmountRef.current = parseInt(autoBetAmountInput.replace(/\D/g, ""), 10) || 0; }, [autoBetAmountInput]);

  // ── Load balance ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    if (user?.id) {
      const cached = readCachedBalance(user.id);
      if (cached > 0) setBalance(cached);
    }
    authFetch("/api/auth/balance")
      .then(r => r.ok ? r.json() : null)
      .then((d: { balance: number } | null) => {
        if (d !== null) {
          const bal = Math.max(0, d.balance);
          setBalance(bal);
          if (user?.id) writeCachedBalance(user.id, bal);
        }
        setBalanceLoaded(true);
      })
      .catch(() => { setBalanceLoaded(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // ── Load real crash history from server on mount ───────────────────────────
  useEffect(() => {
    fetch("/api/crash/history")
      .then(r => r.ok ? r.json() as Promise<{ history: number[] }> : null)
      .then(d => {
        if (d?.history?.length) {
          setHistory(d.history.map(cp => ({ cp })));
        }
      })
      .catch(() => {});
  }, []);

  // ── Resize canvas ─────────────────────────────────────────────────────────
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

  // ── Flight feed ticker — runs only during "flying" phase ─────────────────
  const scheduleFeedTick = useCallback(() => {
    feedTickerRef.current = setTimeout(() => {
      if (phaseRef.current === "flying") {
        feedKeyRef.current += 1;
        const id = generateFeedId();
        const curMult  = multiplierRef.current;
        const cp = crashPointRef.current;
        // Never exceed crash point — would reveal the simulation
        const maxPossible = Math.min(cp - 0.01, Math.max(1.05, curMult - 0.05));
        if (maxPossible < 1.05) { scheduleFeedTick(); return; }
        const range = Math.max(0.05, maxPossible - 1.05);
        const mult  = parseFloat((1.05 + Math.random() * range).toFixed(2));
        const bet   = SIM_BETS[Math.floor(Math.random() * SIM_BETS.length)];
        const entry: FeedEntry = { id, mult, amount: Math.floor(bet * mult), ts: Date.now(), key: feedKeyRef.current };
        setFeed(prev => [entry, ...prev].slice(0, 18));
        scheduleFeedTick();
      }
      // else: stop — will be restarted by launchFlight
    }, 900 + Math.random() * 900);
  }, []);

  // ── Betting simulation ticker — runs only during "waiting" phase ──────────
  const scheduleBettingTick = useCallback(() => {
    bettingTickerRef.current = setTimeout(() => {
      if (phaseRef.current !== "waiting") return;
      feedKeyRef.current += 1;
      const id = generateFeedId();
      const bet = SIM_BETS[Math.floor(Math.random() * SIM_BETS.length)];
      setBettingFeed(prev => [{ id, amount: bet, ts: Date.now(), key: feedKeyRef.current }, ...prev].slice(0, 8));
      scheduleBettingTick();
    }, 500 + Math.random() * 700);
  }, []);

  useEffect(() => {
    return () => {
      if (feedTickerRef.current)    clearTimeout(feedTickerRef.current);
      if (bettingTickerRef.current) clearTimeout(bettingTickerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cash-out (full) ───────────────────────────────────────────────────────
  const doCashOut = useCallback((atMult: number, betAmount: number) => {
    if (betRef.current.cashedOut) return;
    betRef.current.cashedOut = true;
    const won = Math.floor(betAmount * atMult);
    setCashedOut(true);
    setCashoutMult(atMult);
    setWinAmount(won);
    setBalance((prev) => {
      const nb = prev + won;
      if (user?.id) writeCachedBalance(user.id, nb);
      return nb;
    });
    setBalanceFlash(true);
    setTimeout(() => setBalanceFlash(false), 600);
    authFetch("/api/crash/cashout", { method: "POST", body: JSON.stringify({ roundId: currentRoundRef.current, cashoutMult: atMult, betType: "full" }) })
      .then(r => r.ok ? r.json() : null)
      .then((d: { newBalance: number; wonAmount?: number } | null) => {
        if (d?.newBalance !== undefined) {
          setBalance(d.newBalance);
          if (user?.id) writeCachedBalance(user.id, d.newBalance);
        }
      })
      .catch(() => {});
  }, [authFetch, user?.id]);

  // ── Cash-out (50% partial) ────────────────────────────────────────────────
  const doHalfCashOut = useCallback((atMult: number) => {
    if (betRef.current.cashedOut || betRef.current.halfCashedOut) return;
    const fullBet   = betRef.current.amount;
    const halfBet   = Math.floor(fullBet / 2);
    const halfWin   = Math.floor(halfBet * atMult);
    betRef.current.halfCashedOut = true;
    betRef.current.amount = fullBet - halfBet; // remaining in play
    setHalfCashedOut(true);
    setHalfCashoutMult(atMult);
    setHalfWonAmount(halfWin);
    setBalance((prev) => {
      const nb = prev + halfWin;
      if (user?.id) writeCachedBalance(user.id, nb);
      return nb;
    });
    setBalanceFlash(true);
    setTimeout(() => setBalanceFlash(false), 600);
    authFetch("/api/crash/cashout", { method: "POST", body: JSON.stringify({ roundId: currentRoundRef.current, cashoutMult: atMult, betType: "half" }) })
      .then(r => r.ok ? r.json() : null)
      .then((d: { newBalance: number; wonAmount?: number } | null) => {
        if (d?.newBalance !== undefined) {
          setBalance(d.newBalance);
          if (user?.id) writeCachedBalance(user.id, d.newBalance);
        }
      })
      .catch(() => {});
  }, [authFetch, user?.id]);

  // ── Game loop ─────────────────────────────────────────────────────────────
  const startRound = useCallback((roundId: number, msIntoOverride?: number, serverCrashPoint?: number) => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    // Invalidate any stale intervals from previous rounds
    roundGenRef.current += 1;
    const gen = roundGenRef.current;

    // Stop tickers
    if (bettingTickerRef.current) { clearTimeout(bettingTickerRef.current); bettingTickerRef.current = null; }
    if (feedTickerRef.current)    { clearTimeout(feedTickerRef.current);    feedTickerRef.current    = null; }

    const cp = serverCrashPoint ?? 2.0;
    crashPointRef.current = cp;
    currentRoundRef.current = roundId;
    phaseRef.current = "waiting";
    betRef.current = { placed: false, amount: 0, cashedOut: false, autoCashout: betRef.current.autoCashout, halfCashedOut: false };

    setPhase("waiting");
    setMultiplier(1.0);
    setBetPlaced(false);
    setCashedOut(false);
    setBetError(null);
    setCashoutMult(null);
    setWinAmount(null);
    setHalfCashedOut(false);
    setHalfCashoutMult(null);
    setHalfWonAmount(null);
    setFeed([]);

    const canvas = canvasRef.current;
    if (canvas) drawCurve(canvas, 0, "waiting", cp, lastFlightColorRef.current, [], performance.now());

    const msInto = msIntoOverride !== undefined ? msIntoOverride : msIntoRound();

    if (msInto >= FLIGHT_START_MS) {
      // Already in flight — fast-forward
      launchFlight(msInto - FLIGHT_START_MS);
    } else if (msInto >= CRASH_SHOW_S * 1000) {
      // In betting window — start betting simulation
      setBettingFeed([]);
      scheduleBettingTick();
      const betElapsedMs = msInto - CRASH_SHOW_S * 1000;
      const betLeft = Math.ceil((BET_WINDOW_S * 1000 - betElapsedMs) / 1000);
      setCountdown(Math.max(1, betLeft));
      let remaining = betLeft;
      const cdInterval = setInterval(() => {
        if (roundGenRef.current !== gen) { clearInterval(cdInterval); return; }
        remaining -= 1;
        setCountdown(Math.max(0, remaining));
        if (remaining <= 0) {
          clearInterval(cdInterval);
          launchFlight(0);
        }
      }, 1000);
    } else {
      // In post-crash display window (0-2s) — show the crashed multiplier immediately
      phaseRef.current = "crashed";
      setPhase("crashed");
      if (cp > 1.0) setMultiplier(cp); // display the actual crash result, not 1.0
      const crashLeft = Math.ceil((CRASH_SHOW_S * 1000 - msInto) / 1000);
      setCountdown(Math.max(1, crashLeft));
      let crashRemaining = crashLeft;
      const cdCrash = setInterval(() => {
        if (roundGenRef.current !== gen) { clearInterval(cdCrash); return; }
        crashRemaining -= 1;
        setCountdown(Math.max(0, crashRemaining));
        if (crashRemaining <= 0) {
          clearInterval(cdCrash);
          phaseRef.current = "waiting";
          setPhase("waiting");
          setMultiplier(1.0);
          setBetError(null);
          if (canvas) drawCurve(canvas, 0, "waiting", cp, lastFlightColorRef.current, [], performance.now());
          setCountdown(BET_WINDOW_S);
          setBettingFeed([]);
          scheduleBettingTick();
          // Refresh round ID — new server cycle starts at crash time, ensure we have it
          void fetch("/api/crash/round")
            .then(r => r.ok ? r.json() as Promise<{ roundId: number; crashPoint?: number; betting?: boolean }> : null)
            .then(rd => {
              if (roundGenRef.current !== gen) return;
              if (rd?.roundId) {
                currentRoundRef.current = rd.roundId;
                if (rd.crashPoint) crashPointRef.current = rd.crashPoint;
              }
            }).catch(() => {});
          let betRemaining = BET_WINDOW_S;
          const cdBet = setInterval(() => {
            if (roundGenRef.current !== gen) { clearInterval(cdBet); return; }
            betRemaining -= 1;
            setCountdown(Math.max(0, betRemaining));
            if (betRemaining <= 0) {
              clearInterval(cdBet);
              void (async () => {
                const rd = await fetch("/api/crash/round")
                  .then(r => r.ok ? r.json() as Promise<{ roundId: number; crashPoint: number; msIntoRound: number; serverMs: number }> : null)
                  .catch(() => null);
                if (roundGenRef.current !== gen) return;
                if (rd?.roundId) {
                  currentRoundRef.current = rd.roundId;
                  crashPointRef.current = rd.crashPoint ?? crashPointRef.current;
                }
                launchFlight(0);
              })();
            }
          }, 1000);
        }
      }, 1000);
    }

    function launchFlight(skipMs: number) {
      // Stop betting simulation, clear that feed, start flight feed
      if (bettingTickerRef.current) { clearTimeout(bettingTickerRef.current); bettingTickerRef.current = null; }
      setBettingFeed([]);
      setFeed([]);
      phaseRef.current = "flying";
      setPhase("flying");
      startTimeRef.current = performance.now() - skipMs;
      scheduleFeedTick();

      function tick(now: number) {
        const elapsed = (now - startTimeRef.current) / 1000;
        const m = tToM(elapsed);
        multiplierRef.current = m;
        setMultiplier(m);

        const c = canvasRef.current;
        const curColor = multColor(m);
        lastFlightColorRef.current = curColor;

        if (c && now - lastParticleRef.current > 28) {
          lastParticleRef.current = now;
          const spawnCount = m > 10 ? 4 : m > 4 ? 3 : 2;
          const [tx0, ty0] = lastTipRef.current;
          for (let k = 0; k < spawnCount; k++) {
            const palette: Array<[number,number,number]> = [
              [255, 200, 60], [255, 130, 30], [255, 80, 10], [255, 240, 120],
            ];
            const col = palette[Math.floor(Math.random() * palette.length)];
            particlesRef.current.push({
              x: tx0, y: ty0,
              vx: -(1.5 + Math.random() * 2.5),
              vy: (Math.random() - 0.5) * 1.2,
              life: 1, maxLife: 1,
              r: 2.5 + Math.random() * 3,
              color: col,
            });
          }
        }
        particlesRef.current = particlesRef.current
          .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.04 }))
          .filter(p => p.life > 0);

        const tip = c ? drawCurve(c, elapsed, "flying", crashPointRef.current, lastFlightColorRef.current, particlesRef.current, now) : null;
        if (tip) lastTipRef.current = tip;

        const autoAt = betRef.current.autoCashout;
        if (betRef.current.placed && !betRef.current.cashedOut && autoAt > 1.0 && m >= autoAt) {
          doCashOut(parseFloat(m.toFixed(2)), betRef.current.amount);
        }

        if (m >= crashPointRef.current) {
          const finalM = parseFloat(crashPointRef.current.toFixed(2));
          setMultiplier(finalM);
          phaseRef.current = "crashed";
          setPhase("crashed");
          setCountdown(CRASH_SHOW_S);
          particlesRef.current = [];
          if (c) drawCurve(c, mToT(finalM), "crashed", finalM, lastFlightColorRef.current, [], now);
          setHistory((h) => [{ cp: finalM }, ...h].slice(0, 12));

          // Stop flight feed ticker
          if (feedTickerRef.current) { clearTimeout(feedTickerRef.current); feedTickerRef.current = null; }

          // Prefetch next round ID immediately so it's ready when betting window opens
          void (async () => {
            const rd = await fetch("/api/crash/round")
              .then(r => r.ok ? r.json() as Promise<{ roundId: number; crashPoint: number; msIntoRound: number; serverMs: number }> : null)
              .catch(() => null);
            if (roundGenRef.current !== gen) return;
            if (rd?.roundId) {
              currentRoundRef.current = rd.roundId;
              crashPointRef.current = rd.crashPoint ?? crashPointRef.current;
            }
          })();

          // Show crash result for CRASH_SHOW_S, then start betting window
          let crashRemaining = CRASH_SHOW_S;
          const cdCrash = setInterval(() => {
            if (roundGenRef.current !== gen) { clearInterval(cdCrash); return; }
            crashRemaining--;
            setCountdown(Math.max(0, crashRemaining));
            if (crashRemaining <= 0) {
              clearInterval(cdCrash);
              phaseRef.current = "waiting";
              setPhase("waiting");
              setMultiplier(1.0);
              setBetError(null);
              if (c) drawCurve(c, 0, "waiting", crashPointRef.current, lastFlightColorRef.current, [], performance.now());
              setCountdown(BET_WINDOW_S);
              betRef.current = { placed: false, amount: 0, cashedOut: false, autoCashout: betRef.current.autoCashout, halfCashedOut: false };
              setBetPlaced(false);
              setCashedOut(false);
              setCashoutMult(null);
              setWinAmount(null);
              setHalfCashedOut(false);
              setHalfCashoutMult(null);
              setHalfWonAmount(null);
              // Re-verify round ID — prefetch at crash time may have had race condition
              // with server setTimeout; re-fetch ensures we have the correct new cycle ID
              void fetch("/api/crash/round")
                .then(r => r.ok ? r.json() as Promise<{ roundId: number; crashPoint?: number; betting?: boolean }> : null)
                .then(rd => {
                  if (roundGenRef.current !== gen) return;
                  if (rd?.roundId) {
                    currentRoundRef.current = rd.roundId;
                    if (rd.crashPoint) crashPointRef.current = rd.crashPoint;
                  }
                }).catch(() => {});
              // Start betting simulation for next round
              setBettingFeed([]);
              setFeed([]);
              scheduleBettingTick();

              let betRemaining = BET_WINDOW_S;
              const cdBet = setInterval(() => {
                if (roundGenRef.current !== gen) { clearInterval(cdBet); return; }
                betRemaining--;
                setCountdown(Math.max(0, betRemaining));
                if (betRemaining <= 0) {
                  clearInterval(cdBet);
                  void (async () => {
                    const rd = await fetch("/api/crash/round")
                      .then(r => r.ok ? r.json() as Promise<{ roundId: number; crashPoint: number; msIntoRound: number; serverMs: number }> : null)
                      .catch(() => null);
                    if (roundGenRef.current !== gen) return;
                    if (rd?.roundId) {
                      currentRoundRef.current = rd.roundId;
                      crashPointRef.current = rd.crashPoint ?? crashPointRef.current;
                    }
                    launchFlight(0);
                  })();
                }
              }, 1000);
            }
          }, 1000);
          return;
        }

        rafRef.current = requestAnimationFrame(tick);
      }

      rafRef.current = requestAnimationFrame(tick);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doCashOut]);

  // ── Mount: subscribe to SSE stream — single source of truth for all clients ─
  // EventSource auto-reconnects on disconnect, so the game stays live 24/7.
  // All accounts receive the identical phase/crashPoint/timing from the server.
  const startRoundRef = useRef(startRound);
  startRoundRef.current = startRound; // always fresh — no stale closure in the SSE handler

  useEffect(() => {
    let initialised = false;
    let lastRoundId  = -1;

    const es = new EventSource("/api/crash/stream");

    es.onmessage = (e: MessageEvent) => {
      try {
        const state = JSON.parse(e.data as string) as CrashStreamEvent;
        const { phase: sPhase, roundId, msIntoRound, serverMs } = state;

        // Compensate for one-way network latency
        const networkOffset = Math.max(0, (Date.now() - serverMs) / 2);
        const adjustedMs    = msIntoRound + networkOffset;

        setSyncing(false);
        // Keep round ID ref current so bet/cashout use the right cycle
        currentRoundRef.current = roundId;

        // ── First message or new round → full rebuild via startRound ──────────
        if (!initialised || roundId !== lastRoundId) {
          initialised  = true;
          // When the server just started a new cycle (show phase), the previous
          // crash result is in prevCrashPoint — prepend it to history immediately
          if (roundId !== lastRoundId && sPhase === "show" && state.prevCrashPoint) {
            const cp = parseFloat(state.prevCrashPoint.toFixed(2));
            setHistory(h => [{ cp }, ...h].slice(0, 25));
          }
          lastRoundId  = roundId;
          const cp =
            sPhase === "flying"  ? state.crashPoint      :
            sPhase === "show"    ? state.prevCrashPoint   :
            undefined;
          startRoundRef.current(roundId, adjustedMs, cp);
          return;
        }

        // ── Phase mismatch: server flying but client isn't → force sync ───────
        if (sPhase === "flying" && state.crashPoint && phaseRef.current !== "flying") {
          // Always update the crash point so the animation is correct
          crashPointRef.current = state.crashPoint;
          currentRoundRef.current = roundId;
          const msIntoFlight = Math.max(0, adjustedMs - FLIGHT_START_MS);
          if (msIntoFlight > 1500) {
            // > 1.5s into flight and still not flying → page reload mid-flight.
            // Betting is already closed so there's no active bet to preserve.
            lastRoundId = roundId;
            startRoundRef.current(roundId, adjustedMs, state.crashPoint);
          }
          // ≤ 1.5s: betting→flying boundary. The local countdown fires within ~1s.
          // Don't call startRound here — it would reset betPlaced and lose the user's bet.
          return;
        }

        // ── During flight: keep crash point & animation time in sync ──────────
        // Server is the clock master; client RAF is just the renderer.
        if (sPhase === "flying" && state.crashPoint && phaseRef.current === "flying") {
          crashPointRef.current = state.crashPoint;
          const expectedSkip = Math.max(0, adjustedMs - FLIGHT_START_MS);
          const actualSkip   = performance.now() - startTimeRef.current;
          // Correct drift > 500ms to avoid diverging multiplier displays
          if (Math.abs(expectedSkip - actualSkip) > 500) {
            startTimeRef.current = performance.now() - expectedSkip;
          }
        }
      } catch { /* ignore malformed events */ }
    };

    es.onerror = () => { /* EventSource auto-reconnects automatically */ };

    return () => {
      es.close();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Bet actions ───────────────────────────────────────────────────────────
  const [betLoading, setBetLoading] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);

  const placeBet = useCallback(async (overrideAmt?: number) => {
    if (syncing || phase !== "waiting" || betLoading) return;
    const amt = overrideAmt ?? parseInt(betInput.replace(/\D/g, ""), 10);
    if (!amt || amt < 100) return;
    if (amt > 10_000) return;
    if (amt > balance) return;
    setBetLoading(true);
    setBetError(null);
    try {
      const res = await authFetch("/api/crash/bet", { method: "POST", body: JSON.stringify({ amount: amt, roundId: currentRoundRef.current }) });
      const data = await res.json() as { ok?: boolean; error?: string; newBalance?: number };
      if (!res.ok) { setBetError(data.error ?? "Erreur lors de la mise"); return; }
      betRef.current.placed = true;
      betRef.current.amount = amt;
      betRef.current.cashedOut = false;
      setBetPlaced(true);
      setBetError(null);
      const nb = data.newBalance !== undefined ? data.newBalance : Math.max(0, balance - amt);
      setBalance(nb);
      if (user?.id) writeCachedBalance(user.id, nb);
    } catch { setBetError("Erreur réseau, réessayez"); } finally { setBetLoading(false); }
  }, [syncing, phase, betLoading, betInput, balance, authFetch, user?.id]);

  const cancelBet = useCallback(async () => {
    if (phase !== "waiting" || !betRef.current.placed) return;
    const amt = betRef.current.amount;
    betRef.current.placed = false;
    betRef.current.amount = 0;
    setBetPlaced(false);
    setBalance((prev) => {
      const nb = prev + amt;
      if (user?.id) writeCachedBalance(user.id, nb);
      return nb;
    });
    authFetch("/api/crash/cancel-bet", { method: "POST", body: JSON.stringify({ roundId: currentRoundRef.current }) })
      .then(r => r.ok ? r.json() : null)
      .then((d: { newBalance: number } | null) => {
        if (d?.newBalance !== undefined) {
          setBalance(d.newBalance);
          if (user?.id) writeCachedBalance(user.id, d.newBalance);
        }
      })
      .catch(() => {});
  }, [phase, authFetch, user?.id]);

  const cashOut = () => {
    if (phase !== "flying" || !betRef.current.placed || betRef.current.cashedOut) return;
    doCashOut(parseFloat(multiplier.toFixed(2)), betRef.current.amount);
  };

  // ── Auto-bet: place a bet automatically each new "waiting" phase ──────────
  useEffect(() => {
    if (!autoBetEnabled || activeTab !== "auto") return;
    if (phase !== "waiting" || betPlaced || betLoading) return;
    const amt = autoBetAmountRef.current;
    if (!amt || amt < 100) return;
    setAutoBetPlacing(true);
    const t = setTimeout(() => {
      placeBet(amt).finally(() => setAutoBetPlacing(false));
    }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoBetEnabled, activeTab]);

  const color = phase === "crashed" ? lastFlightColorRef.current : multColor(multiplier);
  const quickAmounts = [500, 1000, 2000, 5000];
  const betAmt = parseInt(betInput) || 0;
  const canBet = !syncing && betAmt >= 100 && betAmt <= balance && !betLoading && countdown > 0;
  const isBlocked = balanceLoaded && balance === 0;

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
        </div>
      </header>

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        className="relative shrink-0"
        style={{ height: 240, background: "#080f0a" }}
      >
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />

        {/* Syncing overlay — shown until first server response */}
        {syncing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ background: "rgba(8,15,10,0.7)" }}>
            <div className="flex flex-col items-center gap-2">
              <div
                className="rounded-full border-2 border-t-transparent animate-spin"
                style={{ width: 28, height: 28, borderColor: "rgba(141,198,63,0.6)", borderTopColor: "transparent" }}
              />
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(141,198,63,0.7)" }}>
                Synchronisation…
              </span>
            </div>
          </div>
        )}

        {/* Multiplier overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {phase === "waiting" ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>
                PARI EN COURS
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
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(239,68,68,0.7)" }}>
                CRASHÉ À
              </span>
              <span
                className="font-black leading-none"
                style={{ fontSize: "3.5rem", color: color, fontFamily: "'Oswald', sans-serif", textShadow: `0 0 40px ${color}80` }}
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


        {phase === "flying" && betPlaced && cashedOut && cashoutMult !== null && (
          <div
            className="absolute bottom-3 left-3 right-3 py-2.5 rounded-2xl font-black uppercase tracking-wide text-[13px] flex items-center justify-center gap-2"
            style={{ background: "rgba(141,198,63,0.18)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.35)" }}
          >
            ✓ ENCAISSÉ À {fMult(cashoutMult)} · +{fFC(Math.floor(betRef.current.amount * cashoutMult))} FC
          </div>
        )}
      </div>

      {/* ── History row ── */}
      <div
        className="flex items-center gap-2 px-4 py-2 shrink-0"
        style={{ background: "#0b1410", borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <span className="text-[9px] font-black uppercase tracking-widest shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
          Hist.
        </span>
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {history.map((h, i) => {
            const c = histColor(h.cp);
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

      {/* ── Win / Loss banners ── */}
      {phase === "crashed" && betPlaced && cashedOut && winAmount !== null && (
        <div
          className="mx-4 mt-2 px-4 py-2.5 rounded-2xl flex items-center justify-between shrink-0"
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
          className="mx-4 mt-2 px-4 py-2.5 rounded-2xl flex items-center justify-between shrink-0"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <span className="text-[12px] font-black" style={{ color: "#ef4444" }}>💸 PERDU</span>
          <span className="font-black text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            -{fFC(betRef.current.amount)} FC
          </span>
        </div>
      )}

      {/* ── Zero balance gate ── */}
      {isBlocked && (
        <div
          className="mx-4 mt-2 mb-2 px-4 py-4 rounded-2xl flex flex-col items-center gap-3 text-center shrink-0"
          style={{ background: "rgba(141,198,63,0.07)", border: "1px solid rgba(141,198,63,0.2)" }}
        >
          <Ticket style={{ width: 24, height: 24, color: "#8DC63F" }} />
          <p className="text-[13px] font-black text-white">Solde insuffisant</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Activez un ticket depuis l'accueil pour créditer votre compte.
          </p>
          <button
            onClick={() => setLocation("/app")}
            className="px-5 py-2 rounded-xl font-black text-[12px] uppercase tracking-wide"
            style={{ background: "#8DC63F", color: "#0a1f0e" }}
          >
            Activer un ticket
          </button>
        </div>
      )}

      {/* ── Bet panel (compact) ── */}
      <div
        className="mt-2 mx-3 mb-2 rounded-2xl overflow-hidden shrink-0"
        style={{ background: "#0d1d12", border: "1px solid rgba(255,255,255,0.07)", opacity: isBlocked ? 0.35 : 1, pointerEvents: isBlocked ? "none" : undefined }}
      >
        <div className="flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={() => setActiveTab("manual")}
            className="flex-1 py-2 text-center text-[10px] font-black uppercase tracking-wide transition-all"
            style={{
              color: activeTab === "manual" ? "#8DC63F" : "rgba(255,255,255,0.3)",
              borderBottom: activeTab === "manual" ? "2px solid #8DC63F" : "2px solid transparent",
            }}
          >
            Mise manuelle
          </button>
          <button
            onClick={() => setActiveTab("auto")}
            className="flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide transition-all"
            style={{
              color: activeTab === "auto" ? "#8DC63F" : "rgba(255,255,255,0.3)",
              borderBottom: activeTab === "auto" ? "2px solid #8DC63F" : "2px solid transparent",
            }}
          >
            Auto
          </button>
        </div>

        {activeTab === "auto" ? (
          /* ── Auto tab ── */
          <div className="px-3 pt-2 pb-3 space-y-2">
            <div className="text-[10px] font-bold pt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
              Mise par tour (FC)
            </div>
            <div
              className="flex items-center rounded-xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <button
                onClick={() => setAutoBetAmountInput((v) => String(Math.max(100, (parseInt(v) || 0) - 500)))}
                disabled={autoBetEnabled}
                className="w-9 h-9 flex items-center justify-center font-black text-lg transition-all active:scale-90 disabled:opacity-30"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >−</button>
              <input
                type="number"
                value={autoBetAmountInput}
                onChange={(e) => setAutoBetAmountInput(e.target.value)}
                disabled={autoBetEnabled}
                className="flex-1 bg-transparent text-center font-black text-white outline-none disabled:opacity-50 text-[14px]"
                min={100}
              />
              <button
                onClick={() => setAutoBetAmountInput((v) => String((parseInt(v) || 0) + 500))}
                disabled={autoBetEnabled}
                className="w-9 h-9 flex items-center justify-center font-black text-lg transition-all active:scale-90 disabled:opacity-30"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >+</button>
            </div>

            <div className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
              Retrait automatique (×)
            </div>
            <div
              className="flex items-center rounded-xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <input
                type="number"
                value={autoCashoutInput}
                onChange={(e) => {
                  setAutoCashoutInput(e.target.value);
                  betRef.current.autoCashout = parseFloat(e.target.value) || 0;
                }}
                disabled={autoBetEnabled}
                placeholder="Ex: 2.00 (optionnel)"
                className="flex-1 bg-transparent px-3 h-8 font-bold text-white outline-none text-[12px] disabled:opacity-50"
                step="0.1"
                min="1.1"
              />
              <span className="px-2 text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>×</span>
            </div>

            <button
              onClick={() => setAutoBetEnabled((v) => !v)}
              disabled={!autoBetEnabled && (parseInt(autoBetAmountInput) < 100 || parseInt(autoBetAmountInput) > balance)}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[14px] transition-all active:scale-[0.97] disabled:opacity-40"
              style={{
                background: autoBetEnabled
                  ? "rgba(239,68,68,0.15)"
                  : "linear-gradient(135deg,#1a6b2f,#22a84a)",
                color: autoBetEnabled ? "#ef4444" : "#fff",
                border: autoBetEnabled ? "1px solid rgba(239,68,68,0.3)" : "none",
                boxShadow: autoBetEnabled ? "none" : "0 4px 20px rgba(34,168,74,0.35)",
              }}
            >
              {autoBetEnabled ? "⏹ ARRÊTER L'AUTO" : "▶ DÉMARRER L'AUTO"}
            </button>

            {autoBetEnabled && (
              <div className="text-center text-[10px] font-bold" style={{ color: "rgba(141,198,63,0.6)" }}>
                {betPlaced
                  ? `Mise en cours · ${fFC(betRef.current.amount)} FC`
                  : autoBetPlacing
                  ? "Placement en cours…"
                  : "En attente du prochain tour…"}
              </div>
            )}
          </div>
        ) : (
          /* ── Manual tab ── */
          <div className="px-3 pt-2 pb-3 space-y-2">
            {/* Amount row */}
            <div
              className="flex items-center rounded-xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <button
                onClick={() => setBetInput((v) => String(Math.max(100, (parseInt(v) || 0) - 500)))}
                disabled={betPlaced}
                className="w-9 h-9 flex items-center justify-center font-black text-lg transition-all active:scale-90 disabled:opacity-30"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >−</button>
              <input
                type="number"
                value={betInput}
                onChange={(e) => setBetInput(e.target.value)}
                disabled={betPlaced}
                className="flex-1 bg-transparent text-center font-black text-white outline-none disabled:opacity-50 text-[14px]"
                min={100}
                max={10000}
              />
              <button
                onClick={() => setBetInput((v) => String(Math.min(10_000, (parseInt(v) || 0) + 500)))}
                disabled={betPlaced}
                className="w-9 h-9 flex items-center justify-center font-black text-lg transition-all active:scale-90 disabled:opacity-30"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >+</button>
            </div>

            {/* Quick amounts */}
            <div className="flex gap-1.5">
              {quickAmounts.map((a) => (
                <button
                  key={a}
                  onClick={() => setBetInput(String(a))}
                  disabled={betPlaced}
                  className="flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 disabled:opacity-30"
                  style={{ background: "rgba(141,198,63,0.08)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.15)" }}
                >
                  {a >= 1000 ? `${a / 1000}K` : a}
                </button>
              ))}
              {balance > 0 && (
                <button
                  onClick={() => setBetInput(String(Math.min(10_000, Math.floor(balance))))}
                  disabled={betPlaced}
                  className="flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 disabled:opacity-30"
                  style={{ background: "rgba(141,198,63,0.08)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.15)" }}
                >MAX</button>
              )}
            </div>

            {/* Auto cash-out */}
            <div
              className="flex items-center rounded-xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <input
                type="number"
                value={autoCashoutInput}
                onChange={(e) => {
                  setAutoCashoutInput(e.target.value);
                  betRef.current.autoCashout = parseFloat(e.target.value) || 0;
                }}
                placeholder="Retrait auto ex: 2.00×"
                className="flex-1 bg-transparent px-3 h-8 font-bold text-white outline-none text-[12px]"
                step="0.1"
                min="1.1"
              />
              <span className="px-2 text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>×</span>
            </div>

            {/* Bet error */}
            {betError && (
              <p className="text-[11px] font-bold text-red-400 text-center px-1">{betError}</p>
            )}

            {/* Action button */}
            {phase === "waiting" && !betPlaced && (
              <button
                onClick={() => { setBetError(null); void placeBet(); }}
                disabled={!canBet}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[15px] transition-all active:scale-[0.97] disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#1a6b2f,#22a84a)", color: "#fff", boxShadow: "0 4px 20px rgba(34,168,74,0.35)" }}
              >
                {betLoading ? "…" : `PLACER · ${fFC(betAmt)} FC`}
              </button>
            )}
            {phase === "waiting" && betPlaced && (
              <button
                onClick={cancelBet}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[14px] transition-all active:scale-[0.97]"
                style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                ✕ ANNULER LA MISE
              </button>
            )}
            {phase === "flying" && !betPlaced && (
              <button disabled className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] opacity-30"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                EN VOL — PROCHAIN TOUR
              </button>
            )}
            {phase === "flying" && betPlaced && !cashedOut && (
              <div className="space-y-1.5">
                {/* ½ cashout badge — shown after partial cashout */}
                {halfCashedOut && halfCashoutMult !== null && halfWonAmount !== null && (
                  <div
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl text-[10px] font-bold"
                    style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.25)", color: "#facc15" }}
                  >
                    <span>½ encaissé à {fMult(halfCashoutMult)}</span>
                    <span>+{fFC(halfWonAmount)} FC · {fFC(betRef.current.amount)} FC en jeu</span>
                  </div>
                )}

                {/* Full cashout button */}
                <button
                  onClick={cashOut}
                  className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[15px] transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg,#16a34a,#22c55e)",
                    color: "#fff",
                    boxShadow: "0 4px 28px rgba(34,197,94,0.55)",
                    animation: "encaisserGlow 0.8s ease-in-out infinite",
                  }}
                >
                  <span>🛑 ENCAISSER</span>
                  <span className="font-bold">
                    {fMult(multiplier)} · +{fFC(Math.floor(betRef.current.amount * multiplier))} FC
                  </span>
                </button>

                {/* 50% partial cashout button — only available once */}
                {!halfCashedOut && (
                  <button
                    onClick={() => doHalfCashOut(parseFloat(multiplier.toFixed(2)))}
                    className="w-full py-2.5 rounded-2xl font-black uppercase tracking-wide text-[12px] transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                    style={{
                      background: "rgba(250,204,21,0.1)",
                      color: "#facc15",
                      border: "1px solid rgba(250,204,21,0.3)",
                    }}
                  >
                    <span>½ RETIRER 50%</span>
                    <span className="font-bold opacity-90">
                      +{fFC(Math.floor(betRef.current.amount * 0.5 * multiplier))} FC · {fFC(Math.floor(betRef.current.amount * 0.5))} FC restent
                    </span>
                  </button>
                )}
              </div>
            )}
            {phase === "flying" && betPlaced && cashedOut && (
              <button disabled className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[14px]"
                style={{ background: "rgba(141,198,63,0.12)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.3)" }}>
                ✓ ENCAISSÉ À {cashoutMult !== null ? fMult(cashoutMult) : "--"}
              </button>
            )}
            {phase === "crashed" && (
              <button disabled className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] opacity-40"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                PARI DANS {countdown}s…
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Activité en direct — betting sim (waiting) / cashout feed (flying) ── */}
      <div
        ref={feedScrollRef}
        className="mx-3 mb-3 rounded-xl overflow-hidden shrink-0"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", maxHeight: 148, overflowY: "hidden" }}
      >
        <div className="px-2 py-1.5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: phase === "waiting" ? "rgba(245,197,24,0.6)" : "rgba(141,198,63,0.5)" }}>
            {phase === "waiting" ? "⏳ Joueurs en train de miser" : "● Encaissements en direct"}
          </span>
        </div>
        <div className="overflow-hidden">
          {phase === "waiting" ? (
            /* ── Betting simulation during countdown ── */
            bettingFeed.length === 0 ? (
              <div className="px-3 py-2 text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>En attente de mises…</div>
            ) : (
              bettingFeed.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 feed-row"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                >
                  <span className="text-[10px] font-black shrink-0 font-mono" style={{ color: "rgba(245,197,24,0.7)", minWidth: 80 }}>
                    {entry.id}
                  </span>
                  <span className="text-[10px] font-bold shrink-0" style={{ color: "rgba(245,197,24,0.5)" }}>
                    EN TRAIN DE MISER
                  </span>
                  <span className="text-[10px] font-bold text-white shrink-0">
                    {fFC(entry.amount)} FC
                  </span>
                </div>
              ))
            )
          ) : (
            /* ── Cashout feed during flight / crash ── */
            feed.length === 0 ? (
              <div className="px-3 py-2 text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                {phase === "flying" ? "⚡ Décollage…" : ""}
              </div>
            ) : (
              feed.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 feed-row"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                >
                  <span className="text-[10px] font-black shrink-0 font-mono" style={{ color: "rgba(141,198,63,0.7)", minWidth: 80 }}>
                    {entry.id}
                  </span>
                  <span className="text-[10px] font-black shrink-0" style={{ color: multColor(entry.mult) }}>
                    ×{entry.mult.toFixed(2)}
                  </span>
                  <span className="text-[10px] font-bold text-white shrink-0">
                    +{fFC(entry.amount)} FC
                  </span>
                </div>
              ))
            )
          )}
        </div>
      </div>

      <style>{`
        @keyframes encaisserGlow {
          0%, 100% { box-shadow: 0 4px 28px rgba(34,197,94,0.55); }
          50%       { box-shadow: 0 6px 40px rgba(34,197,94,0.85), 0 0 60px rgba(34,197,94,0.25); }
        }
        .feed-row {
          animation: feedSlide 0.35s ease-out;
        }
        @keyframes feedSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
