import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/lib/clerk-compat";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Trophy, RotateCcw, BookOpen, Gem } from "lucide-react";

function formatFC(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/[\u00a0\s]/g, " ");
}

function tier(mult: number) {
  if (mult === 0)   return { label: "Vide",        color: "#ef4444", glow: "#ef444480", emoji: "💸", win: false };
  if (mult <= 1.09) return { label: "×1",           color: "#eab308", glow: "#eab30880", emoji: "🔄", win: true  };
  if (mult <= 1.6)  return { label: "×1.5",         color: "#22c55e", glow: "#22c55e80", emoji: "💎", win: true  };
  if (mult <= 3.1)  return { label: "×3",           color: "#3b82f6", glow: "#3b82f680", emoji: "🌟", win: true  };
  return              { label: "×5 JACKPOT",  color: "#F5C518", glow: "#F5C51880", emoji: "🏆", win: true  };
}

const BET_PRESETS = [500, 1_000, 2_000, 5_000, 10_000, 50_000];

type Phase = "setup" | "picking" | "revealing" | "result";
type BottomTab = "mise" | "regles" | "gains";

interface PickResult {
  prizes: number[];
  chosenIndex: number;
  wonMult: number;
  wonAmount: number;
  win: boolean;
}

// ── Beautiful briefcase drawn with CSS ───────────────────────────────────────
function Briefcase({
  state,
  label,
  prize,
  onClick,
}: {
  state: "idle" | "pickable" | "chosen" | "result-open" | "result-closed";
  label: number;
  prize?: number;
  onClick?: () => void;
}) {
  const isOpen     = state === "result-open";
  const pickable   = state === "pickable";
  const chosen     = state === "chosen" || state === "result-open";
  const dimmed     = state === "result-closed";
  const t          = prize !== undefined ? tier(prize) : null;

  const bodyColor   = chosen   ? (t?.color ?? "#F5C518") : pickable ? "#c8921a" : "#7a5c15";
  const borderColor = chosen   ? (t?.color ?? "#F5C518")
                    : pickable ? "#F5C518"
                    : dimmed   ? "rgba(255,255,255,0.06)"
                    : "rgba(245,197,24,0.3)";

  return (
    <button
      onClick={pickable ? onClick : undefined}
      disabled={!pickable}
      className="flex flex-col items-center gap-1.5 transition-all duration-300 select-none focus:outline-none"
      style={{
        opacity: dimmed ? 0.32 : 1,
        transform: chosen && !isOpen ? "scale(1.06)" : "scale(1)",
        filter: dimmed ? "grayscale(0.6)" : "none",
        WebkitTapHighlightColor: "transparent",
        cursor: pickable ? "pointer" : "default",
      }}
    >
      {/* Briefcase body */}
      <div style={{ position: "relative", width: 72, height: 64 }}>

        {/* Handle */}
        <div style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 30,
          height: 12,
          border: `2.5px solid ${bodyColor}`,
          borderBottom: "none",
          borderRadius: "8px 8px 0 0",
          boxShadow: chosen ? `0 0 8px ${borderColor}` : "none",
          transition: "all 0.3s",
          zIndex: 2,
        }} />

        {/* Body container */}
        <div style={{
          position: "absolute",
          top: 10,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 10,
          border: `2px solid ${borderColor}`,
          overflow: "hidden",
          background: isOpen
            ? "linear-gradient(180deg,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.7) 100%)"
            : `linear-gradient(160deg,${bodyColor}cc 0%,${bodyColor}88 100%)`,
          boxShadow: chosen
            ? `0 0 20px ${t?.glow ?? "rgba(245,197,24,0.5)"}, inset 0 1px 0 rgba(255,255,255,0.12)`
            : pickable
            ? "0 0 10px rgba(245,197,24,0.3)"
            : "inset 0 1px 0 rgba(255,255,255,0.05)",
          transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          {/* Horizontal stripe (lid-base separator) */}
          {!isOpen && (
            <div style={{
              position: "absolute",
              top: "42%",
              left: 0,
              right: 0,
              height: 2,
              background: `${bodyColor}55`,
            }} />
          )}

          {/* Latch */}
          {!isOpen && (
            <div style={{
              position: "absolute",
              top: "calc(42% - 5px)",
              left: "50%",
              transform: "translateX(-50%)",
              width: 14,
              height: 10,
              borderRadius: 3,
              background: chosen ? (t?.color ?? "#F5C518") : "rgba(245,197,24,0.6)",
              border: `1px solid ${chosen ? "rgba(255,255,255,0.3)" : "rgba(245,197,24,0.3)"}`,
              boxShadow: chosen ? `0 0 6px ${t?.glow ?? "rgba(245,197,24,0.4)"}` : "none",
            }} />
          )}

          {/* Corner rivets */}
          {!isOpen && [
            { top: 6, left: 6 }, { top: 6, right: 6 },
            { bottom: 6, left: 6 }, { bottom: 6, right: 6 },
          ].map((pos, i) => (
            <div key={i} style={{
              position: "absolute",
              width: 4, height: 4,
              borderRadius: "50%",
              background: `${bodyColor}aa`,
              border: "1px solid rgba(255,255,255,0.12)",
              ...pos,
            }} />
          ))}

          {/* Open state — prize reveal */}
          {isOpen && t && (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}>
              <span style={{ fontSize: 22, lineHeight: 1, filter: `drop-shadow(0 0 8px ${t.glow})` }}>
                {t.emoji}
              </span>
              <span style={{
                fontSize: 9,
                fontWeight: 900,
                color: t.color,
                letterSpacing: "0.04em",
                textAlign: "center",
                textShadow: `0 0 8px ${t.glow}`,
              }}>
                {t.label}
              </span>
            </div>
          )}

          {/* Pickable shimmer */}
          {pickable && (
            <div
              className="malette-shimmer"
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(90deg,transparent 0%,rgba(245,197,24,0.08) 50%,transparent 100%)",
                backgroundSize: "200% 100%",
              }}
            />
          )}
        </div>
      </div>

      {/* Label */}
      <span style={{
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: "0.06em",
        color: chosen ? (t?.color ?? "#F5C518") : pickable ? "rgba(245,197,24,0.7)" : "rgba(255,255,255,0.25)",
        transition: "color 0.3s",
      }}>
        N°{label}
      </span>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MalettePage() {
  const [, navigate] = useLocation();
  const { getToken } = useAuth();

  const authFetch = useCallback(async (url: string, opts: RequestInit = {}): Promise<Response> => {
    const token = await getToken().catch(() => null);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(opts.headers as Record<string, string> ?? {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...opts, headers });
  }, [getToken]);

  const [phase,    setPhase]    = useState<Phase>("setup");
  const [betInput, setBetInput] = useState("1000");
  const [gameId,   setGameId]   = useState<number | null>(null);
  const [betAmount,setBetAmount]= useState(0);
  const [result,   setResult]   = useState<PickResult | null>(null);
  const [balance,  setBalance]  = useState<number | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [tab,      setTab]      = useState<BottomTab>("mise");
  const resultRef = useRef<HTMLDivElement>(null);

  const fetchBalance = useCallback(() => {
    authFetch("/api/auth/balance")
      .then(r => r.ok ? r.json() as Promise<{ balance: number }> : null)
      .then(d => { if (d) setBalance(d.balance); })
      .catch(() => {});
  }, [authFetch]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // Resume active game
  useEffect(() => {
    authFetch("/api/malette/active")
      .then(r => r.ok ? r.json() : null)
      .then((d: { gameId: number; betAmount: number } | null) => {
        if (!d) return;
        setGameId(d.gameId);
        setBetAmount(d.betAmount);
        setBetInput(String(d.betAmount));
        setPhase("picking");
      })
      .catch(() => {});
  }, [authFetch]);

  const handleStart = async () => {
    const bet = parseInt(betInput.replace(/\s/g, ""), 10);
    if (isNaN(bet) || bet < 100) { setError("Mise minimum : 100 FC"); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await authFetch("/api/malette/start", {
        method: "POST",
        body: JSON.stringify({ betAmount: bet }),
      });
      const data = await res.json() as { error?: string; gameId?: number; betAmount?: number };
      if (!res.ok || !data.gameId) { setError(data.error ?? "Erreur serveur"); return; }
      setGameId(data.gameId);
      setBetAmount(data.betAmount!);
      setPhase("picking");
      setTab("mise"); // hide tabs during game
    } finally {
      setLoading(false);
    }
  };

  const handlePick = async (index: number) => {
    if (!gameId || phase !== "picking") return;
    setPhase("revealing");
    try {
      const res = await authFetch("/api/malette/pick", {
        method: "POST",
        body: JSON.stringify({ gameId, index }),
      });
      const data = await res.json() as PickResult & { error?: string };
      if (!res.ok || !data.prizes) { setError(data.error ?? "Erreur"); setPhase("picking"); return; }
      setResult(data);
      // Small delay then show result
      setTimeout(() => {
        setPhase("result");
        fetchBalance();
        // Scroll to result
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
      }, 400);
    } catch {
      setError("Erreur réseau");
      setPhase("picking");
    }
  };

  const handleReset = () => {
    setPhase("setup");
    setGameId(null);
    setResult(null);
    setError(null);
    setTab("mise");
  };

  // Compute briefcase states
  const getBriefcaseState = (i: number): { state: "idle" | "pickable" | "chosen" | "result-open" | "result-closed"; prize?: number } => {
    if (phase === "setup") return { state: "idle" };
    if (phase === "picking") return { state: "pickable" };
    if (phase === "revealing") return { state: i === (result?.chosenIndex ?? -1) ? "chosen" : "pickable" };
    // result phase
    if (result) {
      if (i === result.chosenIndex) return { state: "result-open", prize: result.prizes[i] };
      return { state: "result-closed" };
    }
    return { state: "idle" };
  };

  const resultTier = result ? tier(result.prizes[result.chosenIndex] ?? 0) : null;
  const inGame = phase === "picking" || phase === "revealing" || phase === "result";

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: "linear-gradient(160deg,#060d0a 0%,#0b1e12 50%,#060d0a 100%)" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 shrink-0">
        <button
          onClick={() => navigate("/app")}
          className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
          style={{ width: 36, height: 36, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <ArrowLeft style={{ width: 18, height: 18, color: "rgba(255,255,255,0.8)" }} />
        </button>
        <div>
          <p className="text-white font-black text-[17px] leading-tight tracking-tight">MALETTE SECRÈTE</p>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#F5C518" }}>
            {inGame ? `Mise: ${formatFC(betAmount)} FC` : "Choisissez votre malette"}
          </p>
        </div>
        <div className="ml-auto">
          {balance !== null ? (
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Solde</p>
              <p className="font-black text-[13px]" style={{ color: "#F5C518" }}>{formatFC(balance)} FC</p>
            </div>
          ) : (
            <div className="w-16 h-8 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
          )}
        </div>
      </div>

      {/* ── Briefcase Grid (always shown) ── */}
      <div className="flex-1 px-4 flex flex-col justify-center py-4">

        {/* Instruction / status */}
        <div className="text-center mb-5">
          {phase === "setup" && (
            <p className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
              Fixez votre mise ci-dessous, puis choisissez votre malette
            </p>
          )}
          {phase === "picking" && (
            <p className="text-[14px] font-black" style={{ color: "rgba(255,255,255,0.85)" }}>
              👇 Tapez sur une malette pour l'ouvrir
            </p>
          )}
          {phase === "revealing" && (
            <p className="text-[14px] font-black animate-pulse" style={{ color: "#F5C518" }}>
              Ouverture en cours…
            </p>
          )}
          {phase === "result" && resultTier && (
            <p className="text-[14px] font-black" style={{ color: resultTier.color }}>
              {result?.win ? "✨ Félicitations !" : "😔 Pas de chance cette fois"}
            </p>
          )}
        </div>

        {/* 3 × 2 grid */}
        <div
          className="grid gap-4 mx-auto"
          style={{ gridTemplateColumns: "repeat(3, 1fr)", maxWidth: 300 }}
        >
          {Array.from({ length: 6 }).map((_, i) => {
            const { state, prize } = getBriefcaseState(i);
            return (
              <div key={i} className="flex justify-center">
                <Briefcase
                  state={state}
                  label={i + 1}
                  prize={prize}
                  onClick={() => { void handlePick(i); }}
                />
              </div>
            );
          })}
        </div>

        {/* Result card */}
        {phase === "result" && result && resultTier && (
          <div
            ref={resultRef}
            className="mt-6 rounded-2xl px-4 py-5 flex flex-col items-center gap-2"
            style={{
              background: result.win ? `${resultTier.color}12` : "rgba(239,68,68,0.1)",
              border: `1.5px solid ${result.win ? resultTier.color : "#ef4444"}`,
              boxShadow: result.win ? `0 0 28px ${resultTier.glow}` : "none",
            }}
          >
            {result.wonMult >= 4.9 && (
              <div className="flex items-center gap-1.5">
                <Trophy style={{ width: 18, height: 18, color: "#F5C518" }} />
                <span className="font-black text-[12px] uppercase tracking-wider" style={{ color: "#F5C518" }}>JACKPOT !</span>
                <Trophy style={{ width: 18, height: 18, color: "#F5C518" }} />
              </div>
            )}
            <span style={{ fontSize: 38, filter: `drop-shadow(0 0 12px ${resultTier.glow})` }}>{resultTier.emoji}</span>
            <p className="font-black text-[22px]" style={{ color: resultTier.color }}>
              {result.win ? `+${formatFC(result.wonAmount)} FC` : "Perdu"}
            </p>
            <p className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.45)" }}>
              {result.win
                ? `Malette N°${result.chosenIndex + 1} · ${resultTier.label} de votre mise`
                : "La malette était vide — retentez votre chance !"}
            </p>
          </div>
        )}
      </div>

      {/* ── Bottom Panel ── */}
      <div
        className="shrink-0 rounded-t-3xl px-4 pt-3 pb-safe"
        style={{
          background: "rgba(10,20,14,0.96)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderBottom: "none",
          backdropFilter: "blur(16px)",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        }}
      >
        {/* Tab bar — only before game starts or after result */}
        {(phase === "setup" || phase === "result") && (
          <div
            className="flex gap-1 mb-3 p-1 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {([
              { id: "mise" as BottomTab,   label: "💰 Mise",   show: phase === "setup"  },
              { id: "regles" as BottomTab, label: "📖 Règles", show: true               },
              { id: "gains" as BottomTab,  label: "🏅 Gains",  show: true               },
            ] as const).filter(t => t.show || phase !== "setup").map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all"
                style={{
                  background: tab === t.id ? "rgba(245,197,24,0.18)" : "transparent",
                  color: tab === t.id ? "#F5C518" : "rgba(255,255,255,0.35)",
                  border: tab === t.id ? "1px solid rgba(245,197,24,0.3)" : "1px solid transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Tab: Mise (setup only) ── */}
        {(tab === "mise" || phase === "picking" || phase === "revealing") && phase === "setup" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {BET_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => setBetInput(String(p))}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-black transition-all active:scale-95"
                  style={{
                    background: betInput === String(p) ? "rgba(245,197,24,0.2)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${betInput === String(p) ? "#F5C518" : "rgba(255,255,255,0.1)"}`,
                    color: betInput === String(p) ? "#F5C518" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {formatFC(p)} FC
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                value={betInput}
                onChange={e => setBetInput(e.target.value)}
                placeholder="Montant (FC)"
                className="flex-1 rounded-xl px-4 py-3 text-white font-bold text-[14px] outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              />
              <button
                onClick={() => { void handleStart(); }}
                disabled={loading}
                className="px-5 py-3 rounded-xl font-black text-[13px] uppercase tracking-wide flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg,#c8921a 0%,#F5C518 100%)",
                  color: "#000",
                  boxShadow: "0 4px 16px rgba(245,197,24,0.35)",
                  minWidth: 96,
                }}
              >
                {loading
                  ? <Loader2 className="animate-spin" style={{ width: 18, height: 18 }} />
                  : <>🧳 Jouer</>}
              </button>
            </div>
            {error && <p className="text-[11px]" style={{ color: "#ef4444" }}>{error}</p>}
          </div>
        )}

        {/* Picking phase bottom */}
        {(phase === "picking" || phase === "revealing") && (
          <div
            className="py-3 px-4 rounded-2xl text-center"
            style={{ background: "rgba(245,197,24,0.07)", border: "1px solid rgba(245,197,24,0.15)" }}
          >
            <p className="text-[12px] font-bold" style={{ color: "rgba(245,197,24,0.7)" }}>
              {phase === "picking"
                ? `Mise : ${formatFC(betAmount)} FC · Choisissez votre malette`
                : `Ouverture de la malette…`}
            </p>
          </div>
        )}

        {/* Result phase bottom */}
        {phase === "result" && (
          <>
            {tab === "mise" && (
              <button
                onClick={handleReset}
                className="w-full py-3.5 rounded-2xl font-black text-[14px] uppercase tracking-wide flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                style={{
                  background: "linear-gradient(135deg,#c8921a 0%,#F5C518 100%)",
                  color: "#000",
                  boxShadow: "0 4px 16px rgba(245,197,24,0.35)",
                }}
              >
                <RotateCcw style={{ width: 16, height: 16 }} />
                Rejouer
              </button>
            )}

            {/* Règles tab in result */}
            {tab === "regles" && <RulesTab />}
            {tab === "gains" && <GainsTab betAmount={betAmount} />}
          </>
        )}

        {/* ── Tab: Règles (setup) ── */}
        {phase === "setup" && tab === "regles" && <RulesTab />}

        {/* ── Tab: Gains (setup) ── */}
        {phase === "setup" && tab === "gains" && <GainsTab betAmount={parseInt(betInput.replace(/\s/g, ""), 10) || 1000} />}
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .malette-shimmer {
          animation: shimmer 2.4s ease-in-out infinite;
          background: linear-gradient(90deg,transparent 0%,rgba(245,197,24,0.1) 50%,transparent 100%);
          background-size: 200% 100%;
        }
        .pb-safe { padding-bottom: max(16px, env(safe-area-inset-bottom)); }
      `}</style>
    </div>
  );
}

// ── Rules tab ─────────────────────────────────────────────────────────────────
function RulesTab() {
  return (
    <div className="space-y-2.5 py-1">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen style={{ width: 14, height: 14, color: "#F5C518" }} />
        <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: "#F5C518" }}>Comment jouer</p>
      </div>
      {[
        { n: "1", text: "Fixez votre mise (minimum 100 FC)" },
        { n: "2", text: "6 malettes secrètes apparaissent — chaque malette cache une récompense différente" },
        { n: "3", text: "Choisissez une seule malette et tapez dessus pour l'ouvrir" },
        { n: "4", text: "Le gain est crédité instantanément sur votre solde" },
      ].map(s => (
        <div key={s.n} className="flex items-start gap-2.5">
          <div style={{
            width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
            background: "rgba(245,197,24,0.15)", border: "1px solid rgba(245,197,24,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 900, color: "#F5C518",
          }}>
            {s.n}
          </div>
          <p className="text-[12px] leading-snug" style={{ color: "rgba(255,255,255,0.6)" }}>{s.text}</p>
        </div>
      ))}
      <p className="text-[10px] mt-2 pt-2" style={{ color: "rgba(255,255,255,0.25)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        ⚠️ Une seule malette par partie. Aucun remboursement possible.
      </p>
    </div>
  );
}

// ── Gains tab ─────────────────────────────────────────────────────────────────
function GainsTab({ betAmount }: { betAmount: number }) {
  const prizes = [
    { mult: 0,   emoji: "💸", label: "Vide",       desc: "Malette vide",     qty: 2, color: "#ef4444" },
    { mult: 1,   emoji: "🔄", label: "×1",         desc: "Mise remboursée",  qty: 1, color: "#eab308" },
    { mult: 1.5, emoji: "💎", label: "×1.5",       desc: "Petit gain",       qty: 1, color: "#22c55e" },
    { mult: 3,   emoji: "🌟", label: "×3",         desc: "Bon gain",         qty: 1, color: "#3b82f6" },
    { mult: 5,   emoji: "🏆", label: "×5",         desc: "JACKPOT !",        qty: 1, color: "#F5C518" },
  ];
  const safe = isNaN(betAmount) || betAmount < 100 ? 1000 : betAmount;

  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center gap-2 mb-1">
        <Gem style={{ width: 14, height: 14, color: "#F5C518" }} />
        <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: "#F5C518" }}>
          Gains possibles · Mise {formatFC(safe)} FC
        </p>
      </div>
      {prizes.map(p => (
        <div key={p.mult} className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{p.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-black" style={{ color: p.color }}>{p.label}</p>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{p.desc} · {p.qty}×/6</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[12px] font-black" style={{ color: p.mult > 0 ? p.color : "#ef4444" }}>
              {p.mult > 0 ? `+${formatFC(Math.floor(safe * p.mult * 0.97))} FC` : "0 FC"}
            </p>
          </div>
        </div>
      ))}
      <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
        Gains nets (après house edge 3%). Distribution : 2 vides · 1 ×1 · 1 ×1.5 · 1 ×3 · 1 ×5
      </p>
    </div>
  );
}
