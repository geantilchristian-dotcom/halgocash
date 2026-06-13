import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";

// ── Formatters ────────────────────────────────────────────────────────────────
function formatFC(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/[\u00a0\s]/g, " ");
}

function formatTime(ms: number): string {
  const secs = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function multInfo(m: number) {
  if (m === 0)   return { text: "×0",   color: "#ef4444", bg: "#fef2f2", win: false };
  if (m <= 1.15) return { text: "×1.1", color: "#d97706", bg: "#fffbeb", win: true  };
  if (m <= 1.6)  return { text: "×1.5", color: "#16a34a", bg: "#f0fdf4", win: true  };
  return             { text: "×2.5", color: "#b45309", bg: "#fef3c7", win: true  };
}

// ── 4 briefcase color schemes ─────────────────────────────────────────────────
const SCHEMES = [
  { body: "#1a1a2e", accent: "#F5C518", shadow: "rgba(245,197,24,0.35)" },
  { body: "#7b0e1b", accent: "#FFD060", shadow: "rgba(255,208,96,0.35)"  },
  { body: "#0d2f5b", accent: "#60C0FF", shadow: "rgba(96,192,255,0.35)"  },
  { body: "#3a0b5e", accent: "#CC88FF", shadow: "rgba(204,136,255,0.35)" },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface MyBet { caseIndex: number; amount: number; multiplier: number | null; payout: number | null; }
interface RoundData {
  roundId: number; status: "betting" | "closed";
  betsPerCase: number[]; timeLeft: number; closesAt?: string;
  multipliers?: number[] | null; totalCollected?: number; totalPaid?: number;
  closedAt?: string | null;
  myBet?: MyBet | null;
  myBets?: MyBet[];
}
interface HistoryEntry { roundId: number; multipliers: number[] | null; closedAt: string | null; }
type Phase = "loading" | "betting" | "waiting" | "locking" | "spinning" | "closed";

// ── CSS Briefcase ─────────────────────────────────────────────────────────────
function CaseSVG({ scheme, number, dim }: { scheme: typeof SCHEMES[0]; number: number; dim: boolean }) {
  const { body, accent } = scheme;
  const op = dim ? 0.35 : 1;
  return (
    <svg viewBox="0 0 100 86" style={{ width: "100%", height: "100%", opacity: op, transition: "opacity 0.3s" }}>
      {/* Handle */}
      <path d="M36 22 Q36 10 50 10 Q64 10 64 22" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      {/* Body shadow */}
      <rect x="6" y="22" width="88" height="60" rx="10" fill="rgba(0,0,0,0.18)" transform="translate(2,3)" />
      {/* Body */}
      <rect x="6" y="22" width="88" height="60" rx="10" fill={body} />
      {/* Shine */}
      <rect x="6" y="22" width="88" height="20" rx="10" fill="rgba(255,255,255,0.07)" />
      {/* Horizontal divider */}
      <rect x="6" y="50" width="88" height="4" fill={accent} opacity="0.55" />
      {/* Clasp outer */}
      <rect x="39" y="43" width="22" height="18" rx="5" fill={accent} />
      {/* Clasp inner */}
      <rect x="43" y="47" width="14" height="10" rx="3" fill={body} />
      {/* Number */}
      <text x="50" y="75" textAnchor="middle" fill={accent} fontSize="13" fontWeight="900" fontFamily="system-ui,sans-serif">
        N°{number}
      </text>
    </svg>
  );
}

function CaseCard({
  index, totalBet, multiplier, isMyBet, selected, selectable, revealed, spinning, spinDelay, onClick,
}: {
  index: number; totalBet: number; multiplier?: number; isMyBet: boolean;
  selected: boolean; selectable: boolean; revealed: boolean; spinning: boolean;
  spinDelay: number; onClick?: () => void;
}) {
  const scheme = SCHEMES[index]!;
  const info = revealed && multiplier !== undefined ? multInfo(multiplier) : null;
  const borderColor = info ? info.color : selected ? "#16a34a" : "rgba(0,0,0,0.10)";
  const bgColor = info ? info.bg : selected ? "#f0fdf4" : "#f8f9fa";
  const glow = (selected || info?.win) ? `0 0 0 3px ${selected ? "#16a34a40" : info?.color + "40"}` : "none";

  return (
    <button
      onClick={selectable ? onClick : undefined}
      disabled={!selectable}
      style={{
        border: `2px solid ${borderColor}`,
        background: bgColor,
        borderRadius: 16,
        padding: "10px 8px 8px",
        display: "flex", flexDirection: "column", alignItems: "center",
        cursor: selectable ? "pointer" : "default",
        transition: spinning ? "none" : "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        boxShadow: glow,
        position: "relative",
        WebkitTapHighlightColor: "transparent",
        width: "100%", height: "100%",
        animation: spinning ? `mshake 0.5s ease-in-out ${spinDelay}ms 3 both` : undefined,
      }}
    >
      {isMyBet && (
        <div style={{
          position: "absolute", top: 6, right: 7,
          fontSize: 8, fontWeight: 900, color: "#16a34a",
          background: "#dcfce7", borderRadius: 4, padding: "1px 5px",
        }}>MOI</div>
      )}

      {/* Briefcase SVG filling the cell */}
      <div style={{ flex: 1, width: "100%", padding: "0 4px", position: "relative" }}>
        <CaseSVG scheme={scheme} number={index + 1} dim={revealed && !info?.win} />
        {spinning && (
          <span style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 26, fontWeight: 900, color: scheme.accent,
            animation: "mq 0.4s ease-in-out infinite alternate",
            filter: `drop-shadow(0 0 8px ${scheme.shadow})`,
          }}>?</span>
        )}
        {revealed && info && (
          <div style={{
            position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)",
            background: info.color, borderRadius: 6, padding: "2px 10px",
            fontSize: 13, fontWeight: 900, color: "#fff", whiteSpace: "nowrap",
            boxShadow: `0 2px 8px ${info.color}60`,
          }}>{info.text}</div>
        )}
      </div>

      {/* Bottom label */}
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: totalBet > 0 ? "#374151" : "#d1d5db", margin: 0 }}>
          {spinning ? "…" : totalBet > 0 ? `${formatFC(totalBet)} FC` : "—"}
        </p>
      </div>
    </button>
  );
}

