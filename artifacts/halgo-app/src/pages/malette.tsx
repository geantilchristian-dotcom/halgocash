import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Trophy, RotateCcw } from "lucide-react";

function formatFC(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/[\u00a0\s]/g, " ");
}

// Map a raw multiplier to display info
function tier(mult: number) {
  if (mult === 0)   return { label: "Vide",       color: "#ef4444", bg: "rgba(239,68,68,0.18)",    glow: "#ef444460", emoji: "💸", textLabel: "Perdu" };
  if (mult <= 1.09) return { label: "×1",         color: "#eab308", bg: "rgba(234,179,8,0.18)",    glow: "#eab30860", emoji: "🔄", textLabel: "Remboursé" };
  if (mult <= 1.6)  return { label: "×1.5",       color: "#22c55e", bg: "rgba(34,197,94,0.18)",    glow: "#22c55e60", emoji: "✨", textLabel: "Petit gain" };
  if (mult <= 3.1)  return { label: "×3",         color: "#3b82f6", bg: "rgba(59,130,246,0.18)",   glow: "#3b82f660", emoji: "🌟", textLabel: "Bon gain" };
  return              { label: "×5 JACKPOT", color: "#F5C518", bg: "rgba(245,197,24,0.25)",   glow: "#F5C51880", emoji: "🏆", textLabel: "JACKPOT !" };
}

const BET_PRESETS = [500, 1_000, 2_000, 5_000, 10_000, 50_000];

type Phase = "setup" | "picking" | "revealing" | "result";

interface PickResult {
  prizes: number[];
  chosenIndex: number;
  wonMult: number;
  wonAmount: number;
  win: boolean;
}

// ── Single briefcase card ────────────────────────────────────────────────────
function BriefcaseCard({
  index, phase, prizes, chosenIndex, revealed,
  onClick,
}: {
  index: number;
  phase: Phase;
  prizes: number[] | null;
  chosenIndex: number | null;
  revealed: number; // how many are revealed so far (for stagger)
  onClick?: () => void;
}) {
  const isChosen = chosenIndex === index;
  const isRevealed = prizes !== null && index < revealed;
  const prizeVal = prizes?.[index] ?? 0;
  const t = tier(prizeVal);
  const isLoss = prizeVal === 0;

  const canClick = phase === "picking" && chosenIndex === null;

  return (
    <button
      disabled={!canClick}
      onClick={canClick ? onClick : undefined}
      className="relative flex flex-col items-center transition-all duration-300"
      style={{
        background: isRevealed ? t.bg : "rgba(255,255,255,0.04)",
        border: `1.5px solid ${isRevealed ? t.color : isChosen ? "#F5C518" : "rgba(245,197,24,0.25)"}`,
        borderRadius: 14,
        padding: "12px 8px 10px",
        boxShadow: isChosen && isRevealed
          ? `0 0 24px ${t.glow}, 0 0 8px ${t.glow}`
          : canClick
          ? "0 0 0px transparent"
          : "none",
        transform: isChosen && isRevealed ? "scale(1.08)" : "scale(1)",
        cursor: canClick ? "pointer" : "default",
        opacity: isRevealed && !isChosen && isLoss ? 0.55 : 1,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Handle */}
      <div style={{
        position: "absolute",
        top: -9,
        left: "50%",
        transform: "translateX(-50%)",
        width: "36%",
        height: 9,
        borderRadius: "5px 5px 0 0",
        background: isRevealed ? t.color : "rgba(245,197,24,0.55)",
        border: `1.5px solid ${isRevealed ? t.color : "rgba(245,197,24,0.3)"}`,
        borderBottom: "none",
      }} />

      {/* Latch */}
      <div style={{
        width: 16, height: 6,
        borderRadius: 4,
        background: isRevealed ? t.color : "rgba(245,197,24,0.4)",
        marginBottom: 6,
      }} />

      {/* Body content */}
      <div className="flex flex-col items-center gap-1" style={{ minHeight: 52 }}>
        {isRevealed ? (
          <>
            <span style={{ fontSize: 26, lineHeight: 1 }}>{t.emoji}</span>
            <span className="font-black text-[11px] text-center" style={{ color: t.color }}>
              {t.label}
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 26, lineHeight: 1, filter: "grayscale(0.2)" }}>🧳</span>
            {canClick && (
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "rgba(245,197,24,0.5)" }}>
                Ouvrir
              </span>
            )}
          </>
        )}
      </div>

      {/* Chosen badge */}
      {isChosen && isRevealed && (
        <div style={{
          position: "absolute",
          top: -18,
          left: "50%",
          transform: "translateX(-50%)",
          background: t.color,
          color: "#000",
          fontSize: 8,
          fontWeight: 900,
          padding: "2px 6px",
          borderRadius: 4,
          whiteSpace: "nowrap",
        }}>
          MA MALETTE
        </div>
      )}
    </button>
  );
}

