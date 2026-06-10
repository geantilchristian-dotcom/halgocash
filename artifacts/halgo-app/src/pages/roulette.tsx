import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import { ArrowLeft, Loader2, Users } from "lucide-react";

const SEGMENTS = [
  { label: "JACKPOT",   line2: null,    mult: 100, color: "#d97706", colorDark: "#78350f", textColor: "#1a0a00", icon: "\u2605" },
  { label: "MÉGA",      line2: null,    mult: 25,  color: "#db2777", colorDark: "#831843", textColor: "#fff",    icon: "\u25C6" },
  { label: "GRAND",     line2: null,    mult: 10,  color: "#dc2626", colorDark: "#7f1d1d", textColor: "#fff",    icon: "\u2605" },
  { label: "MAJEUR",    line2: null,    mult: 5,   color: "#d97706", colorDark: "#78350f", textColor: "#fff",    icon: "\u2665" },
  { label: "MINEUR",    line2: null,    mult: 2,   color: "#16a34a", colorDark: "#14532d", textColor: "#fff",    icon: "\u25C6" },
  { label: "PETIT",     line2: null,    mult: 1,   color: "#0891b2", colorDark: "#164e63", textColor: "#fff",    icon: "\u25CF" },
  { label: "TRÈS",      line2: "PETIT", mult: 0.5, color: "#7c3aed", colorDark: "#3b0764", textColor: "#fff",    icon: "\u00B7\u00B7" },
  { label: "PERDU",     line2: null,    mult: 0,   color: "#374151", colorDark: "#111827", textColor: "#9ca3af", icon: "\u2715" },
] as const;

const SEG_COUNT = SEGMENTS.length;
const SEG_ANGLE = (2 * Math.PI) / SEG_COUNT;

type SpinState = "idle" | "pending" | "spinning" | "result";
interface HistoryEntry { label: string; color: string; mult: number }

const TOP_WINNERS = [
  { name: "Player8547", amount: 250000 },
  { name: "KingHalgo",  amount: 150000 },
  { name: "LuckyWin",   amount: 98500  },
];

const PROBS = ["45%", "20%", "15%", "10%", "5%", "3%", "1.5%", "0.5%"];

function fFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".") + " FC";
}

function fFCShort(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M FC";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K FC";
  return n + " FC";
}

