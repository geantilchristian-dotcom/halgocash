import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useBalance } from "@/lib/balance-context";
import { ArrowLeft, Loader2, ChevronDown, ChevronUp } from "lucide-react";

// ── Segments must match backend order exactly ────────────────────────────────
const SEGMENTS = [
  { label: "JACKPOT", mult: 100, color: "#16a34a", colorDark: "#14532d", textColor: "#fff"    },
  { label: "MÉGA",    mult: 25,  color: "#db2777", colorDark: "#831843", textColor: "#fff"    },
  { label: "GRAND",   mult: 10,  color: "#dc2626", colorDark: "#7f1d1d", textColor: "#fff"    },
  { label: "MAJEUR",  mult: 5,   color: "#d97706", colorDark: "#78350f", textColor: "#fff"    },
  { label: "MINEUR",  mult: 2,   color: "#0891b2", colorDark: "#164e63", textColor: "#fff"    },
  { label: "PETIT",   mult: 1,   color: "#6366f1", colorDark: "#312e81", textColor: "#fff"    },
  { label: "MINI",    mult: 0.5, color: "#7c3aed", colorDark: "#3b0764", textColor: "#fff"    },
  { label: "PERDU",   mult: 0,   color: "#374151", colorDark: "#111827", textColor: "#6b7280" },
] as const;

const SEG_COUNT = SEGMENTS.length;
const SEG_ANGLE = (2 * Math.PI) / SEG_COUNT;

type SpinState = "idle" | "pending" | "spinning" | "result";
interface HistoryEntry { mult: number; color: string }

const SEED_HISTORY: HistoryEntry[] = [
  { mult: 2, color: "#0891b2" }, { mult: 0, color: "#374151" }, { mult: 5,  color: "#d97706" },
  { mult: 1, color: "#6366f1" }, { mult: 0, color: "#374151" }, { mult: 10, color: "#dc2626" },
  { mult: 2, color: "#0891b2" }, { mult: 0, color: "#374151" }, { mult: 25, color: "#db2777" },
];


function fFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".") + " FC";
}