// ── Main game page ───────────────────────────────────────────────────────────
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

  const [phase, setPhase] = useState<Phase>("setup");
  const [betInput, setBetInput] = useState("1000");
  const [gameId, setGameId] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState(0);
  const [result, setResult] = useState<PickResult | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(() => {
    authFetch("/api/auth/balance")
      .then(r => r.ok ? r.json() as Promise<{ balance: number }> : null)
      .then(d => { if (d) setBalance(d.balance); })
      .catch(() => {});
  }, [authFetch]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // Check for active game on mount
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
      // Stagger reveal: 100ms per briefcase
      let n = 0;
      const tick = () => {
        n++;
        setRevealed(n);
        if (n < 6) setTimeout(tick, 140);
        else {
          setPhase("result");
          fetchBalance();
        }
      };
      setTimeout(tick, 200);
    } catch {
      setError("Erreur réseau");
      setPhase("picking");
    }
  };

  const handleReset = () => {
    setPhase("setup");
    setGameId(null);
    setResult(null);
    setRevealed(0);
    setError(null);
  };

  const resultTier = result ? tier(result.prizes[result.chosenIndex] ?? 0) : null;
  const isJackpot  = result && (result.prizes[result.chosenIndex] ?? 0) >= 4.9;

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{
        background: "linear-gradient(160deg,#06130a 0%,#0a2010 45%,#071510 100%)",
        paddingBottom: 32,
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button
          onClick={() => navigate("/app")}
          className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
          style={{ width: 36, height: 36, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <ArrowLeft style={{ width: 18, height: 18, color: "rgba(255,255,255,0.8)" }} />
        </button>
        <div>
          <p className="text-white font-black text-[17px] leading-tight tracking-tight">MALETTE SECRÈTE</p>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#F5C518" }}>Halgo Cash</p>
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

      <div className="flex-1 px-4 flex flex-col gap-5">

        {/* ── Prize legend ── */}
        <div
          className="rounded-2xl px-4 py-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
            Contenu possible des malettes
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { mult: 0,   label: "Vide",    emoji: "💸", color: "#ef4444" },
              { mult: 1,   label: "×1",      emoji: "🔄", color: "#eab308" },
              { mult: 1.5, label: "×1.5",    emoji: "✨", color: "#22c55e" },
              { mult: 3,   label: "×3",      emoji: "🌟", color: "#3b82f6" },
              { mult: 5,   label: "×5 JACKPOT", emoji: "🏆", color: "#F5C518" },
            ].map(p => (
              <span key={p.mult} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.05)", color: p.color }}>
                <span>{p.emoji}</span> {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* ══════════════ SETUP PHASE ══════════════ */}
        {phase === "setup" && (
          <div className="flex flex-col gap-5">
            {/* Description */}
            <div
              className="rounded-2xl px-4 py-4 flex flex-col gap-1"
              style={{ background: "rgba(245,197,24,0.07)", border: "1px solid rgba(245,197,24,0.2)" }}
            >
              <p className="text-white font-black text-[15px]">🧳 Comment jouer ?</p>
              <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                6 malettes secrètes. Chaque malette cache une surprise différente.
                Tu n'as le droit d'en ouvrir <span className="text-white font-black">qu'une seule</span> — à toi de choisir la bonne !
              </p>
            </div>

            {/* Bet input */}
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                Montant de la mise
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {BET_PRESETS.map(p => (
                  <button
                    key={p}
                    onClick={() => setBetInput(String(p))}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-black transition-all active:scale-95"
                    style={{
                      background: betInput === String(p) ? "rgba(245,197,24,0.2)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${betInput === String(p) ? "#F5C518" : "rgba(255,255,255,0.1)"}`,
                      color: betInput === String(p) ? "#F5C518" : "rgba(255,255,255,0.7)",
                    }}
                  >
                    {formatFC(p)} FC
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={betInput}
                onChange={e => setBetInput(e.target.value)}
                placeholder="Montant personnalisé"
                className="w-full rounded-xl px-4 py-3 text-white font-bold text-[14px] outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
              />
              {error && <p className="text-[11px] mt-1.5" style={{ color: "#ef4444" }}>{error}</p>}
            </div>

            {/* Start button */}
            <button
              onClick={() => { void handleStart(); }}
              disabled={loading}
              className="w-full py-4 rounded-2xl font-black text-[15px] uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{
                background: loading ? "rgba(245,197,24,0.3)" : "linear-gradient(135deg,#d4a017 0%,#F5C518 50%,#d4a017 100%)",
                color: "#000",
                boxShadow: loading ? "none" : "0 4px 20px rgba(245,197,24,0.4)",
              }}
            >
              {loading ? <Loader2 className="animate-spin" style={{ width: 20, height: 20 }} /> : <>🧳 Choisir ma malette</>}
            </button>
          </div>
        )}

        {/* ══════════════ PICKING / REVEALING / RESULT PHASE ══════════════ */}
        {(phase === "picking" || phase === "revealing" || phase === "result") && (
          <div className="flex flex-col gap-4">

            {/* Bet recap */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>Mise</span>
              <span className="font-black text-[13px]" style={{ color: "#F5C518" }}>{formatFC(betAmount)} FC</span>
            </div>

            {/* Instructions */}
            {phase === "picking" && (
              <p className="text-center font-bold text-[13px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                👇 Choisissez <span style={{ color: "#F5C518" }}>une seule</span> malette
              </p>
            )}
            {phase === "revealing" && (
              <p className="text-center font-bold text-[13px] animate-pulse" style={{ color: "rgba(255,255,255,0.6)" }}>
                Révélation en cours…
              </p>
            )}

            {/* 6 briefcases — 3 columns × 2 rows */}
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <BriefcaseCard
                  key={i}
                  index={i}
                  phase={phase}
                  prizes={result?.prizes ?? null}
                  chosenIndex={result?.chosenIndex ?? null}
                  revealed={revealed}
                  onClick={() => { void handlePick(i); }}
                />
              ))}
            </div>

            {/* ── Result banner ── */}
            {phase === "result" && result && resultTier && (
              <div
                className="rounded-2xl px-4 py-5 flex flex-col items-center gap-2 mt-2"
                style={{
                  background: result.win ? resultTier.bg : "rgba(239,68,68,0.12)",
                  border: `1.5px solid ${result.win ? resultTier.color : "#ef4444"}`,
                  boxShadow: result.win ? `0 0 24px ${resultTier.glow}` : "none",
                }}
              >
                {isJackpot && (
                  <div className="flex items-center gap-1">
                    <Trophy style={{ width: 20, height: 20, color: "#F5C518" }} />
                    <span className="font-black text-[13px] uppercase tracking-wider" style={{ color: "#F5C518" }}>
                      JACKPOT !
                    </span>
                    <Trophy style={{ width: 20, height: 20, color: "#F5C518" }} />
                  </div>
                )}
                <span style={{ fontSize: 36 }}>{resultTier.emoji}</span>
                <p className="font-black text-[20px]" style={{ color: resultTier.color }}>
                  {result.win ? `+${formatFC(result.wonAmount)} FC` : "Perdu"}
                </p>
                <p className="text-[12px] text-center" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {result.win
                    ? `Vous avez remporté ${resultTier.label} de votre mise`
                    : "Malchance — tentez encore votre chance !"}
                </p>

                <button
                  onClick={handleReset}
                  className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[13px] uppercase active:scale-95 transition-transform"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.9)",
                  }}
                >
                  <RotateCcw style={{ width: 14, height: 14 }} />
                  Rejouer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes malettePulse {
          0%, 100% { box-shadow: 0 0 8px rgba(245,197,24,0.3); }
          50%       { box-shadow: 0 0 18px rgba(245,197,24,0.6); }
        }
      `}</style>
    </div>
  );
}