function drawWheel(
  canvas: HTMLCanvasElement,
  rotation: number,
  highlightIdx: number | null,
  spinning: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const cx = W / 2;
  const cy = W / 2;
  const R     = cx * 0.91;
  const rimW  = R * 0.09;
  const segR  = R - rimW;
  const hubR  = segR * 0.195;

  ctx.clearRect(0, 0, W, W);

  // — Outer glow —
  const glow = ctx.createRadialGradient(cx, cy, segR * 0.85, cx, cy, R * 1.25);
  glow.addColorStop(0, "rgba(245,197,24,0)");
  glow.addColorStop(0.5, spinning ? "rgba(245,197,24,0.22)" : "rgba(245,197,24,0.09)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.25, 0, 2 * Math.PI);
  ctx.fillStyle = glow;
  ctx.fill();

  // — Golden rim base —
  const rimG = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  rimG.addColorStop(0, "#7c2d12");
  rimG.addColorStop(0.15, "#fde68a");
  rimG.addColorStop(0.35, "#F5C518");
  rimG.addColorStop(0.5, "#fbbf24");
  rimG.addColorStop(0.65, "#F5C518");
  rimG.addColorStop(0.85, "#fde68a");
  rimG.addColorStop(1, "#7c2d12");
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.fillStyle = rimG;
  ctx.fill();

  // — Rivets —
  const rivetCount = 24;
  for (let i = 0; i < rivetCount; i++) {
    const a = (i / rivetCount) * 2 * Math.PI;
    const bx = cx + Math.cos(a) * (R - rimW * 0.42);
    const by = cy + Math.sin(a) * (R - rimW * 0.42);
    const rr = rimW * 0.30;
    ctx.beginPath();
    ctx.arc(bx, by, rr, 0, 2 * Math.PI);
    const rv = ctx.createRadialGradient(bx - rr * 0.3, by - rr * 0.3, 0, bx, by, rr);
    rv.addColorStop(0, "#fef3c7");
    rv.addColorStop(0.5, "#d97706");
    rv.addColorStop(1, "#7c2d12");
    ctx.fillStyle = rv;
    ctx.fill();
  }

  // — Segments —
  for (let i = 0; i < SEG_COUNT; i++) {
    const startAngle = rotation + i * SEG_ANGLE - Math.PI / 2;
    const endAngle   = startAngle + SEG_ANGLE;
    const midAngle   = startAngle + SEG_ANGLE / 2;
    const seg = SEGMENTS[i]!;
    const isHl = highlightIdx === i;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, segR, startAngle, endAngle);
    ctx.closePath();

    if (isHl) {
      ctx.fillStyle = "#fef08a";
    } else {
      const sg = ctx.createRadialGradient(cx, cy, hubR, cx, cy, segR);
      sg.addColorStop(0, seg.colorDark);
      sg.addColorStop(0.55, seg.color);
      sg.addColorStop(1, seg.color + "cc");
      ctx.fillStyle = sg;
    }
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // — Segment text —
    const textR = hubR + (segR - hubR) * 0.55;
    const lx = cx + Math.cos(midAngle) * textR;
    const ly = cy + Math.sin(midAngle) * textR;
    const fs  = W > 270 ? 9 : 7;
    const tC  = isHl ? "#1a0a00" : seg.textColor;

    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = `${fs + 2}px sans-serif`;
    ctx.fillStyle = tC;
    ctx.fillText(seg.icon, 0, -(fs * 2.6));

    ctx.font = `bold ${fs}px sans-serif`;
    ctx.fillStyle = tC;
    if (seg.line2) {
      ctx.fillText(seg.label, 0, -(fs * 0.9));
      ctx.fillText(seg.line2, 0, fs * 0.3);
    } else {
      ctx.fillText(seg.label, 0, -(fs * 0.35));
    }

    ctx.font = `bold ${fs + 3}px sans-serif`;
    ctx.fillStyle = isHl ? "#1a0a00" : "#fff";
    const multY = seg.line2 ? fs * 1.75 : fs * 1.3;
    ctx.fillText(`\u00D7${seg.mult}`, 0, multY);

    ctx.restore();
  }

  // — Hub —
  const hg = ctx.createRadialGradient(cx - hubR * 0.35, cy - hubR * 0.35, 0, cx, cy, hubR);
  hg.addColorStop(0, "#fef3c7");
  hg.addColorStop(0.4, "#F5C518");
  hg.addColorStop(0.75, "#d97706");
  hg.addColorStop(1, "#7c2d12");
  ctx.beginPath();
  ctx.arc(cx, cy, hubR, 0, 2 * Math.PI);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.strokeStyle = "#7c2d12";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, hubR * 0.82, 0, 2 * Math.PI);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `bold ${Math.floor(hubR * 0.95)}px serif`;
  ctx.fillStyle = "#1a0a00";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4;
  ctx.fillText("H", cx, cy + hubR * 0.07);
  ctx.shadowBlur = 0;

  // — Pointer (golden downward triangle) —
  const pW  = W * 0.058;
  const pTip  = cy - R + rimW * 0.1;
  const pBase = cy - R - pW * 0.55;

  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur  = 6;
  ctx.beginPath();
  ctx.moveTo(cx, pTip);
  ctx.lineTo(cx - pW, pBase);
  ctx.lineTo(cx + pW, pBase);
  ctx.closePath();
  const pg = ctx.createLinearGradient(cx, pBase, cx, pTip);
  pg.addColorStop(0, "#fef3c7");
  pg.addColorStop(0.5, "#F5C518");
  pg.addColorStop(1, "#d97706");
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.strokeStyle = "#7c2d12";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

const FAKE_NAMES = ["Pro#5541","VIP#7731","Joueur#4422","User#9921","Player#3312","VIP#1199","User#6614","Client#5505"];