// ── Canvas wheel ─────────────────────────────────────────────────────────────
function drawWheel(
  canvas: HTMLCanvasElement,
  rotation: number,
  highlightIdx: number | null,
  spinning: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W  = canvas.width;
  const cx = W / 2;
  const cy = W / 2;
  const R    = cx * 0.91;
  const rimW = R * 0.09;
  const segR = R - rimW;
  const hubR = segR * 0.195;

  ctx.clearRect(0, 0, W, W);

  // Outer glow
  const glow = ctx.createRadialGradient(cx, cy, segR * 0.85, cx, cy, R * 1.25);
  glow.addColorStop(0, "rgba(245,197,24,0)");
  glow.addColorStop(0.5, spinning ? "rgba(245,197,24,0.22)" : "rgba(245,197,24,0.09)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.25, 0, 2 * Math.PI);
  ctx.fillStyle = glow;
  ctx.fill();

  // Golden rim
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

  // Rivets
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * 2 * Math.PI;
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

  // Segments
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

    // Text in segment
    const textR = hubR + (segR - hubR) * 0.55;
    const lx = cx + Math.cos(midAngle) * textR;
    const ly = cy + Math.sin(midAngle) * textR;
    const fs = W > 270 ? 9 : 7;
    const tC = isHl ? "#1a0a00" : seg.textColor;

    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Only JACKPOT shows its label; all others show only ×N
    if (seg.label === "JACKPOT") {
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.fillStyle = isHl ? "#1a0a00" : "#fff";
      ctx.fillText("JACKPOT", 0, -(fs * 0.9));
      ctx.font = `bold ${fs + 3}px sans-serif`;
      ctx.fillStyle = isHl ? "#1a0a00" : "#fff";
      ctx.fillText(`\u00D7${seg.mult}`, 0, fs * 0.8);
    } else {
      ctx.font = `bold ${fs + 3}px sans-serif`;
      ctx.fillStyle = tC;
      // ×0 shown as PERDU
      const display = seg.mult === 0 ? "PERDU" : `\u00D7${seg.mult}`;
      ctx.fillText(display, 0, 0);
    }

    ctx.restore();
  }

  // Hub
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

  // Pointer (downward triangle at top)
  const pW   = W * 0.058;
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function RouletteGame() {
  const [, setLocation] = useLocation();
  const { user, isLoaded } = useUser();
  const { balance: ctxBalance, setBalance, authFetch } = useBalance();
  const balance = ctxBalance ?? 0;
  const balanceLoaded = ctxBalance !== null;

  const [balFlash, setBalFlash]       = useState(false);
  const [betInput, setBetInput]       = useState("1000");
  const [spinState, setSpinState]     = useState<SpinState>("idle");
  const [resultIdx, setResultIdx]     = useState<number | null>(null);
  const [lastMult, setLastMult]       = useState<number | null>(null);
  const [lastWon, setLastWon]         = useState<number | null>(null);
  const [history, setHistory]         = useState<HistoryEntry[]>(SEED_HISTORY);
  const [error, setError]             = useState<string | null>(null);
  const [liveCount, setLiveCount]     = useState(() => 220 + Math.floor(Math.random() * 80));
  const [showHowTo, setShowHowTo]     = useState(false);

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef       = useRef<number | null>(null);
  const rotRef       = useRef(0);


  // ── Dynamic live count ──────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setLiveCount(n => {
        const delta = Math.floor(Math.random() * 7) - 3; // -3 to +3
        return Math.max(180, Math.min(400, n + delta));
      });
    }, 2500);
    return () => clearInterval(iv);
  }, []);

  // ── Canvas resize ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ro = new ResizeObserver(() => {
      const s = Math.min(container.clientWidth, container.clientHeight);
      canvas.width  = s;
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

  const betAmt  = Math.floor(parseFloat(betInput.replace(/[^\d.]/g, "")) || 0);
  const canSpin = spinState === "idle" && betAmt >= 100 && betAmt <= balance && balanceLoaded;

  // ── Animation — uses INTEGER number of extra rotations so the wheel always
  //    lands exactly on the correct segment. ─────────────────────────────────
  function animateTo(winIdx: number, onDone: () => void) {
    const segCenter = winIdx * SEG_ANGLE + SEG_ANGLE / 2;
    // Integer full rotations so (target + segCenter) is always an exact multiple of 2π
    const extraRotations = 8 + Math.floor(Math.random() * 4); // 8–11
    const extra = 2 * Math.PI * extraRotations;
    const cur   = rotRef.current;
    // Bring segCenter to angle 0 (= pointer at top, -π/2 in canvas)
    const rest   = ((cur + segCenter) % (2 * Math.PI));
    const target = cur + extra + (rest === 0 ? 0 : 2 * Math.PI - rest);
    const start  = performance.now();
    const dur    = 4200 + Math.random() * 900;

    function ease(t: number) { return 1 - Math.pow(1 - t, 4); }

    function tick(now: number) {
      const t = Math.min((now - start) / dur, 1);
      rotRef.current = cur + (target - cur) * ease(t);
      redraw(null, true);
      if (t < 1) { rafRef.current = requestAnimationFrame(tick); }
      else        { rotRef.current = target; onDone(); }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  // ── Spin ─────────────────────────────────────────────────────────────────────
  const spin = async () => {
    if (!canSpin) return;
    setSpinState("pending");
    setResultIdx(null);
    setLastMult(null);
    setLastWon(null);
    setError(null);

    let idx: number, mult: number, wonAmt: number, newBal: number;
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
      const d = await res.json() as { segmentIdx: number; multiplier: number; wonAmount: number; newBalance: number };
      idx = d.segmentIdx; mult = d.multiplier; wonAmt = d.wonAmount; newBal = d.newBalance;
    } catch {
      setError("Connexion perdue. Réessayez.");
      setSpinState("idle");
      return;
    }

    setBalance(balance - betAmt);
    setSpinState("spinning");

    animateTo(idx, () => {
      redraw(idx, false);
      setResultIdx(idx);
      setLastMult(mult);
      setLastWon(wonAmt);
      setSpinState("result");
      setBalance(newBal);

      if (mult > 0) {
        setBalFlash(true);
        setTimeout(() => setBalFlash(false), 700);
      }

      const seg = SEGMENTS[idx]!;
      setHistory(h => [{ mult, color: seg.color }, ...h].slice(0, 14));

      setTimeout(() => {
        setSpinState("idle");
        setResultIdx(null);
        setLastMult(null);
        setLastWon(null);
        setError(null);
        redraw(null, false);
      }, 2800);
    });
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const playerLabel = user?.username ?? user?.firstName ?? "Joueur";
  const gameId = useRef("#HR" + Math.floor(100000 + Math.random() * 900000)).current;
  void gameId;

  return (
    <div
      className="min-h-dvh flex flex-col select-none"
      style={{ background: "linear-gradient(160deg,#0d0a00 0%,#100c03 60%,#0d0a00 100%)", maxWidth: 480, margin: "0 auto" }}
    >

      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: "rgba(22,13,0,0.95)", borderBottom: "1px solid rgba(245,197,24,0.2)", backdropFilter: "blur(8px)" }}
      >
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
          <span
            className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse"
            style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)" }}
          >
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
                {fFC(balance)}
              </span>
          }
        </div>
      </header>

      {/* ── Live bar — players count only, no "JACKPOT 0.5%" ── */}
      <div
        className="flex items-center px-4 py-1.5 shrink-0"
        style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(245,197,24,0.06)" }}
      >
        <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
          <span style={{ color: "#F5C518", fontWeight: 900 }}>{liveCount}</span> joueurs en direct
        </span>
      </div>

      {/* ── History chips ── */}
      <div
        className="flex items-center gap-2 px-4 py-2 shrink-0"
        style={{ borderBottom: "1px solid rgba(245,197,24,0.07)" }}
      >
        <span className="text-[9px] font-black uppercase tracking-widest shrink-0" style={{ color: "rgba(255,255,255,0.22)" }}>
          Hist.
        </span>
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {history.map((h, i) => (
            <span
              key={i}
              className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-lg"
              style={{ background: h.color + "22", color: h.color, border: `1px solid ${h.color}55` }}
            >
              {h.mult === 0 ? "P" : `×${h.mult}`}
            </span>
          ))}
        </div>
      </div>

      {/* ── Wheel ── */}
      <div
        ref={containerRef}
        className="shrink-0 flex items-center justify-center px-5 py-3"
        style={{ height: 300 }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%", height: "100%", objectFit: "contain",
            filter: spinState === "spinning"
              ? "drop-shadow(0 0 18px rgba(245,197,24,0.45))"
              : "drop-shadow(0 4px 20px rgba(0,0,0,0.7))",
            transition: "filter 0.4s",
          }}
        />
      </div>

      {/* ── Result banner ── */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-2.5 rounded-2xl shrink-0" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <span className="text-[12px] font-bold" style={{ color: "#f87171" }}>{error}</span>
        </div>
      )}

      {lastMult !== null && (
        <div
          className="mx-4 mb-2 px-4 py-3 rounded-2xl flex items-center justify-between shrink-0"
          style={{
            background: lastMult > 0
              ? "linear-gradient(135deg,rgba(245,197,24,0.18),rgba(245,197,24,0.06))"
              : "rgba(239,68,68,0.08)",
            border: `1px solid ${lastMult > 0 ? "rgba(245,197,24,0.35)" : "rgba(239,68,68,0.25)"}`,
            boxShadow: lastMult >= 10 ? "0 0 24px rgba(245,197,24,0.15)" : "none",
          }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              {lastMult >= 100 ? "🎉 JACKPOT !" : lastMult >= 10 ? "✨ Excellent !" : lastMult > 1 ? "Bien joué !" : lastMult === 1 ? "Remboursé" : lastMult > 0 ? "Demi-mise récupérée" : "Perdu"}
            </p>
            <p className="text-[15px] font-black" style={{ color: lastMult > 0 ? "#F5C518" : "#f87171" }}>
              {lastMult === 0 ? "×0 — Perdu" : `×${lastMult}`}
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
      <div
        className="mx-4 mb-3 rounded-2xl overflow-hidden shrink-0"
        style={{ background: "rgba(22,13,0,0.9)", border: "1px solid rgba(245,197,24,0.15)" }}
      >
        <div className="px-4 pt-3 pb-1">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-center mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>MISE</p>

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

          <div className="flex gap-1.5 pb-3">
            {[
              { label: "MIN", action: () => setBetInput("100") },
              { label: "×2", action: () => setBetInput(v => String(Math.min(balance, Math.floor((parseFloat(v) || 0) * 2)))) },
              { label: "½",  action: () => setBetInput(v => String(Math.max(100, Math.floor((parseFloat(v) || 0) / 2)))) },
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
              {!balanceLoaded ? "CHARGEMENT…" : betAmt < 100 ? "MISE MIN 100 FC" : betAmt > balance ? "SOLDE INSUFFISANT" : "JOUER"}
            </button>
          )}
          {spinState === "pending" && (
            <button disabled className="w-full py-4 rounded-xl font-black uppercase tracking-[0.1em] text-[13px] flex items-center justify-center gap-2"
              style={{ background: "rgba(245,197,24,0.1)", color: "#F5C518", border: "1px solid rgba(245,197,24,0.25)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> VALIDATION…
            </button>
          )}
          {(spinState === "spinning" || spinState === "result") && (
            <button disabled className="w-full py-4 rounded-xl font-black uppercase tracking-[0.1em] text-[13px] flex items-center justify-center gap-2"
              style={{ background: "rgba(245,197,24,0.1)", color: "#F5C518", border: "1px solid rgba(245,197,24,0.25)" }}>
              <div className="w-4 h-4 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
              {spinState === "spinning" ? "LA ROUE TOURNE…" : "RÉSULTAT…"}
            </button>
          )}
        </div>
      </div>

      {/* ── Comment jouer — collapsible ── */}
      <div
        className="mx-4 mb-4 rounded-2xl overflow-hidden shrink-0"
        style={{ background: "rgba(22,13,0,0.7)", border: "1px solid rgba(245,197,24,0.1)" }}
      >
        <button
          className="w-full flex items-center justify-between px-4 py-3"
          onClick={() => setShowHowTo(v => !v)}
        >
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#F5C518" }}>
            Comment jouer ?
          </span>
          {showHowTo
            ? <ChevronUp style={{ width: 14, height: 14, color: "rgba(245,197,24,0.6)" }} />
            : <ChevronDown style={{ width: 14, height: 14, color: "rgba(245,197,24,0.6)" }} />}
        </button>
        {showHowTo && (
          <div className="px-4 pb-4 space-y-2">
            {[
              "Choisissez votre mise (min. 100 FC)",
              "Cliquez sur JOUER pour lancer la roue",
              "La roue tourne et s'arrête aléatoirement",
              "Le pointeur doré désigne votre gain",
              "Le JACKPOT (×100) est en vert — bonne chance !",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 mt-0.5"
                  style={{ background: "rgba(245,197,24,0.2)", color: "#F5C518", border: "1px solid rgba(245,197,24,0.3)" }}
                >{i + 1}</span>
                <span className="text-[11px] leading-tight" style={{ color: "rgba(255,255,255,0.6)" }}>{step}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Promo ── */}
      <div
        className="mx-4 mb-6 rounded-2xl p-4 text-center shrink-0"
        style={{ background: "linear-gradient(135deg,rgba(120,53,15,0.6),rgba(217,119,6,0.3),rgba(120,53,15,0.6))", border: "1px solid rgba(245,197,24,0.25)" }}
      >
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
