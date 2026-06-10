import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import { ArrowLeft, CircleDot, Users, Loader2 } from "lucide-react";

// ── Wheel segments (must match server SEGMENT_LABELS order) ─────────────────
const SEGMENTS = [
  { label: "0",  color: "#16a34a", text: "#fff"  },
  { label: "7",  color: "#dc2626", text: "#fff"  },
  { label: "4",  color: "#1a1a2e", text: "#fff"  },
  { label: "11", color: "#dc2626", text: "#fff"  },
  { label: "2",  color: "#1a1a2e", text: "#fff"  },
  { label: "15", color: "#dc2626", text: "#fff"  },
  { label: "6",  color: "#1a1a2e", text: "#fff"  },
  { label: "13", color: "#dc2626", text: "#fff"  },
  { label: "8",  color: "#1a1a2e", text: "#fff"  },
  { label: "19", color: "#dc2626", text: "#fff"  },
  { label: "10", color: "#1a1a2e", text: "#fff"  },
  { label: "21", color: "#dc2626", text: "#fff"  },
  { label: "12", color: "#1a1a2e", text: "#fff"  },
  { label: "17", color: "#dc2626", text: "#fff"  },
  { label: "14", color: "#1a1a2e", text: "#fff"  },
  { label: "23", color: "#dc2626", text: "#fff"  },
  { label: "16", color: "#1a1a2e", text: "#fff"  },
  { label: "25", color: "#dc2626", text: "#fff"  },
];

const SEG_COUNT = SEGMENTS.length;
const SEG_ANGLE = (2 * Math.PI) / SEG_COUNT;

type BetType = "rouge" | "noir" | "vert" | null;
type SpinState = "idle" | "pending" | "spinning" | "result";

interface HistoryEntry { label: string; color: string; won: boolean }

// ── Helpers ─────────────────────────────────────────────────────────────────
function fFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".") + " FC";
}
function segmentColor(label: string): string {
  if (label === "0") return "#16a34a";
  return parseInt(label) % 2 === 1 ? "#dc2626" : "#1a1a2e";
}

// ── Canvas draw ─────────────────────────────────────────────────────────────
function drawWheel(
  canvas: HTMLCanvasElement,
  rotation: number,
  highlightIdx: number | null,
  spinning: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const outerR = cx - 6;
  const innerR = outerR * 0.38;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 5, 0, 2 * Math.PI);
  ctx.fillStyle = "#1c1c2e";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 4, 0, 2 * Math.PI);
  ctx.strokeStyle = "#F5C518";
  ctx.lineWidth = 3;
  ctx.stroke();

  for (let i = 0; i < SEG_COUNT; i++) {
    const startAngle = rotation + i * SEG_ANGLE - Math.PI / 2;
    const endAngle = startAngle + SEG_ANGLE;
    const seg = SEGMENTS[i]!;
    const isHl = highlightIdx === i;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = isHl ? "#facc15" : seg.color;
    ctx.fill();
    ctx.strokeStyle = "#2a2a3e";
    ctx.lineWidth = 1;
    ctx.stroke();

    const midAngle = startAngle + SEG_ANGLE / 2;
    const labelR = outerR * 0.72;
    const lx = cx + Math.cos(midAngle) * labelR;
    const ly = cy + Math.sin(midAngle) * labelR;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.font = `bold ${outerR > 110 ? 11 : 9}px monospace`;
    ctx.fillStyle = isHl ? "#1a1a1a" : seg.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(seg.label, 0, 0);
    ctx.restore();
  }

  const hubGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
  hubGrad.addColorStop(0, "#2a1a00");
  hubGrad.addColorStop(1, "#1c1c2e");
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.strokeStyle = "#F5C518";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `bold ${Math.floor(innerR * 0.45)}px sans-serif`;
  ctx.fillStyle = "#F5C518";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("HG", cx, cy);

  const pSize = 14;
  ctx.beginPath();
  ctx.moveTo(cx - pSize * 0.6, cy - outerR - 3);
  ctx.lineTo(cx + pSize * 0.6, cy - outerR - 3);
  ctx.lineTo(cx, cy - outerR + pSize);
  ctx.closePath();
  ctx.fillStyle = spinning ? "#facc15" : "#fff";
  ctx.shadowColor = spinning ? "#facc15" : "transparent";
  ctx.shadowBlur = spinning ? 8 : 0;
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ── Fake live players ────────────────────────────────────────────────────────
const FAKE_PLAYERS = [
  "Pro#5541","User#7731","VIP#4422","Joueur#9921","Player#3312",
  "User#6614","Joueur#0087","Client#5505","VIP#1199","User#3374",
];
type LiveEntry = { id: string; bet: string; result: string; won: boolean; ts: number }