// ── History chip ──────────────────────────────────────────────────────────────
function HistoryChip({ entry }: { entry: HistoryEntry }) {
  const mults = entry.multipliers ?? [];
  const best = mults.length > 0 ? Math.max(...mults) : null;
  const info = best !== null ? multInfo(best) : null;
  const winCase = mults.indexOf(best ?? -1) + 1;
  return (
    <div style={{
      flexShrink: 0,
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 2, padding: "4px 8px", borderRadius: 8,
      background: info ? info.bg : "#f3f4f6",
      border: `1px solid ${info ? info.color + "50" : "#e5e7eb"}`,
      minWidth: 52,
    }}>
      <span style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, letterSpacing: "0.04em" }}>
        R.{entry.roundId}
      </span>
      <span style={{ fontSize: 12, fontWeight: 900, color: info?.color ?? "#6b7280" }}>
        {info ? info.text : "—"}
      </span>
      {winCase > 0 && (
        <span style={{ fontSize: 8, color: "#6b7280", fontWeight: 600 }}>N°{winCase}</span>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const BET_PRESETS = [500, 1_000, 5_000, 10_000, 50_000];
const SPIN_MS = 1_800;

export default function MalettePage() {
  const [, navigate] = useLocation();
  const { getToken } = useAuth();

  const authFetch = useCallback(async (url: string, opts: RequestInit = {}) => {
    const token = await getToken().catch(() => null);
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers as Record<string, string> ?? {}) };
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
  const [history,      setHistory]      = useState<HistoryEntry[]>([]);

  const closesAtMs    = useRef<number | null>(null);
  const pollTimer     = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef      = useRef<Phase>("loading");
  const pendingResult = useRef<RoundData | null>(null);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const fetchBalance = useCallback(() => {
    authFetch("/api/auth/balance").then(r => r.ok ? r.json() as Promise<{ balance: number }> : null)
      .then(d => { if (d) setBalance(d.balance); }).catch(() => {});
  }, [authFetch]);

  const fetchHistory = useCallback(() => {
    authFetch("/api/malette/history").then(r => r.ok ? r.json() as Promise<HistoryEntry[]> : null)
      .then(d => { if (d) setHistory(d); }).catch(() => {});
  }, [authFetch]);

  const fetchRound = useCallback(async () => {
    try {
      const res = await authFetch("/api/malette/round/current");
      if (!res.ok) return;
      const data = await res.json() as RoundData;

      if (data.status === "betting") {
        closesAtMs.current = data.closesAt ? new Date(data.closesAt).getTime() : null;
        setRound(data);
        if (phaseRef.current === "closed" || phaseRef.current === "spinning") {
          setSelectedCase(null); setError(null); fetchHistory();
        }
        setPhase((data.myBets?.length ?? 0) > 0 ? "waiting" : "betting");
        return;
      }

      const cur = phaseRef.current;
      if (cur === "closed" || cur === "spinning") {
        if (cur === "closed") setRound(data);
        return;
      }
      pendingResult.current = data;
      closesAtMs.current = null;
      setPhase("spinning");
      setRound(prev => prev ? { ...prev } : data);
      setTimeout(() => {
        setRound(pendingResult.current);
        setPhase("closed");
        fetchBalance(); fetchHistory();
      }, SPIN_MS);
    } catch { }
  }, [authFetch, fetchBalance, fetchHistory]);

  useEffect(() => { void fetchRound(); fetchBalance(); fetchHistory(); }, [fetchRound, fetchBalance, fetchHistory]);

  useEffect(() => {
    const t = setInterval(() => {
      if (closesAtMs.current !== null) setTimeLeft(Math.max(0, closesAtMs.current - Date.now()));
    }, 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => { void fetchRound(); }, 3_000);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [fetchRound]);

  const handleBet = async () => {
    if (!round || round.status !== "betting") return;
    if (selectedCase === null) { setError("Choisissez une malette d'abord"); return; }
    const amount = parseInt(betInput.replace(/[\s\u00a0]/g, ""), 10);
    if (isNaN(amount) || amount < 100) { setError("Mise minimum : 100 FC"); return; }
    setError(null); setLoading(true);
    try {
      const res = await authFetch("/api/malette/bet", {
        method: "POST",
        body: JSON.stringify({ roundId: round.roundId, caseIndex: selectedCase, amount }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(json.error ?? "Erreur serveur"); return; }
      await fetchRound(); fetchBalance();
    } finally { setLoading(false); }
  };

  const myBets    = round?.myBets ?? (round?.myBet ? [round.myBet] : []);
  const myBet     = myBets[0] ?? null;
  const mults     = round?.multipliers ?? null;
  const revealed  = phase === "closed" && Array.isArray(mults);
  const isLocked  = phase === "locking" || (phase === "betting" && timeLeft > 0 && timeLeft <= 2_000);
  const totalMyPayout = revealed ? myBets.reduce((s, b) => s + (b.payout ?? 0), 0) : 0;
  const totalMyStake  = myBets.reduce((s, b) => s + b.amount, 0);
  const myWin     = revealed && totalMyPayout > 0;
  const canBet    = (phase === "betting" || phase === "waiting") && !isLocked;
  const isSpinning = phase === "spinning";

  // Timer display values
  const timerSecs = Math.max(0, Math.floor(timeLeft / 1000));
  const timerPct  = round?.timeLeft ? Math.min(1, timeLeft / round.timeLeft) : 0;
  const timerLabel = (() => {
    if (phase === "loading")  return { text: "Chargement…",         color: "#6b7280", bg: "#f3f4f6" };
    if (phase === "spinning") return { text: "🎲 Tirage en cours…", color: "#b45309", bg: "#fef3c7" };
    if (phase === "closed")   return { text: "✨ Résultats",         color: "#15803d", bg: "#f0fdf4" };
    if (isLocked)             return { text: "🔒 Paris fermés",     color: "#dc2626", bg: "#fef2f2" };
    if (phase === "waiting")  return { text: "Pari enregistré",     color: "#1d4ed8", bg: "#eff6ff" };
    return                           { text: "Paris ouverts",       color: "#15803d", bg: "#f0fdf4" };
  })();

  return (
    <div style={{
      height: "100dvh", overflow: "hidden",
      display: "flex", flexDirection: "column",
      background: "#ffffff",
    }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px 10px",
        borderBottom: "1px solid #f1f5f9",
        background: "#fff",
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate("/app")}
          style={{
            width: 36, height: 36, borderRadius: 10,
            border: "1.5px solid #e5e7eb", background: "#f9fafb",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <ArrowLeft style={{ width: 18, height: 18, color: "#374151" }} />
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 900, fontSize: 16, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>
            MALETTE SECRÈTE
          </p>
        </div>
        {balance !== null && (
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, margin: 0, letterSpacing: "0.05em" }}>SOLDE</p>
            <p style={{ fontSize: 14, fontWeight: 900, color: "#111827", margin: 0 }}>{formatFC(balance)} FC</p>
          </div>
        )}
      </div>

      {/* ── Timer card ── */}
      <div style={{
        margin: "10px 14px 6px",
        borderRadius: 14,
        background: timerLabel.bg,
        border: `1.5px solid ${timerLabel.color}30`,
        padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 12,
        flexShrink: 0,
      }}>
        {/* Circular progress */}
        <div style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}>
          <svg viewBox="0 0 48 48" style={{ width: 48, height: 48, transform: "rotate(-90deg)" }}>
            <circle cx="24" cy="24" r="20" fill="none" stroke={`${timerLabel.color}20`} strokeWidth="4" />
            <circle cx="24" cy="24" r="20" fill="none" stroke={timerLabel.color} strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${125.6}`}
              strokeDashoffset={`${125.6 * (1 - (isSpinning || phase === "closed" ? 0 : timerPct))}`}
              style={{ transition: "stroke-dashoffset 0.25s linear" }}
            />
          </svg>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 900, color: timerLabel.color,
          }}>
            {isSpinning ? "🎲" : phase === "closed" ? "✓" : phase === "loading" ? "…" : formatTime(timeLeft)}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 900, color: timerLabel.color, margin: 0,
            animation: isSpinning ? "mpulse 0.5s ease-in-out infinite alternate" : undefined,
          }}>
            {timerLabel.text}
          </p>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0", fontWeight: 600 }}>
            {(phase === "waiting" || phase === "betting") && myBets.length > 0
              ? `${myBets.length} ticket${myBets.length > 1 ? "s" : ""} · ${formatFC(totalMyStake)} FC misés`
              : phase === "closed" && myBets.length > 0
              ? (myWin ? `+${formatFC(totalMyPayout)} FC encaissé` : `Aucun ticket gagnant`)
              : round ? `Round #${round.roundId}` : ""}
          </p>
        </div>
        {/* Distribution dots */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
          {[{ l: "×0", c: "#ef4444" }, { l: "×1.1", c: "#d97706" }, { l: "×2.5", c: "#b45309" }].map(t => (
            <div key={t.l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.c }} />
              <span style={{ fontSize: 9, fontWeight: 800, color: t.c }}>{t.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Briefcases 2×2 ── */}
      <div style={{
        flex: 1, padding: "0 14px",
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 10,
        minHeight: 0,
      }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <CaseCard
            key={i}
            index={i}
            totalBet={round?.betsPerCase?.[i] ?? 0}
            multiplier={mults?.[i] ?? undefined}
            isMyBet={myBets.some(b => b.caseIndex === i)}
            selected={selectedCase === i && canBet}
            selectable={canBet}
            revealed={revealed}
            spinning={isSpinning}
            spinDelay={i * 120}
            onClick={() => { setSelectedCase(i); setError(null); }}
          />
        ))}
      </div>

      {/* ── History strip ── */}
      <div style={{ padding: "8px 14px 4px", flexShrink: 0 }}>
        <p style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: "0.08em", margin: "0 0 5px", textTransform: "uppercase" }}>
          Historique des rounds
        </p>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}
          className="hide-scrollbar"
        >
          {history.length === 0 ? (
            <span style={{ fontSize: 11, color: "#d1d5db", fontStyle: "italic" }}>Aucun historique encore…</span>
          ) : history.map(e => <HistoryChip key={e.roundId} entry={e} />)}
        </div>
      </div>

      {/* ── Bet panel ── */}
      <div style={{
        flexShrink: 0, padding: "10px 14px",
        background: "#f8fafc",
        borderTop: "1px solid #e5e7eb",
        paddingBottom: `max(14px, env(safe-area-inset-bottom))`,
      }}>

        {canBet && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", margin: 0, letterSpacing: "0.04em" }}>
              {selectedCase !== null
                ? `Malette N°${selectedCase + 1} sélectionnée · choisissez votre mise`
                : "👆 Tapez sur une malette pour la choisir"}
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {BET_PRESETS.map(p => (
                <button key={p} onClick={() => setBetInput(String(p))} style={{
                  padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: "pointer",
                  background: betInput === String(p) ? "#16a34a" : "#fff",
                  border: `1.5px solid ${betInput === String(p) ? "#16a34a" : "#e5e7eb"}`,
                  color: betInput === String(p) ? "#fff" : "#374151",
                  transition: "all 0.15s",
                }}>
                  {formatFC(p)} FC
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number" value={betInput}
                onChange={e => setBetInput(e.target.value)}
                placeholder="Montant (FC)"
                style={{
                  flex: 1, borderRadius: 10, padding: "10px 14px",
                  fontSize: 14, fontWeight: 700, color: "#111827",
                  border: "1.5px solid #e5e7eb", background: "#fff", outline: "none",
                }}
              />
              <button
                onClick={() => { void handleBet(); }}
                disabled={loading || selectedCase === null}
                style={{
                  padding: "10px 20px", borderRadius: 10, fontWeight: 900, fontSize: 13,
                  cursor: loading || selectedCase === null ? "not-allowed" : "pointer",
                  background: loading || selectedCase === null
                    ? "#e5e7eb"
                    : "linear-gradient(135deg,#15803d,#22c55e)",
                  color: loading || selectedCase === null ? "#9ca3af" : "#fff",
                  border: "none", display: "flex", alignItems: "center", gap: 6,
                  boxShadow: selectedCase !== null ? "0 4px 12px rgba(22,163,74,0.35)" : "none",
                  transition: "all 0.2s",
                }}
              >
                {loading ? <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> : "🧳 MISER"}
              </button>
            </div>
            {error && <p style={{ fontSize: 11, color: "#dc2626", margin: 0 }}>{error}</p>}
          </div>
        )}

        {(isLocked || isSpinning) && (
          <div style={{
            padding: "12px 16px", borderRadius: 12, textAlign: "center",
            background: isSpinning ? "#fef3c7" : "#fef2f2",
            border: `1px solid ${isSpinning ? "#d97706" : "#dc2626"}30`,
          }}>
            <p style={{ fontWeight: 900, fontSize: 13, color: isSpinning ? "#b45309" : "#dc2626", margin: 0 }}>
              {isSpinning ? "🎲 Les malettes tournent…" : "🔒 Paris fermés"}
            </p>
            {myBets.length > 0 && (
              <p style={{ fontSize: 10, color: "#9ca3af", margin: "3px 0 0" }}>
                {myBets.length} ticket{myBets.length > 1 ? "s" : ""} · {formatFC(totalMyStake)} FC misés
              </p>
            )}
          </div>
        )}

        {canBet && myBets.length > 0 && (
          <div style={{
            marginBottom: 8, padding: "8px 12px", borderRadius: 10,
            background: "#eff6ff", border: "1px solid #bfdbfe",
            display: "flex", flexDirection: "column", gap: 3,
          }}>
            <p style={{ fontWeight: 800, fontSize: 11, color: "#1d4ed8", margin: 0 }}>
              🧳 {myBets.length} ticket{myBets.length > 1 ? "s" : ""} enregistré{myBets.length > 1 ? "s" : ""}
            </p>
            {myBets.map((b, i) => (
              <p key={i} style={{ fontSize: 10, color: "#6b7280", margin: 0 }}>
                Malette N°{b.caseIndex + 1} · {formatFC(b.amount)} FC
              </p>
            ))}
          </div>
        )}

        {phase === "waiting" && myBets.length > 0 && !canBet && (
          <div style={{
            padding: "12px 16px", borderRadius: 12, textAlign: "center",
            background: "#eff6ff", border: "1px solid #bfdbfe",
          }}>
            <p style={{ fontWeight: 900, fontSize: 13, color: "#1d4ed8", margin: 0 }}>
              🧳 {myBets.length} ticket{myBets.length > 1 ? "s" : ""} · {formatFC(totalMyStake)} FC misés
            </p>
            <p style={{ fontSize: 10, color: "#6b7280", margin: "3px 0 0" }}>En attente du tirage…</p>
          </div>
        )}

        {phase === "closed" && myBets.length > 0 && revealed && (
          <div style={{
            padding: "10px 14px", borderRadius: 12,
            background: myWin ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${myWin ? "#86efac" : "#fca5a5"}`,
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            <p style={{ fontWeight: 900, fontSize: 13, color: myWin ? "#15803d" : "#dc2626", margin: 0 }}>
              {myWin ? `🎉 +${formatFC(totalMyPayout)} FC encaissé !` : "😔 Aucun ticket gagnant"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {myBets.map((b, i) => {
                const mult = mults?.[b.caseIndex] ?? 0;
                const payout = b.payout ?? Math.round(b.amount * mult);
                const info = multInfo(mult);
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "4px 8px", borderRadius: 7,
                    background: "rgba(255,255,255,0.6)",
                    border: `1px solid ${info.color}30`,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>
                      Malette N°{b.caseIndex + 1} · {formatFC(b.amount)} FC
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 900, color: info.color }}>
                      {info.text} → {payout > 0 ? `+${formatFC(payout)} FC` : "0 FC"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {phase === "closed" && myBets.length === 0 && (
          <div style={{
            padding: "12px 16px", borderRadius: 12, textAlign: "center",
            background: "#f8fafc", border: "1px solid #e5e7eb",
          }}>
            <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>
              Vous n'avez pas misé sur ce round · Nouveau round dans quelques secondes…
            </p>
          </div>
        )}

        {phase === "loading" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 12 }}>
            <Loader2 style={{ width: 18, height: 18, color: "#9ca3af", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 12, color: "#9ca3af" }}>Chargement du round…</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes mshake {
          0%   { transform: scale(1)    rotate(0deg);  }
          20%  { transform: scale(1.06) rotate(-6deg); }
          40%  { transform: scale(0.97) rotate(6deg);  }
          60%  { transform: scale(1.04) rotate(-4deg); }
          80%  { transform: scale(0.98) rotate(4deg);  }
          100% { transform: scale(1)    rotate(0deg);  }
        }
        @keyframes mq {
          from { opacity: 0.5; transform: scale(0.9); }
          to   { opacity: 1;   transform: scale(1.1); }
        }
        @keyframes mpulse {
          from { opacity: 0.7; }
          to   { opacity: 1;   }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
