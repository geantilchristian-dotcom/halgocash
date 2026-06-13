import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Timer, Users2 } from "lucide-react";

// ── Formatters ────────────────────────────────────────────────────────────────
function formatFC(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/[\u00a0\s]/g, " ");
}

function formatTime(ms: number): string {
  const secs = Math.max(0, Math.floor(ms / 1000));
  const m    = Math.floor(secs / 60);
  const s    = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function multInfo(m: number) {
  if (m === 0)    return { text: "×0",   color: "#ef4444", glow: "#ef444460", emoji: "💸", win: false };
  if (m <= 1.15)  return { text: "×1.1", color: "#eab308", glow: "#eab30860", emoji: "🔄", win: true  };
  if (m <= 1.6)   return { text: "×1.5", color: "#22c55e", glow: "#22c55e60", emoji: "💎", win: true  };
  return              { text: "×2.5", color: "#F5C518", glow: "#F5C51860", emoji: "🏆", win: true  };
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface MyBet {
  caseIndex:  number;
  amount:     number;
  multiplier: number | null;
  payout:     number | null;
}

interface RoundData {
  roundId:        number;
  status:         "betting" | "closed";
  betsPerCase:    number[];
  timeLeft:       number;
  closesAt?:      string;
  multipliers?:   number[] | null;
  totalCollected?: number;
  totalPaid?:     number;
  closedAt?:      string | null;
  myBet?:         MyBet | null;
}

// ── Briefcase component ───────────────────────────────────────────────────────
function Case({
  index, totalBet, multiplier, isMyBet,
  selected, selectable, revealed, onClick,
}: {
  index:      number;
  totalBet:   number;
  multiplier?: number;
  isMyBet:    boolean;
  selected:   boolean;
  selectable: boolean;
  revealed:   boolean;
  onClick?:   () => void;
}) {
  const t         = revealed && multiplier !== undefined ? multInfo(multiplier) : null;
  const accent    = t?.color ?? (selected ? "#F5C518" : undefined);
  const borderClr = t?.color ?? (selected ? "#F5C518" : selectable ? "rgba(245,197,24,0.35)" : "rgba(255,255,255,0.1)");
  const bgClr     = t ? `${t.color}14` : selected ? "rgba(245,197,24,0.1)" : "rgba(255,255,255,0.04)";

  return (
    <button
      onClick={selectable ? onClick : undefined}
      disabled={!selectable}
      style={{
        border:     `2px solid ${borderClr}`,
        background: bgClr,
        borderRadius: 18,
        padding:    "18px 10px 14px",
        display:    "flex",
        flexDirection: "column",
        alignItems: "center",
        gap:        8,
        cursor:     selectable ? "pointer" : "default",
        transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        boxShadow:  t?.win || selected ? `0 0 22px ${t?.glow ?? "rgba(245,197,24,0.4)"}` : "none",
        position:   "relative",
        WebkitTapHighlightColor: "transparent",
        minHeight:  120,
      }}
    >
      {/* "MOI" badge */}
      {isMyBet && (
        <div style={{
          position: "absolute", top: 7, right: 9,
          fontSize: 8, fontWeight: 900, color: "#F5C518",
          background: "rgba(245,197,24,0.18)", borderRadius: 4, padding: "1px 5px",
          letterSpacing: "0.06em",
        }}>MOI</div>
      )}

      {/* Briefcase CSS icon */}
      <div style={{ position: "relative", width: 52, height: 44 }}>
        {/* Handle */}
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 22, height: 10,
          border: `2.5px solid ${accent ?? "rgba(255,255,255,0.35)"}`,
          borderBottom: "none",
          borderRadius: "7px 7px 0 0",
          transition: "border-color 0.35s",
        }} />
        {/* Body */}
        <div style={{
          position: "absolute", top: 8, left: 0, right: 0, bottom: 0,
          borderRadius: 10,
          border: `2px solid ${accent ?? "rgba(255,255,255,0.2)"}`,
          background: t ? `${t.color}1a` : selected ? "rgba(245,197,24,0.12)" : "rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.35s",
          overflow: "hidden",
        }}>
          {/* Latch */}
          {!revealed && (
            <div style={{
              position: "absolute",
              top: "40%", left: "50%", transform: "translateX(-50%)",
              width: 12, height: 8,
              borderRadius: 3,
              background: selected ? "#F5C518" : "rgba(255,255,255,0.2)",
              border: `1px solid ${selected ? "rgba(245,197,24,0.6)" : "rgba(255,255,255,0.1)"}`,
            }} />
          )}
          {revealed && t && (
            <span style={{ fontSize: 20, filter: `drop-shadow(0 0 8px ${t.glow})` }}>{t.emoji}</span>
          )}
          {!revealed && (
            <span style={{
              fontSize: 11, fontWeight: 900, letterSpacing: "0.04em",
              color: selected ? "#F5C518" : "rgba(255,255,255,0.4)",
              marginTop: 10,
            }}>N°{index + 1}</span>
          )}
        </div>
      </div>

      {/* Label below briefcase */}
      {revealed && t ? (
        <span style={{ fontSize: 14, fontWeight: 900, color: t.color, letterSpacing: "0.02em" }}>
          {t.text}
        </span>
      ) : (
        <div style={{ textAlign: "center" }}>
          {!revealed && <p style={{ fontSize: 10, fontWeight: 900, color: selected ? "#F5C518" : "rgba(255,255,255,0.3)", marginBottom: 2 }}>N°{index + 1}</p>}
          <p style={{ fontSize: 11, fontWeight: 700, color: totalBet > 0 ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.2)" }}>
            {totalBet > 0 ? `${formatFC(totalBet)} FC` : "—"}
          </p>
        </div>
      )}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const BET_PRESETS = [500, 1_000, 5_000, 10_000, 50_000];
type Phase = "loading" | "betting" | "waiting" | "closed";

export default function MalettePage() {
  const [, navigate]   = useLocation();
  const { getToken }   = useAuth();

  const authFetch = useCallback(async (url: string, opts: RequestInit = {}) => {
    const token   = await getToken().catch(() => null);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(opts.headers as Record<string, string> ?? {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...opts, headers });
  }, [getToken]);

  const [round,        setRound]        = useState<RoundData | null>(null);
  const [balance,      setBalance]      = useState<number | null>(null);
  const [selectedCase, setSelectedCase] = useState<number | null>(null);
  const [betInput,     setBetInput]     = useState("1000");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [timeLeft,     setTimeLeft]     = useState(0);
  const [phase,        setPhase]        = useState<Phase>("loading");

  const closesAtMs = useRef<number | null>(null);
  const pollTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Balance ────────────────────────────────────────────────────────────────
  const fetchBalance = useCallback(() => {
    authFetch("/api/auth/balance")
      .then(r => r.ok ? r.json() as Promise<{ balance: number }> : null)
      .then(d => { if (d) setBalance(d.balance); })
      .catch(() => {});
  }, [authFetch]);

  // ── Fetch round ────────────────────────────────────────────────────────────
  const fetchRound = useCallback(async () => {
    try {
      const res = await authFetch("/api/malette/round/current");
      if (!res.ok) return;
      const data = await res.json() as RoundData;
      setRound(data);

      if (data.status === "betting") {
        closesAtMs.current = data.closesAt ? new Date(data.closesAt).getTime() : null;
        setPhase(data.myBet ? "waiting" : "betting");
      } else {
        closesAtMs.current = null;
        setPhase("closed");
        fetchBalance();
      }
    } catch { /* network error — ignore */ }
  }, [authFetch, fetchBalance]);

  // Initial load
  useEffect(() => {
    void fetchRound();
    fetchBalance();
  }, [fetchRound, fetchBalance]);

  // Countdown timer (ticks every 500ms)
  useEffect(() => {
    const t = setInterval(() => {
      if (closesAtMs.current !== null) {
        setTimeLeft(Math.max(0, closesAtMs.current - Date.now()));
      }
    }, 500);
    return () => clearInterval(t);
  }, []);

  // Poll server every 3 seconds
  useEffect(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => { void fetchRound(); }, 3_000);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [fetchRound]);

  // ── Place bet ──────────────────────────────────────────────────────────────
  const handleBet = async () => {
    if (!round || round.status !== "betting") return;
    if (selectedCase === null) { setError("Choisissez une malette d'abord"); return; }
    const amount = parseInt(betInput.replace(/[\s\u00a0]/g, ""), 10);
    if (isNaN(amount) || amount < 100) { setError("Mise minimum : 100 FC"); return; }
    setError(null);
    setLoading(true);
    try {
      const res  = await authFetch("/api/malette/bet", {
        method: "POST",
        body:   JSON.stringify({ roundId: round.roundId, caseIndex: selectedCase, amount }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(json.error ?? "Erreur serveur"); return; }
      await fetchRound();
      fetchBalance();
    } finally {
      setLoading(false);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const myBet    = round?.myBet ?? null;
  const mults    = round?.multipliers ?? null;
  const revealed = phase === "closed" && Array.isArray(mults);
  const myMult   = revealed && myBet ? (mults?.[myBet.caseIndex] ?? 0) : null;
  const myPayout = myBet?.payout ?? null;
  const myWin    = myPayout !== null && myPayout > 0;
  const hotColor = phase !== "loading" && timeLeft < 10_000 && phase !== "closed";
  const totalPot = (round?.betsPerCase ?? []).reduce((a, b) => a + b, 0);

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: "linear-gradient(160deg,#060d0a 0%,#0b1e12 60%,#060d0a 100%)" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-2 shrink-0">
        <button
          onClick={() => navigate("/app")}
          className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
          style={{ width: 36, height: 36, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <ArrowLeft style={{ width: 18, height: 18, color: "rgba(255,255,255,0.8)" }} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-[16px] leading-tight tracking-tight">MALETTE SECRÈTE</p>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#F5C518" }}>
            Round collaboratif · 4 malettes
          </p>
        </div>
        {balance !== null && (
          <div className="text-right shrink-0">
            <p className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Solde</p>
            <p className="font-black text-[13px]" style={{ color: "#F5C518" }}>{formatFC(balance)} FC</p>
          </div>
        )}
      </div>

      {/* ── Timer bar ── */}
      <div
        className="mx-4 mb-3 rounded-xl px-4 py-2.5 flex items-center gap-3 shrink-0"
        style={{
          background: revealed ? "rgba(245,197,24,0.08)" : hotColor ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${revealed ? "rgba(245,197,24,0.25)" : hotColor ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
          transition: "all 0.5s",
        }}
      >
        <Timer style={{ width: 14, height: 14, flexShrink: 0, color: revealed ? "#F5C518" : hotColor ? "#ef4444" : "rgba(255,255,255,0.4)" }} />
        <p
          className="text-[12px] font-black flex-1"
          style={{ color: revealed ? "#F5C518" : hotColor ? "#ef4444" : "rgba(255,255,255,0.6)" }}
        >
          {phase === "loading" && "Chargement…"}
          {phase === "betting" && `Paris ouverts · ${formatTime(timeLeft)}`}
          {phase === "waiting" && `Pari enregistré · ${formatTime(timeLeft)}`}
          {phase === "closed"  && "✨ Résultats du round"}
        </p>
        {totalPot > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <Users2 style={{ width: 11, height: 11, color: "rgba(255,255,255,0.3)" }} />
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              {formatFC(totalPot)} FC
            </span>
          </div>
        )}
      </div>

      {/* ── 4 Briefcases (2×2) ── */}
      <div className="flex-1 px-4 flex flex-col justify-center gap-4">
        <div className="grid grid-cols-2 gap-3 mx-auto w-full max-w-xs">
          {Array.from({ length: 4 }).map((_, i) => (
            <Case
              key={i}
              index={i}
              totalBet={round?.betsPerCase?.[i] ?? 0}
              multiplier={mults?.[i] ?? undefined}
              isMyBet={myBet?.caseIndex === i}
              selected={selectedCase === i && phase === "betting" && !myBet}
              selectable={phase === "betting" && !myBet}
              revealed={revealed}
              onClick={() => { setSelectedCase(i); setError(null); }}
            />
          ))}
        </div>

        {/* ── Result card ── */}
        {phase === "closed" && myBet && myMult !== null && (
          <div
            className="mx-auto w-full max-w-xs rounded-2xl px-4 py-4 text-center"
            style={{
              background: myWin ? "rgba(245,197,24,0.08)" : "rgba(239,68,68,0.08)",
              border:     `1.5px solid ${myWin ? "rgba(245,197,24,0.35)" : "rgba(239,68,68,0.3)"}`,
              boxShadow:  myWin ? "0 0 28px rgba(245,197,24,0.15)" : "none",
            }}
          >
            <p className="text-2xl mb-1">{myWin ? "✨" : "😔"}</p>
            <p className="font-black text-[20px]" style={{ color: myWin ? "#F5C518" : "#ef4444" }}>
              {myWin ? `+${formatFC(myPayout ?? 0)} FC` : "Perdu"}
            </p>
            <p className="text-[11px] mt-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              {myWin
                ? `Malette N°${myBet.caseIndex + 1} · ×${myMult} — mise de ${formatFC(myBet.amount)} FC`
                : `Malette N°${myBet.caseIndex + 1} était vide — mise de ${formatFC(myBet.amount)} FC`}
            </p>
          </div>
        )}

        {phase === "closed" && !myBet && (
          <div
            className="mx-auto w-full max-w-xs rounded-2xl px-4 py-3 text-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              Vous n'avez pas misé sur ce round · Nouveau round dans quelques secondes…
            </p>
          </div>
        )}
      </div>

      {/* ── Bottom panel ── */}
      <div
        className="shrink-0 px-4 pt-4 rounded-t-3xl"
        style={{
          background:     "rgba(10,20,14,0.96)",
          border:         "1px solid rgba(255,255,255,0.07)",
          borderBottom:   "none",
          backdropFilter: "blur(16px)",
          paddingBottom:  "max(16px, env(safe-area-inset-bottom))",
        }}
      >
        {/* Mise form — uniquement si pas encore misé */}
        {phase === "betting" && !myBet && (
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
              {selectedCase !== null
                ? `Malette N°${selectedCase + 1} · Choisissez votre mise`
                : "👆 Tapez sur une malette pour la choisir"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {BET_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => setBetInput(String(p))}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-black transition-all active:scale-95"
                  style={{
                    background: betInput === String(p) ? "rgba(245,197,24,0.2)" : "rgba(255,255,255,0.05)",
                    border:     `1px solid ${betInput === String(p) ? "#F5C518" : "rgba(255,255,255,0.1)"}`,
                    color:      betInput === String(p) ? "#F5C518" : "rgba(255,255,255,0.6)",
                  }}
                >{formatFC(p)} FC</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={betInput}
                onChange={e => setBetInput(e.target.value)}
                placeholder="Montant (FC)"
                className="flex-1 rounded-xl px-4 py-3 text-white font-bold text-[14px] outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
              />
              <button
                onClick={() => { void handleBet(); }}
                disabled={loading || selectedCase === null}
                className="px-5 py-3 rounded-xl font-black text-[13px] uppercase tracking-wide flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg,#c8921a 0%,#F5C518 100%)",
                  color: "#000", boxShadow: "0 4px 14px rgba(245,197,24,0.3)", minWidth: 96,
                }}
              >
                {loading
                  ? <Loader2 className="animate-spin" style={{ width: 18, height: 18 }} />
                  : <>🧳 Miser</>}
              </button>
            </div>
            {error && <p className="text-[11px]" style={{ color: "#ef4444" }}>{error}</p>}
          </div>
        )}

        {/* En attente du résultat */}
        {(phase === "waiting" || (phase === "betting" && myBet)) && myBet && (
          <div
            className="py-3 px-4 rounded-2xl text-center"
            style={{ background: "rgba(245,197,24,0.07)", border: "1px solid rgba(245,197,24,0.15)" }}
          >
            <p className="font-black text-[13px]" style={{ color: "rgba(245,197,24,0.85)" }}>
              🧳 Malette N°{myBet.caseIndex + 1} · {formatFC(myBet.amount)} FC misés
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              En attente du résultat…
            </p>
          </div>
        )}

        {/* Distribution des multiplicateurs */}
        <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.22)" }}>
            Distribution
          </p>
          <div className="flex gap-3">
            {[
              { label: "×0",   color: "#ef4444", qty: 2 },
              { label: "×1.1", color: "#eab308", qty: 1 },
              { label: "×2.5", color: "#F5C518", qty: 1 },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-1">
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.color }} />
                <span style={{ fontSize: 10, color: t.color, fontWeight: 900 }}>{t.label}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>×{t.qty}</span>
              </div>
            ))}
          </div>
        </div>

        {phase === "loading" && (
          <div className="flex items-center justify-center py-4 gap-2">
            <Loader2 className="animate-spin" style={{ width: 18, height: 18, color: "#F5C518" }} />
            <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>Chargement du round…</span>
          </div>
        )}
      </div>
    </div>
  );
}