// ── Component ────────────────────────────────────────────────────────────────
export default function RouletteGame() {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();

  // ── Auth fetch helper ──────────────────────────────────────────────────────
  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = await getToken().catch(() => null);
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string> | undefined ?? {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...options, headers, credentials: "include" });
  }, [getToken]);

  const [balance, setBalance] = useState(0);
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const [balanceFlash, setBalanceFlash] = useState(false);

  const [betType, setBetType] = useState<BetType>(null);
  const [betInput, setBetInput] = useState("1000");
  const [spinState, setSpinState] = useState<SpinState>("idle");
  const [rotation, setRotation] = useState(0);
  const [resultIdx, setResultIdx] = useState<number | null>(null);
  const [resultLabel, setResultLabel] = useState<string | null>(null);
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [liveEntries, setLiveEntries] = useState<LiveEntry[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const rotRef = useRef(0);

  // ── Load real balance ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    authFetch("/api/auth/balance")
      .then(r => r.json())
      .then((d: { balance: number }) => {
        setBalance(d.balance);
        setBalanceLoaded(true);
      })
      .catch(() => setBalanceLoaded(true));
  }, [isLoaded, authFetch]);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ro = new ResizeObserver(() => {
      const size = Math.min(container.clientWidth, container.clientHeight);
      canvas.width = size;
      canvas.height = size;
      drawWheel(canvas, rotRef.current, resultIdx, spinState === "spinning");
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [resultIdx, spinState]);

  // Draw loop
  const draw = useCallback((hl: number | null, sp: boolean) => {
    const canvas = canvasRef.current;
    if (canvas) drawWheel(canvas, rotRef.current, hl, sp);
  }, []);

  // Initial draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && canvas.width > 0) drawWheel(canvas, 0, null, false);
  }, []);

  const betAmt = parseInt(betInput.replace(/\D/g, ""), 10) || 0;
  const canSpin = spinState === "idle" && betType !== null && betAmt >= 100 && betAmt <= balance && balanceLoaded;

  function animateTo(winningIdx: number, onDone: () => void) {
    const segCenterAngle = winningIdx * SEG_ANGLE + SEG_ANGLE / 2;
    const totalSpins = 6 + Math.random() * 3;
    const extraAngle = 2 * Math.PI * totalSpins;
    const current = rotRef.current;
    const targetRot = current + extraAngle + (2 * Math.PI - ((current + segCenterAngle) % (2 * Math.PI)));
    const startTime = performance.now();
    const duration = 4000 + Math.random() * 1000;

    function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }

    function animate(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      rotRef.current = current + (targetRot - current) * easeOut(t);
      draw(null, true);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rotRef.current = targetRot;
        onDone();
      }
    }
    rafRef.current = requestAnimationFrame(animate);
  }

  const spin = async () => {
    if (!canSpin) return;
    setSpinState("pending");
    setResultIdx(null);
    setResultLabel(null);
    setWinAmount(null);
    setMsg(null);
    setError(null);

    let segmentIdx: number;
    let result: string;
    let won: boolean;
    let wonAmount: number;
    let newBalance: number;

    try {
      const res = await authFetch("/api/roulette/spin", {
        method: "POST",
        body: JSON.stringify({ betType, amount: betAmt }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        setError(err.error ?? "Erreur serveur");
        setSpinState("idle");
        return;
      }
      const data = await res.json() as { segmentIdx: number; result: string; won: boolean; wonAmount: number; newBalance: number };
      segmentIdx = data.segmentIdx;
      result     = data.result;
      won        = data.won;
      wonAmount  = data.wonAmount;
      newBalance = data.newBalance;
    } catch {
      setError("Connexion perdue. Réessayez.");
      setSpinState("idle");
      return;
    }

    // Deduct from display immediately
    setBalance(b => b - betAmt);
    setSpinState("spinning");

    animateTo(segmentIdx, () => {
      draw(segmentIdx, false);
      setResultIdx(segmentIdx);
      setResultLabel(result);
      setSpinState("result");
      setBalance(newBalance);

      if (won) {
        setWinAmount(wonAmount);
        setBalanceFlash(true);
        setTimeout(() => setBalanceFlash(false), 600);
        setMsg(`${result} — Vous gagnez +${fFC(wonAmount)} !`);
      } else {
        setWinAmount(0);
        setMsg(`${result} — Perdu`);
      }

      const c = segmentColor(result);
      setHistory(h => [{ label: result, color: c, won }, ...h].slice(0, 14));

      // Add fake live entries
      const fakeCount = 2 + Math.floor(Math.random() * 3);
      const newLive: LiveEntry[] = Array.from({ length: fakeCount }, (_, i) => {
        const fakeBets = ["rouge", "noir", "vert"] as const;
        const fb = fakeBets[Math.floor(Math.random() * 3)]!;
        const fmult = fb === "vert" ? (result === "0" ? 14 : 0) : (fb === "rouge" ? (parseInt(result) % 2 === 1 && result !== "0" ? 2 : 0) : (parseInt(result) % 2 === 0 && result !== "0" ? 2 : 0));
        return { id: FAKE_PLAYERS[Math.floor(Math.random() * FAKE_PLAYERS.length)]!, bet: fb, result, won: fmult > 0, ts: Date.now() + i };
      });
      setLiveEntries(prev => [...newLive, ...prev].slice(0, 6));

      setTimeout(() => {
        setSpinState("idle");
        setResultIdx(null);
        setResultLabel(null);
        setMsg(null);
        draw(null, false);
      }, 2500);
    });
  };

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const quickAmounts = [500, 1000, 2000, 5000];
  const betLabel = { rouge: "Rouge ×2", noir: "Noir ×2", vert: "Vert ×14" };
  const betBg = {
    rouge: "linear-gradient(135deg,#7f1d1d,#dc2626)",
    noir: "linear-gradient(135deg,#111,#1a1a2e)",
    vert: "linear-gradient(135deg,#14532d,#16a34a)",
  };

  const playerLabel = user?.username ?? user?.firstName ?? "Joueur";

  return (
    <div
      className="min-h-dvh flex flex-col select-none"
      style={{ background: "#0d0a00", maxWidth: 480, margin: "0 auto" }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: "#160d00", borderBottom: "1px solid rgba(245,197,24,0.18)" }}
      >
        <button
          onClick={() => setLocation("/app")}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <ArrowLeft style={{ width: 18, height: 18, color: "rgba(255,255,255,0.7)" }} />
        </button>

        <div className="flex items-center gap-2">
          <CircleDot style={{ width: 18, height: 18, color: "#F5C518" }} />
          <span className="font-black tracking-wide" style={{ fontSize: "1rem", color: "#fff" }}>
            HALGO <span style={{ color: "#F5C518" }}>ROULETTE</span>
          </span>
          <span
            className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase"
            style={{ background: "rgba(245,197,24,0.15)", color: "#F5C518", border: "1px solid rgba(245,197,24,0.3)" }}
          >
            LIVE
          </span>
        </div>

        <div className="flex flex-col items-end gap-0.5">
          <div
            className="flex items-center gap-1.5 px-3 h-8 rounded-full transition-all"
            style={{
              background: balanceFlash ? "rgba(245,197,24,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${balanceFlash ? "rgba(245,197,24,0.5)" : "rgba(255,255,255,0.1)"}`,
              transition: "all 0.3s",
            }}
          >
            {!balanceLoaded
              ? <Loader2 style={{ width: 12, height: 12, color: "#F5C518" }} className="animate-spin" />
              : <span className="font-black text-[11px]" style={{ color: balanceFlash ? "#F5C518" : "#fff" }}>
                  {fFC(balance)} <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>FC</span>
                </span>
            }
          </div>
          <span className="text-[9px] font-black tracking-wide" style={{ color: "rgba(245,197,24,0.6)" }}>
            {playerLabel}
          </span>
        </div>
      </header>

      {/* ── Wheel ── */}
      <div
        ref={containerRef}
        className="shrink-0 flex items-center justify-center px-6 py-4"
        style={{ height: 280 }}
      >
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="mx-4 px-4 py-2 rounded-2xl shrink-0"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          <span className="text-[12px] font-bold" style={{ color: "#f87171" }}>{error}</span>
        </div>
      )}

      {/* ── Result message ── */}
      {msg && (
        <div
          className="mx-4 px-4 py-3 rounded-2xl flex items-center justify-between shrink-0 transition-all"
          style={{
            background: winAmount && winAmount > 0
              ? "linear-gradient(135deg,rgba(245,197,24,0.15),rgba(245,197,24,0.05))"
              : "rgba(239,68,68,0.08)",
            border: `1px solid ${winAmount && winAmount > 0 ? "rgba(245,197,24,0.3)" : "rgba(239,68,68,0.2)"}`,
          }}
        >
          <span className="text-[12px] font-black text-white">{msg}</span>
          {winAmount !== null && winAmount > 0 && (
            <span className="font-black" style={{ color: "#F5C518", fontSize: "1rem" }}>
              +{fFC(winAmount)}
            </span>
          )}
        </div>
      )}

      {/* ── History row ── */}
      <div
        className="flex items-center gap-2 px-4 py-2 shrink-0 mt-1"
        style={{ background: "rgba(245,197,24,0.03)", borderTop: "1px solid rgba(245,197,24,0.06)" }}
      >
        <span className="text-[9px] font-black uppercase tracking-widest shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
          Historique
        </span>
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {history.map((h, i) => (
            <span
              key={i}
              className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-lg"
              style={{
                background: h.color + "22",
                color: h.color === "#1a1a2e" ? "#aaa" : h.color,
                border: `1px solid ${h.color}44`,
              }}
            >
              {h.label}
            </span>
          ))}
          {history.length === 0 && (
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
          )}
        </div>
      </div>

      {/* ── Live feed ── */}
      {liveEntries.length > 0 && (
        <div
          className="mx-4 mt-2 px-3 py-2 rounded-xl shrink-0 space-y-1"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          {liveEntries.slice(0, 4).map((e) => (
            <div key={e.ts} className="flex items-center justify-between gap-2 animate-slide-in">
              <span className="text-[10px] font-bold truncate flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#facc15", flexShrink: 0, display: "inline-block" }} />
                {e.id}
              </span>
              <span className="text-[10px] font-bold shrink-0" style={{
                color: e.bet === "rouge" ? "#dc2626" : e.bet === "vert" ? "#16a34a" : "#aaa"
              }}>
                {e.bet}
              </span>
              <span className="text-[10px] font-black shrink-0" style={{ color: e.won ? "#F5C518" : "rgba(255,255,255,0.35)" }}>
                {e.won ? `+${resultLabel === "0" ? "14" : "2"}×` : "perdu"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Bet panel ── */}
      <div
        className="mt-3 mx-4 mb-4 rounded-2xl overflow-hidden shrink-0"
        style={{ background: "#160d00", border: "1px solid rgba(245,197,24,0.12)" }}
      >
        <div className="p-3 grid grid-cols-3 gap-2" style={{ borderBottom: "1px solid rgba(245,197,24,0.08)" }}>
          {(["rouge", "noir", "vert"] as BetType[]).map((b) => (
            <button
              key={b!}
              onClick={() => spinState === "idle" && setBetType(b)}
              disabled={spinState === "spinning" || spinState === "pending"}
              className="py-3 rounded-xl font-black text-[11px] uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: betType === b
                  ? betBg[b!]
                  : "rgba(255,255,255,0.04)",
                color: betType === b
                  ? "#fff"
                  : b === "rouge" ? "#dc2626" : b === "vert" ? "#16a34a" : "#888",
                border: betType === b
                  ? "1px solid transparent"
                  : `1px solid ${b === "rouge" ? "#dc262640" : b === "vert" ? "#16a34a40" : "#33333380"}`,
                boxShadow: betType === b
                  ? `0 4px 14px ${b === "rouge" ? "#dc262650" : b === "vert" ? "#16a34a50" : "#00000080"}`
                  : "none",
              }}
            >
              {betLabel[b!]}
            </button>
          ))}
        </div>

        <div className="px-4 pt-3 pb-4 space-y-3">
          <div
            className="flex items-center rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(245,197,24,0.15)" }}
          >
            <button
              onClick={() => setBetInput(v => String(Math.max(100, (parseInt(v) || 0) - 500)))}
              disabled={spinState !== "idle"}
              className="w-10 h-10 flex items-center justify-center font-black text-lg transition-all active:scale-90 disabled:opacity-30"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >−</button>
            <input
              type="number"
              value={betInput}
              onChange={e => setBetInput(e.target.value)}
              disabled={spinState !== "idle"}
              className="flex-1 bg-transparent text-center font-black text-white outline-none disabled:opacity-50"
              style={{ fontSize: "1rem" }}
              min={100}
            />
            <button
              onClick={() => setBetInput(v => String((parseInt(v) || 0) + 500))}
              disabled={spinState !== "idle"}
              className="w-10 h-10 flex items-center justify-center font-black text-lg transition-all active:scale-90 disabled:opacity-30"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >+</button>
          </div>

          <div className="flex gap-1.5">
            {quickAmounts.map(a => (
              <button
                key={a}
                onClick={() => setBetInput(String(a))}
                disabled={spinState !== "idle"}
                className="flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 disabled:opacity-30"
                style={{ background: "rgba(245,197,24,0.08)", color: "#F5C518", border: "1px solid rgba(245,197,24,0.15)" }}
              >
                {a >= 1000 ? `${a / 1000}K` : a}
              </button>
            ))}
            <button
              onClick={() => setBetInput(String(Math.floor(balance)))}
              disabled={spinState !== "idle"}
              className="flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 disabled:opacity-30"
              style={{ background: "rgba(245,197,24,0.08)", color: "#F5C518", border: "1px solid rgba(245,197,24,0.15)" }}
            >MAX</button>
          </div>

          {spinState === "idle" && (
            <button
              onClick={() => void spin()}
              disabled={!canSpin}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] transition-all active:scale-[0.97] disabled:opacity-40"
              style={{
                background: canSpin ? "linear-gradient(135deg,#92400e,#F5C518)" : "rgba(255,255,255,0.06)",
                color: canSpin ? "#1a0a00" : "rgba(255,255,255,0.4)",
                boxShadow: canSpin ? "0 4px 20px rgba(245,197,24,0.35)" : "none",
              }}
            >
              {!balanceLoaded ? "CHARGEMENT…" : !betType ? "CHOISISSEZ UNE MISE" : betAmt < 100 ? "MISE MIN 100 FC" : betAmt > balance ? "SOLDE INSUFFISANT" : `🎰 LANCER · ${fFC(betAmt)}`}
            </button>
          )}

          {spinState === "pending" && (
            <button disabled className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px]"
              style={{ background: "rgba(245,197,24,0.12)", color: "#F5C518", border: "1px solid rgba(245,197,24,0.3)" }}>
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                VALIDATION…
              </div>
            </button>
          )}

          {spinState === "spinning" && (
            <button disabled className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px]"
              style={{ background: "rgba(245,197,24,0.12)", color: "#F5C518", border: "1px solid rgba(245,197,24,0.3)" }}>
              <div className="flex items-center justify-center gap-2">
                <CircleDot className="w-4 h-4 animate-spin" />
                EN ROTATION…
              </div>
            </button>
          )}

          {spinState === "result" && (
            <button disabled className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-[13px] opacity-60"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
              PROCHAIN TOUR DANS 2s…
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 pb-4">
        <Users style={{ width: 10, height: 10, color: "rgba(245,197,24,0.6)" }} />
        <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>
          {Math.floor(420 + Math.random() * 60)} joueurs en ligne
        </span>
      </div>

      <style>{`
        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