export default function RouletteGame() {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();

  const authFetch = useCallback(async (url: string, opts: RequestInit = {}): Promise<Response> => {
    const token = await getToken().catch(() => null);
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers as Record<string, string> | undefined ?? {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...opts, headers, credentials: "include" });
  }, [getToken]);

  const [balance, setBalance]           = useState(0);
  const [balanceLoaded, setBalLoaded]   = useState(false);
  const [balFlash, setBalFlash]         = useState(false);
  const [betInput, setBetInput]         = useState("1000");
  const [spinState, setSpinState]       = useState<SpinState>("idle");
  const [resultIdx, setResultIdx]       = useState<number | null>(null);
  const [lastMult, setLastMult]         = useState<number | null>(null);
  const [lastWon, setLastWon]           = useState<number | null>(null);
  const [lastLabel, setLastLabel]       = useState<string | null>(null);
  const [history, setHistory]           = useState<HistoryEntry[]>([]);
  const [error, setError]               = useState<string | null>(null);
  const [fakePlayers]                   = useState(() => 220 + Math.floor(Math.random() * 80));
  const [showDistrib, setShowDistrib]   = useState(false);

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef       = useRef<number | null>(null);
  const rotRef       = useRef(0);

  useEffect(() => {
    if (!isLoaded) return;
    authFetch("/api/auth/balance")
      .then(r => r.json())
      .then((d: { balance: number }) => { setBalance(d.balance); setBalLoaded(true); })
      .catch(() => setBalLoaded(true));
  }, [isLoaded, authFetch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ro = new ResizeObserver(() => {
      const s = Math.min(container.clientWidth, container.clientHeight);
      canvas.width = s;
      canvas.height = s;
      drawWheel(canvas, rotRef.current, resultIdx, spinState === "spinning");
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [resultIdx, spinState]);

  useEffect(() => {
    const c = canvasRef.current;
    if (c && c.width > 0) drawWheel(c, 0, null, false);
  }, []);

  const redraw = useCallback((hl: number | null, sp: boolean) => {
    const c = canvasRef.current;
    if (c) drawWheel(c, rotRef.current, hl, sp);
  }, []);

  const betAmt = Math.floor(parseFloat(betInput.replace(/[^\d.]/g, "")) || 0);
  const canSpin = spinState === "idle" && betAmt >= 100 && betAmt <= balance && balanceLoaded;

  function animateTo(winIdx: number, onDone: () => void) {
    const segCenter = winIdx * SEG_ANGLE + SEG_ANGLE / 2;
    const extra = 2 * Math.PI * (7 + Math.random() * 3);
    const cur = rotRef.current;
    const target = cur + extra + (2 * Math.PI - ((cur + segCenter) % (2 * Math.PI)));
    const start = performance.now();
    const dur = 4200 + Math.random() * 900;

    function ease(t: number) { return 1 - Math.pow(1 - t, 4); }

    function tick(now: number) {
      const t = Math.min((now - start) / dur, 1);
      rotRef.current = cur + (target - cur) * ease(t);
      redraw(null, true);
      if (t < 1) { rafRef.current = requestAnimationFrame(tick); }
      else { rotRef.current = target; onDone(); }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  const spin = async () => {
    if (!canSpin) return;
    setSpinState("pending");
    setResultIdx(null);
    setLastMult(null);
    setLastWon(null);
    setLastLabel(null);
    setError(null);

    let idx: number, mult: number, wonAmt: number, newBal: number, label: string;
    try {
      const res = await authFetch("/api/roulette/spin", {
        method: "POST",
        body: JSON.stringify({ amount: betAmt }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        setError(err.error ?? "Erreur serveur");
        setSpinState("idle");
        return;
      }
      const d = await res.json() as { segmentIdx: number; multiplier: number; wonAmount: number; newBalance: number; label: string };
      idx = d.segmentIdx; mult = d.multiplier; wonAmt = d.wonAmount; newBal = d.newBalance; label = d.label;
    } catch {
      setError("Connexion perdue. Réessayez.");
      setSpinState("idle");
      return;
    }

    setBalance(b => b - betAmt);
    setSpinState("spinning");

    animateTo(idx, () => {
      redraw(idx, false);
      setResultIdx(idx);
      setLastMult(mult);
      setLastWon(wonAmt);
      setLastLabel(label);
      setSpinState("result");
      setBalance(newBal);

      if (mult > 0) {
        setBalFlash(true);
        setTimeout(() => setBalFlash(false), 700);
      }

      const seg = SEGMENTS[idx]!;
      setHistory(h => [{ label, color: seg.color, mult }, ...h].slice(0, 12));

      setTimeout(() => {
        setSpinState("idle");
        setResultIdx(null);
        setLastMult(null);
        setLastWon(null);
        setLastLabel(null);
        setError(null);
        redraw(null, false);
      }, 2800);
    });
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const playerLabel = user?.username ?? user?.firstName ?? "Joueur";
  const gameId = useRef("#HR" + Math.floor(100000 + Math.random() * 900000)).current;

  return (
    <div className="min-h-dvh flex flex-col select-none" style={{ background: "linear-gradient(160deg,#0d0a00 0%,#100c03 60%,#0d0a00 100%)", maxWidth: 480, margin: "0 auto" }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: "rgba(22,13,0,0.95)", borderBottom: "1px solid rgba(245,197,24,0.2)", backdropFilter: "blur(8px)" }}>
        <button
          onClick={() => setLocation("/app")}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <ArrowLeft style={{ width: 17, height: 17, color: "rgba(255,255,255,0.7)" }} />
        </button>

        <div className="flex items-center gap-2">
          <span className="font-black tracking-wider" style={{ fontSize: "1rem", color: "#fff", letterSpacing: "0.05em" }}>
            HALGO <span style={{ color: "#F5C518" }}>ROULETTE</span>
          </span>
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)" }}>
            LIVE
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 h-9 rounded-xl transition-all"
          style={{
            background: balFlash ? "rgba(245,197,24,0.18)" : "rgba(255,255,255,0.07)",
            border: `1px solid ${balFlash ? "rgba(245,197,24,0.5)" : "rgba(255,255,255,0.12)"}`,
            transition: "all 0.35s",
          }}
        >
          {!balanceLoaded
            ? <Loader2 style={{ width: 13, height: 13, color: "#F5C518" }} className="animate-spin" />
            : <span className="font-black text-[11px]" style={{ color: balFlash ? "#F5C518" : "#fff" }}>
                {fFCShort(balance)}
              </span>
          }
        </div>
      </header>

      {/* ── Live bar ── */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(245,197,24,0.06)" }}>
        <div className="flex items-center gap-1.5">
          <Users style={{ width: 12, height: 12, color: "#F5C518" }} />
          <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            <span style={{ color: "#F5C518", fontWeight: 900 }}>{fakePlayers}</span> joueurs en direct
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,197,24,0.12)", color: "#F5C518", border: "1px solid rgba(245,197,24,0.25)" }}>
            JACKPOT 0.5%
          </span>
        </div>
      </div>

      {/* ── History chips ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid rgba(245,197,24,0.07)" }}>
        <span className="text-[9px] font-black uppercase tracking-widest shrink-0" style={{ color: "rgba(255,255,255,0.22)" }}>Résultats</span>
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {history.length === 0
            ? <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.18)" }}>—</span>
            : history.map((h, i) => (
              <span key={i} className="shrink-0 flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-lg" style={{ background: h.color + "22", color: h.color, border: `1px solid ${h.color}55` }}>
                ×{h.mult}
              </span>
            ))
          }
        </div>
      </div>

      {/* ── Wheel ── */}
      <div ref={containerRef} className="shrink-0 flex items-center justify-center px-5 py-3" style={{ height: 300 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", objectFit: "contain", filter: spinState === "spinning" ? "drop-shadow(0 0 18px rgba(245,197,24,0.45))" : "drop-shadow(0 4px 20px rgba(0,0,0,0.7))", transition: "filter 0.4s" }} />
      </div>

      {/* ── Result banner ── */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-2.5 rounded-2xl shrink-0" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <span className="text-[12px] font-bold" style={{ color: "#f87171" }}>{error}</span>
        </div>
      )}

      {lastLabel !== null && lastMult !== null && (
        <div
          className="mx-4 mb-2 px-4 py-3 rounded-2xl flex items-center justify-between shrink-0"
          style={{
            background: lastMult > 0
              ? "linear-gradient(135deg,rgba(245,197,24,0.18),rgba(245,197,24,0.06))"
              : "rgba(239,68,68,0.08)",
            border: `1px solid ${lastMult > 0 ? "rgba(245,197,24,0.35)" : "rgba(239,68,68,0.25)"}`,
            boxShadow: lastMult > 1 ? "0 0 24px rgba(245,197,24,0.15)" : "none",
          }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
              {lastMult >= 100 ? "🎉 JACKPOT !" : lastMult >= 10 ? "✨ Excellent !" : lastMult > 1 ? "Bien joué !" : lastMult === 1 ? "Remboursé" : lastMult === 0.5 ? "Demi-mise récupérée" : "Perdu"}
            </p>
            <p className="text-[13px] font-black" style={{ color: lastMult > 0 ? "#F5C518" : "#f87171" }}>
              {lastLabel} <span style={{ opacity: 0.7, fontSize: "0.8em" }}>×{lastMult}</span>
            </p>
          </div>
          {lastWon !== null && lastWon > 0 && (
            <span className="font-black text-lg" style={{ color: "#F5C518" }}>+{fFC(lastWon)}</span>
          )}
          {lastMult === 0 && (
            <span className="font-black text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>−{fFC(betAmt)}</span>
          )}
        </div>
      )}

      {/* ── Bet panel ── */}
      <div className="mx-4 mb-3 rounded-2xl overflow-hidden shrink-0" style={{ background: "rgba(22,13,0,0.9)", border: "1px solid rgba(245,197,24,0.15)" }}>
        <div className="px-4 pt-3 pb-1">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-center mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>MISE</p>

          {/* Amount row */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setBetInput(v => String(Math.max(100, Math.floor((parseFloat(v) || 0) - 500))))}
              disabled={spinState !== "idle"}
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl transition-all active:scale-90 disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.07)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
            >−</button>

            <div className="flex-1 text-center">
              <input
                type="number"
                value={betInput}
                onChange={e => setBetInput(e.target.value)}
                disabled={spinState !== "idle"}
                className="w-full bg-transparent text-center font-black outline-none disabled:opacity-50"
                style={{ fontSize: "1.25rem", color: "#fff" }}
                min={100}
              />
            </div>

            <button
              onClick={() => setBetInput(v => String(Math.floor((parseFloat(v) || 0) + 500)))}
              disabled={spinState !== "idle"}
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl transition-all active:scale-90 disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.07)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
            >+</button>
          </div>

          {/* Quick buttons */}
          <div className="flex gap-1.5 pb-3">
            {[
              { label: "MIN", action: () => setBetInput("100") },
              { label: "×2", action: () => setBetInput(v => String(Math.min(balance, Math.floor((parseFloat(v) || 0) * 2)))) },
              { label: "½", action: () => setBetInput(v => String(Math.max(100, Math.floor((parseFloat(v) || 0) / 2)))) },
              { label: "MAX", action: () => setBetInput(String(Math.floor(balance))) },
            ].map(b => (
              <button
                key={b.label}
                onClick={b.action}
                disabled={spinState !== "idle"}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 disabled:opacity-30"
                style={{ background: "rgba(245,197,24,0.1)", color: "#F5C518", border: "1px solid rgba(245,197,24,0.2)" }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* JOUER button */}
        <div className="px-3 pb-3">
          {spinState === "idle" && (
            <button
              onClick={() => void spin()}
              disabled={!canSpin}
              className="w-full py-4 rounded-xl font-black uppercase tracking-[0.1em] text-[15px] transition-all active:scale-[0.98] disabled:opacity-40"
              style={{
                background: canSpin
                  ? "linear-gradient(135deg,#92400e 0%,#d97706 30%,#F5C518 60%,#fde68a 80%,#d97706 100%)"
                  : "rgba(255,255,255,0.06)",
                color: canSpin ? "#1a0a00" : "rgba(255,255,255,0.3)",
                boxShadow: canSpin ? "0 4px 24px rgba(245,197,24,0.4), inset 0 1px 0 rgba(255,255,255,0.3)" : "none",
                textShadow: canSpin ? "0 1px 2px rgba(255,255,255,0.3)" : "none",
              }}
            >
              {!balanceLoaded ? "CHARGEMENT…"
                : betAmt < 100 ? "MISE MIN 100 FC"
                : betAmt > balance ? "SOLDE INSUFFISANT"
                : "JOUER"}
            </button>
          )}
          {spinState === "pending" && (
            <button disabled className="w-full py-4 rounded-xl font-black uppercase tracking-[0.1em] text-[13px] flex items-center justify-center gap-2" style={{ background: "rgba(245,197,24,0.1)", color: "#F5C518", border: "1px solid rgba(245,197,24,0.25)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> VALIDATION…
            </button>
          )}
          {(spinState === "spinning" || spinState === "result") && (
            <button disabled className="w-full py-4 rounded-xl font-black uppercase tracking-[0.1em] text-[13px] flex items-center justify-center gap-2" style={{ background: "rgba(245,197,24,0.1)", color: "#F5C518", border: "1px solid rgba(245,197,24,0.25)" }}>
              <div className="w-4 h-4 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
              {spinState === "spinning" ? "LA ROUE TOURNE…" : "RÉSULTAT…"}
            </button>
          )}
        </div>
      </div>

      {/* ── Distribution (collapsible) ── */}
      <div className="mx-4 mb-3 rounded-2xl overflow-hidden shrink-0" style={{ background: "rgba(22,13,0,0.7)", border: "1px solid rgba(245,197,24,0.1)" }}>
        <button
          className="w-full flex items-center justify-between px-4 py-3"
          onClick={() => setShowDistrib(v => !v)}
        >
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Répartition des gains</span>
          <span style={{ color: "rgba(245,197,24,0.6)", fontSize: 14 }}>{showDistrib ? "▲" : "▼"}</span>
        </button>
        {showDistrib && (
          <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {SEGMENTS.map((seg, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {seg.label}{seg.line2 ? " " + seg.line2 : ""} (×{seg.mult})
                  </span>
                </div>
                <span className="text-[10px] font-black" style={{ color: "#F5C518" }}>{PROBS[i]}</span>
              </div>
            ))}
            <div className="col-span-2 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>RTP: 95.00%</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom: Top Gagnants + Comment jouer ── */}
      <div className="mx-4 mb-4 grid grid-cols-2 gap-3 shrink-0">
        {/* Top Gagnants */}
        <div className="rounded-2xl p-3" style={{ background: "rgba(22,13,0,0.7)", border: "1px solid rgba(245,197,24,0.1)" }}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-2 flex items-center gap-1" style={{ color: "#F5C518" }}>
            🏆 Top Gagnants
          </p>
          {TOP_WINNERS.map((w, i) => (
            <div key={i} className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black" style={{ background: i === 0 ? "#F5C518" : i === 1 ? "#9ca3af" : "#d97706", color: "#1a0a00" }}>{i + 1}</span>
                <span className="text-[10px] font-bold truncate max-w-[60px]" style={{ color: "rgba(255,255,255,0.7)" }}>{w.name}</span>
              </div>
              <span className="text-[9px] font-black" style={{ color: "#F5C518" }}>{fFCShort(w.amount)}</span>
            </div>
          ))}
        </div>

        {/* Comment jouer */}
        <div className="rounded-2xl p-3" style={{ background: "rgba(22,13,0,0.7)", border: "1px solid rgba(245,197,24,0.1)" }}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: "#F5C518" }}>
            Comment jouer ?
          </p>
          {[
            "Choisissez votre mise",
            "Cliquez sur JOUER",
            "La roue tourne",
            "Le pointeur désigne votre gain",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-1.5 mb-1.5">
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 mt-0.5" style={{ background: "rgba(245,197,24,0.2)", color: "#F5C518", border: "1px solid rgba(245,197,24,0.3)" }}>{i + 1}</span>
              <span className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.5)" }}>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Promo banner ── */}
      <div className="mx-4 mb-6 rounded-2xl p-4 text-center shrink-0" style={{ background: "linear-gradient(135deg,rgba(120,53,15,0.6),rgba(217,119,6,0.3),rgba(120,53,15,0.6))", border: "1px solid rgba(245,197,24,0.25)" }}>
        <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "#fde68a" }}>
          Plus vous jouez, plus vous gagnez !
        </p>
        <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
          Jackpot à ×100 — Bonne chance, {playerLabel} !
        </p>
      </div>

    </div>
  );
}
