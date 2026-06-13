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
  if (m === 0)   return { text: "×0",   color: "#ef4444", glow: "#ef444460", emoji: "💸", win: false };
  if (m <= 1.15) return { text: "×1.1", color: "#eab308", glow: "#eab30860", emoji: "🔄", win: true  };
  if (m <= 1.6)  return { text: "×1.5", color: "#22c55e", glow: "#22c55e60", emoji: "💎", win: true  };
  return             { text: "×2.5", color: "#F5C518", glow: "#F5C51860", emoji: "🏆", win: true  };
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface MyBet {
  caseIndex:  number;
  amount:     number;
  multiplier: number | null;
  payout:     number | null;
}

interface RoundData {
  roundId:         number;
  status:          "betting" | "closed";
  betsPerCase:     number[];
  timeLeft:        number;
  closesAt?:       string;
  multipliers?:    number[] | null;
  totalCollected?: number;
  totalPaid?:      number;
  closedAt?:       string | null;
  myBet?:          MyBet | null;
}

// "spinning" = animation de tirage entre fermeture des paris et révélation
type Phase = "loading" | "betting" | "waiting" | "locking" | "spinning" | "closed";

// ── Briefcase component ───────────────────────────────────────────────────────
function Case({
  index, totalBet, multiplier, isMyBet,
  selected, selectable, revealed, spinning, spinDelay,
  onClick,
}: {
  index:      number;
  totalBet:   number;
  multiplier?: number;
  isMyBet:    boolean;
  selected:   boolean;
  selectable: boolean;
  revealed:   boolean;
  spinning:   boolean;
  spinDelay:  number;
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
        border:          `2px solid ${borderClr}`,
        background:      bgClr,
        borderRadius:    18,
        padding:         "18px 10px 14px",
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        gap:             8,
        cursor:          selectable ? "pointer" : "default",
        transition:      spinning ? "none" : "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        boxShadow:       (t?.win || selected) ? `0 0 22px ${t?.glow ?? "rgba(245,197,24,0.4)"}` : "none",
        position:        "relative",
        WebkitTapHighlightColor: "transparent",
        minHeight:       120,
        animation:       spinning ? `malette-shake 0.55s ease-in-out ${spinDelay}ms 3 both` : undefined,
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

      {/* Suitcase image — quadrant from 2×2 sprite */}
      <div style={{ position: "relative", width: 96, height: 84 }}>
        {/* Sprite crop: top-left=01, top-right=02, bottom-left=03, bottom-right=04 */}
        <div style={{
          width: "100%", height: "100%",
          backgroundImage: "url('/malettes.png')",
          backgroundSize: "200% 200%",
          backgroundPosition: [
            "0% 0%",       // 0 → 01 noir
            "100% 0%",     // 1 → 02 rouge
            "0% 100%",     // 2 → 03 bleu marine
            "100% 100%",   // 3 → 04 violet
          ][index] ?? "0% 0%",
          backgroundRepeat: "no-repeat",
          filter: revealed && !t?.win
            ? "grayscale(0.7) brightness(0.5)"
            : selected
            ? `drop-shadow(0 0 10px rgba(245,197,24,0.85))`
            : spinning
            ? "drop-shadow(0 0 6px rgba(245,197,24,0.5))"
            : t?.win
            ? `drop-shadow(0 0 14px ${t.glow})`
            : "none",
          transition: "filter 0.35s",
          borderRadius: 8,
        }} />

        {/* Question mark overlay while spinning */}
        {spinning && (
          <span style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 22, fontWeight: 900, color: "#F5C518",
            animation: "malette-question 0.4s ease-in-out infinite alternate",
            textShadow: "0 0 12px rgba(245,197,24,0.9)",
            pointerEvents: "none",
          }}>?</span>
        )}

        {/* Multiplier overlay when revealed */}
        {revealed && t && (
          <div style={{
            position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)",
            background: t.win ? t.color : "rgba(255,255,255,0.12)",
            borderRadius: 6, padding: "2px 8px",
            fontSize: 13, fontWeight: 900, color: t.win ? "#000" : "rgba(255,255,255,0.5)",
            whiteSpace: "nowrap",
            boxShadow: t.win ? `0 0 12px ${t.glow}` : "none",
          }}>{t.emoji} {t.text}</div>
        )}
      </div>

      {/* Label below */}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 10, fontWeight: 900, color: selected ? "#F5C518" : t ? t.color : "rgba(255,255,255,0.35)", marginBottom: 2, letterSpacing: "0.06em" }}>
          N°{index + 1}
        </p>
        <p style={{ fontSize: 11, fontWeight: 700, color: totalBet > 0 ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.2)" }}>
          {spinning ? "…" : totalBet > 0 ? `${formatFC(totalBet)} FC` : "—"}
        </p>
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const BET_PRESETS = [500, 1_000, 5_000, 10_000, 50_000];
const SPIN_DURATION_MS = 1_800; // durée de l'animation de tirage (ms)

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

  const closesAtMs      = useRef<number | null>(null);
  const pollTimer       = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef        = useRef<Phase>("loading");        // always-current phase (avoids stale closures)
  const pendingResult   = useRef<RoundData | null>(null);  // holds closed data during spin

  // Keep phaseRef in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);

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

      if (data.status === "betting") {
        closesAtMs.current = data.closesAt ? new Date(data.closesAt).getTime() : null;
        setRound(data);
        // Réinitialise la sélection si c'est un nouveau round
        if (phaseRef.current === "closed" || phaseRef.current === "spinning") {
          setSelectedCase(null);
          setError(null);
        }
        setPhase(data.myBet ? "waiting" : "betting");
        return;
      }

      // status === "closed"
      const cur = phaseRef.current;
      if (cur === "closed" || cur === "spinning") {
        // Déjà en train de montrer le résultat ou l'animation — ne rien faire
        if (cur === "closed") setRound(data);
        return;
      }

      // Transition vers résultat : d'abord l'animation de tirage
      pendingResult.current = data;
      closesAtMs.current    = null;
      setPhase("spinning");
      setRound(prev => prev ? { ...prev } : data); // garde les données du round actif visuellement

      setTimeout(() => {
        setRound(pendingResult.current);
        setPhase("closed");
        fetchBalance();
      }, SPIN_DURATION_MS);

    } catch { /* ignore réseau */ }
  }, [authFetch, fetchBalance]);

  // Initial load
  useEffect(() => {
    void fetchRound();
    fetchBalance();
  }, [fetchRound, fetchBalance]);

  // Countdown (tick toutes les 250ms)
  useEffect(() => {
    const t = setInterval(() => {
      if (closesAtMs.current !== null) {
        const left = Math.max(0, closesAtMs.current - Date.now());
        setTimeLeft(left);
      }
    }, 250);
    return () => clearInterval(t);
  }, []);

  // Poll toutes les 3 secondes
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
  const isLocked = phase === "locking" || (phase === "betting" && timeLeft > 0 && timeLeft <= 2_000);
  const myMult   = revealed && myBet ? (mults?.[myBet.caseIndex] ?? 0) : null;
  const myPayout = myBet?.payout ?? null;
  const myWin    = myPayout !== null && myPayout > 0;
  const totalPot = (round?.betsPerCase ?? []).reduce((a, b) => a + b, 0);

  // Couleur du timer
  const timerColor = (() => {
    if (phase === "spinning")           return "#F5C518";
    if (phase === "closed")             return "#F5C518";
    if (isLocked)                       return "#ef4444";
    if (timeLeft < 10_000 && timeLeft > 0) return "#ef4444";
    return "rgba(255,255,255,0.55)";
  })();

  // Message du timer bar
  const timerMsg = (() => {
    if (phase === "loading")  return "Chargement…";
    if (phase === "spinning") return "🎲 Tirage en cours…";
    if (phase === "closed")   return "✨ Résultats du round";
    if (isLocked)             return "🔒 Paris fermés — tirage imminent";
    if (phase === "betting")  return `Paris ouverts · ${formatTime(timeLeft)}`;
    if (phase === "waiting")  return `Pari enregistré · ${formatTime(timeLeft)}`;
    return formatTime(timeLeft);
  })();

  const canBet    = phase === "betting" && !myBet && !isLocked;
  const isSpinning = phase === "spinning";

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
          background: isSpinning || phase === "closed"
            ? "rgba(245,197,24,0.08)"
            : isLocked ? "rgba(239,68,68,0.12)"
            : "rgba(255,255,255,0.04)",
          border: `1px solid ${isSpinning || phase === "closed" ? "rgba(245,197,24,0.3)" : isLocked ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
          transition: "all 0.5s",
        }}
      >
        <Timer style={{ width: 14, height: 14, flexShrink: 0, color: timerColor }} />
        <p
          className="text-[12px] font-black flex-1"
          style={{
            color: timerColor,
            animation: isSpinning ? "pulse-text 0.5s ease-in-out infinite alternate" : undefined,
          }}
        >
          {timerMsg}
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
              selected={selectedCase === i && canBet}
              selectable={canBet}
              revealed={revealed}
              spinning={isSpinning}
              spinDelay={i * 100}
              onClick={() => { setSelectedCase(i); setError(null); }}
            />
          ))}
        </div>

        {/* ── Result card ── */}
        {phase === "closed" && myBet && myMult !== null && (
          <div
            className="mx-auto w-full max-w-xs rounded-2xl px-4 py-4 text-center"
            style={{
              background:  myWin ? "rgba(245,197,24,0.08)" : "rgba(239,68,68,0.08)",
              border:      `1.5px solid ${myWin ? "rgba(245,197,24,0.35)" : "rgba(239,68,68,0.3)"}`,
              boxShadow:   myWin ? "0 0 28px rgba(245,197,24,0.15)" : "none",
              animation:   "fade-up 0.5s ease-out both",
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
        {/* Mise form */}
        {canBet && (
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

        {/* Paris fermés (2 dernières secondes ou tirage) */}
        {(isLocked || isSpinning) && (
          <div
            className="py-3 px-4 rounded-2xl text-center"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.25)",
              animation: isSpinning ? "pulse-border 0.8s ease-in-out infinite" : undefined,
            }}
          >
            <p className="font-black text-[13px]" style={{ color: "#ef4444" }}>
              {isSpinning ? "🎲 Les malettes tournent…" : "🔒 Paris fermés"}
            </p>
            {myBet && (
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                Malette N°{myBet.caseIndex + 1} · {formatFC(myBet.amount)} FC
              </p>
            )}
          </div>
        )}

        {/* En attente du résultat (mis mais round encore ouvert) */}
        {phase === "waiting" && myBet && !isLocked && (
          <div
            className="py-3 px-4 rounded-2xl text-center"
            style={{ background: "rgba(245,197,24,0.07)", border: "1px solid rgba(245,197,24,0.15)" }}
          >
            <p className="font-black text-[13px]" style={{ color: "rgba(245,197,24,0.85)" }}>
              🧳 Malette N°{myBet.caseIndex + 1} · {formatFC(myBet.amount)} FC misés
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              En attente du tirage…
            </p>
          </div>
        )}

        {/* Distribution */}
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

      {/* ── CSS Animations ── */}
      <style>{`
        @keyframes malette-shake {
          0%   { transform: scale(1)    rotate(0deg);  }
          15%  { transform: scale(1.07) rotate(-7deg); }
          30%  { transform: scale(0.96) rotate(7deg);  }
          45%  { transform: scale(1.06) rotate(-5deg); }
          60%  { transform: scale(0.97) rotate(5deg);  }
          75%  { transform: scale(1.04) rotate(-3deg); }
          100% { transform: scale(1)    rotate(0deg);  }
        }
        @keyframes malette-question {
          from { opacity: 0.5; transform: scale(0.9); }
          to   { opacity: 1;   transform: scale(1.1); }
        }
        @keyframes pulse-text {
          from { opacity: 0.7; }
          to   { opacity: 1;   }
        }
        @keyframes pulse-border {
          0%, 100% { border-color: rgba(239,68,68,0.25); }
          50%      { border-color: rgba(239,68,68,0.55); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  );
}
