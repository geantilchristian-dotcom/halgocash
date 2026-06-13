import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Printer, RefreshCw, Gamepad2, Search } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaletteRound {
  roundId: number;
  closesAt: string;
  timeLeft: number;
}

interface MaletteTicket {
  ticketCode: string;
  caseIndex: number;
  amountFc: number;
  roundId: number;
}

interface SportMatch {
  id: number;
  fixtureId: number;
  competition: string;
  competitionName: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  oddsHome: string;
  oddsDraw: string;
  oddsAway: string;
}

interface SportTicket {
  ticketCode: string;
  betType: string;
  amountFc: number;
  odds: number;
  potentialPayoutFc: number;
}

interface TicketResult {
  ticketCode: string;
  gameType: string;
  selection: Record<string, unknown>;
  homeTeam?: string;
  awayTeam?: string;
  matchDate?: string;
  amountFc: number;
  potentialPayoutFc?: number;
  status: string;
  actualPayoutFc?: number;
  createdAt: string;
  paidAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFc(n: number) {
  return (
    new Intl.NumberFormat("fr-FR")
      .format(Math.round(n))
      .replace(/\s/g, ".") + " FC"
  );
}

function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CASE_BG = ["#1a1a2e", "#7b0e1b", "#0d2f5b", "#3a0b5e"];
const CASE_FG = ["#F5C518", "#FFD060", "#60C0FF", "#CC88FF"];
const PRESETS = [500, 1_000, 5_000, 10_000];

// ─── Print Templates ──────────────────────────────────────────────────────────

function MaletteTicketPrint({
  ticket,
  now,
}: {
  ticket: MaletteTicket;
  now: string;
}) {
  return (
    <div className="jeu-ticket">
      <div style={{ textAlign: "center", fontWeight: 900, fontSize: 14, letterSpacing: 1 }}>
        ◆ HALGO MALETTE ◆
      </div>
      <div style={{ textAlign: "center", fontSize: 10, color: "#888" }}>www.halgo.cash</div>
      <hr style={{ margin: "5px 0", borderStyle: "dashed", borderWidth: 1 }} />
      <div>Round   : #{ticket.roundId}</div>
      <div>Malette : N°{ticket.caseIndex + 1}</div>
      <hr style={{ margin: "5px 0", borderStyle: "dashed", borderWidth: 1 }} />
      <div>Mise    : {fmtFc(ticket.amountFc)}</div>
      <div>Gain max: {fmtFc(Math.round(ticket.amountFc * 2.5))}</div>
      <hr style={{ margin: "5px 0", borderStyle: "dashed", borderWidth: 1 }} />
      <div style={{ fontWeight: 900, letterSpacing: 3, fontSize: 13 }}>
        Code: {ticket.ticketCode}
      </div>
      <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
        <QRCodeSVG value={ticket.ticketCode} size={72} bgColor="#ffffff" fgColor="#000000" />
      </div>
      <div style={{ fontSize: 9, color: "#999" }}>{now}</div>
      <div style={{ textAlign: "center", fontSize: 9, marginTop: 4 }}>
        Conservez ce ticket — Réclamez vos gains au vendeur
      </div>
    </div>
  );
}

function SportTicketPrint({
  ticket,
  match,
  now,
}: {
  ticket: SportTicket;
  match: SportMatch;
  now: string;
}) {
  const prediction =
    ticket.betType === "home"
      ? `1 – ${match.homeTeam}`
      : ticket.betType === "draw"
      ? "X – Nul"
      : `2 – ${match.awayTeam}`;

  return (
    <div className="jeu-ticket">
      <div style={{ textAlign: "center", fontWeight: 900, fontSize: 14, letterSpacing: 1 }}>
        ◆ HALGO SPORT ◆
      </div>
      <div style={{ textAlign: "center", fontSize: 10, color: "#888" }}>www.halgo.cash</div>
      <hr style={{ margin: "5px 0", borderStyle: "dashed", borderWidth: 1 }} />
      <div style={{ fontWeight: 700 }}>
        {match.homeTeam} vs {match.awayTeam}
      </div>
      <div style={{ fontSize: 10 }}>{fmtDateTime(match.matchDate)}</div>
      <hr style={{ margin: "5px 0", borderStyle: "dashed", borderWidth: 1 }} />
      <div>Pronostic: {prediction}</div>
      <div>Cote     : x{ticket.odds.toFixed(2)}</div>
      <hr style={{ margin: "5px 0", borderStyle: "dashed", borderWidth: 1 }} />
      <div>Mise     : {fmtFc(ticket.amountFc)}</div>
      <div>Gain max : {fmtFc(ticket.potentialPayoutFc)}</div>
      <hr style={{ margin: "5px 0", borderStyle: "dashed", borderWidth: 1 }} />
      <div style={{ fontWeight: 900, letterSpacing: 3, fontSize: 13 }}>
        Code: {ticket.ticketCode}
      </div>
      <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
        <QRCodeSVG value={ticket.ticketCode} size={72} bgColor="#ffffff" fgColor="#000000" />
      </div>
      <div style={{ fontSize: 9, color: "#999" }}>{now}</div>
      <div style={{ textAlign: "center", fontSize: 9, marginTop: 4 }}>
        Conservez ce ticket — Réclamez vos gains au vendeur
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type GameMode = "malette" | "sport" | "verify";

export default function JeuxTab() {
  const [mode, setMode] = useState<GameMode>("malette");

  // Malette state
  const [round, setRound] = useState<MaletteRound | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const closesAtRef = useRef<number | null>(null);
  const [selCase, setSelCase] = useState<number | null>(null);
  const [malAmount, setMalAmount] = useState("1000");
  const [malQty, setMalQty] = useState(1);
  const [malLoading, setMalLoading] = useState(false);
  const [malError, setMalError] = useState("");
  const [malTickets, setMalTickets] = useState<MaletteTicket[] | null>(null);

  // Sport state
  const [matches, setMatches] = useState<SportMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [selMatch, setSelMatch] = useState<SportMatch | null>(null);
  const [betType, setBetType] = useState<"home" | "draw" | "away" | null>(null);
  const [sptAmount, setSptAmount] = useState("1000");
  const [sptQty, setSptQty] = useState(1);
  const [sptLoading, setSptLoading] = useState(false);
  const [sptError, setSptError] = useState("");
  const [sptTickets, setSptTickets] = useState<SportTicket[] | null>(null);

  // Verify state
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<TicketResult | null>(null);
  const [verifyError, setVerifyError] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  // Print snapshot
  const printNow = useRef(new Date().toLocaleString("fr-FR"));

  // ── Fetch malette round ──
  const fetchRound = useCallback(async () => {
    try {
      const r = await fetch("/api/vendor/pos-games/malette-round");
      if (!r.ok) return;
      const data = (await r.json()) as MaletteRound;
      setRound(data);
      closesAtRef.current = new Date(data.closesAt).getTime();
      setTimeLeft(Math.max(0, new Date(data.closesAt).getTime() - Date.now()));
    } catch {}
  }, []);

  // ── Fetch sport matches ──
  const fetchMatches = useCallback(async () => {
    setMatchesLoading(true);
    try {
      const r = await fetch("/api/vendor/pos-games/sport-matches");
      if (!r.ok) return;
      setMatches((await r.json()) as SportMatch[]);
    } catch {} finally {
      setMatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRound();
    void fetchMatches();
  }, [fetchRound, fetchMatches]);

  // Countdown ticker + auto-refresh round
  useEffect(() => {
    const t1 = setInterval(() => {
      if (closesAtRef.current !== null) {
        const tl = Math.max(0, closesAtRef.current - Date.now());
        setTimeLeft(tl);
        if (tl === 0) void fetchRound();
      }
    }, 250);
    const t2 = setInterval(() => void fetchRound(), 8_000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [fetchRound]);

  // ── Malette submit ──
  const handleMaletteSubmit = async () => {
    if (!round) { setMalError("Aucun round actif"); return; }
    if (selCase === null) { setMalError("Choisissez une malette"); return; }
    const amountFc = parseInt(malAmount, 10);
    if (!amountFc || amountFc < 100) { setMalError("Montant minimum : 100 FC"); return; }
    setMalError(""); setMalLoading(true);
    try {
      const r = await fetch("/api/vendor/pos-games/malette", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: round.roundId,
          caseIndex: selCase,
          amountFc,
          quantity: malQty,
        }),
      });
      const data = (await r.json()) as {
        ok: boolean;
        tickets?: MaletteTicket[];
        error?: string;
      };
      if (!r.ok || !data.ok) { setMalError(data.error ?? "Erreur serveur"); return; }
      printNow.current = new Date().toLocaleString("fr-FR");
      setMalTickets(data.tickets ?? []);
      setTimeout(() => window.print(), 400);
    } catch {
      setMalError("Erreur réseau");
    } finally {
      setMalLoading(false);
    }
  };

  // ── Sport submit ──
  const handleSportSubmit = async () => {
    if (!selMatch) { setSptError("Choisissez un match"); return; }
    if (!betType) { setSptError("Choisissez un pronostic"); return; }
    const amountFc = parseInt(sptAmount, 10);
    if (!amountFc || amountFc < 100) { setSptError("Montant minimum : 100 FC"); return; }
    setSptError(""); setSptLoading(true);
    try {
      const r = await fetch("/api/vendor/pos-games/sport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: selMatch.id,
          betType,
          amountFc,
          quantity: sptQty,
        }),
      });
      const data = (await r.json()) as {
        ok: boolean;
        tickets?: SportTicket[];
        error?: string;
      };
      if (!r.ok || !data.ok) { setSptError(data.error ?? "Erreur serveur"); return; }
      printNow.current = new Date().toLocaleString("fr-FR");
      setSptTickets(data.tickets ?? []);
      setTimeout(() => window.print(), 400);
    } catch {
      setSptError("Erreur réseau");
    } finally {
      setSptLoading(false);
    }
  };

  // ── Verify ticket ──
  const handleVerify = async () => {
    const code = verifyCode.trim().toUpperCase();
    if (!code) return;
    setVerifyError(""); setVerifyLoading(true); setVerifyResult(null); setPaySuccess(false);
    try {
      const r = await fetch(`/api/vendor/pos-games/ticket/${code}`);
      if (r.status === 404) { setVerifyError("Ticket introuvable"); return; }
      if (!r.ok) { setVerifyError("Erreur serveur"); return; }
      setVerifyResult((await r.json()) as TicketResult);
    } catch {
      setVerifyError("Erreur réseau");
    } finally {
      setVerifyLoading(false);
    }
  };

  // ── Pay out ticket ──
  const handlePay = async () => {
    if (!verifyResult) return;
    setPayLoading(true);
    try {
      const r = await fetch(
        `/api/vendor/pos-games/ticket/${verifyResult.ticketCode}/pay`,
        { method: "POST" },
      );
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) { setVerifyError(data.error ?? "Erreur"); return; }
      setPaySuccess(true);
      setVerifyResult({ ...verifyResult, status: "paid" });
    } catch {
      setVerifyError("Erreur réseau");
    } finally {
      setPayLoading(false);
    }
  };

  const isLocked = timeLeft < 3_000 && timeLeft > 0;
  const malAmountInt = parseInt(malAmount, 10) || 0;
  const sptAmountInt = parseInt(sptAmount, 10) || 0;
  const selectedOdds =
    selMatch && betType
      ? parseFloat(
          String(
            betType === "home"
              ? selMatch.oddsHome
              : betType === "draw"
              ? selMatch.oddsDraw
              : selMatch.oddsAway,
          ),
        )
      : null;

  return (
    <>
      {/* ── Print Styles ── */}
      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          #pg-print, #pg-print * { visibility: visible !important; }
          #pg-print {
            position: fixed; top: 0; left: 0;
            width: 72mm; padding: 4px;
          }
          .jeu-ticket {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1.5px dashed #bbb;
            border-radius: 6px;
            padding: 8px 10px;
            margin-bottom: 10px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            line-height: 1.4;
          }
        }
      `}</style>

      {/* ── Hidden Print Zone ── */}
      <div id="pg-print" style={{ display: "none" }}>
        {malTickets?.map((t) => (
          <MaletteTicketPrint key={t.ticketCode} ticket={t} now={printNow.current} />
        ))}
        {sptTickets?.map((t) => (
          <SportTicketPrint
            key={t.ticketCode}
            ticket={t}
            match={selMatch!}
            now={printNow.current}
          />
        ))}
      </div>

      {/* ── Mode selector ── */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-4">
        {(
          [
            { id: "malette", label: "🧳 Malette" },
            { id: "sport",   label: "⚽ Sport" },
            { id: "verify",  label: "🔍 Vérifier" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => {
              setMode(id);
              setMalTickets(null);
              setSptTickets(null);
            }}
            className="flex-1 py-2 text-xs font-bold transition-all"
            style={
              mode === id
                ? { background: "#1e3a8a", color: "#fff" }
                : { background: "#f9fafb", color: "#6b7280" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════ MALETTE ════════════════════ */}
      {mode === "malette" && (
        <div className="space-y-4">
          {/* Round banner */}
          <div className="rounded-xl bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-3 flex items-center justify-between text-white">
            <div>
              <p className="text-[10px] font-bold uppercase opacity-70">Round actif</p>
              <p className="text-base font-black">
                {round ? `#${round.roundId}` : "Chargement…"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium opacity-70">Ferme dans</p>
              <p className="text-2xl font-black tabular-nums tracking-tight">
                {round ? formatCountdown(timeLeft) : "--:--"}
              </p>
            </div>
          </div>

          {isLocked && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 font-bold text-center">
              🔒 Round fermé — Prochain round en cours…
            </div>
          )}

          {!isLocked && (
            <>
              {/* Case selector */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">
                  Sélectionner la malette
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelCase(i);
                        setMalError("");
                        setMalTickets(null);
                      }}
                      className="rounded-xl p-3 flex flex-col items-center gap-1 border-2 transition-all active:scale-95"
                      style={{
                        background: selCase === i ? CASE_BG[i] : "#f8f9fa",
                        borderColor: selCase === i ? CASE_FG[i]! : "#e5e7eb",
                        color: selCase === i ? CASE_FG[i] : "#374151",
                      }}
                    >
                      <span style={{ fontSize: 24 }}>🧳</span>
                      <span className="text-xs font-black">N°{i + 1}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">
                  Montant (FC)
                </label>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setMalAmount(String(p));
                        setMalTickets(null);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all"
                      style={
                        malAmount === String(p)
                          ? { background: "#16a34a", color: "#fff", borderColor: "#16a34a" }
                          : { background: "#fff", color: "#374151", borderColor: "#e5e7eb" }
                      }
                    >
                      {fmtFc(p)}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={malAmount}
                  onChange={(e) => {
                    setMalAmount(e.target.value);
                    setMalTickets(null);
                  }}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base font-bold text-gray-800 outline-none focus:border-blue-500"
                  placeholder="Montant en FC"
                  min={100}
                />
              </div>

              {/* Qty */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">
                  Nombre de tickets
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setMalQty((q) => Math.max(1, q - 1)); setMalTickets(null); }}
                    className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 text-xl hover:bg-gray-50 transition-all"
                  >
                    −
                  </button>
                  <span className="flex-1 text-center text-2xl font-black text-gray-900">
                    {malQty}
                  </span>
                  <button
                    onClick={() => { setMalQty((q) => Math.min(20, q + 1)); setMalTickets(null); }}
                    className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 text-xl hover:bg-gray-50 transition-all"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Summary */}
              {selCase !== null && malAmountInt > 0 && (
                <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700 font-medium">Total à encaisser</span>
                    <span className="font-black text-green-800">
                      {fmtFc(malAmountInt * malQty)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-green-600">Gain max possible</span>
                    <span className="font-bold text-green-700">
                      {fmtFc(malAmountInt * malQty * 2.5)}
                    </span>
                  </div>
                </div>
              )}

              {malError && (
                <p className="text-sm text-red-600 font-medium">{malError}</p>
              )}

              <button
                onClick={() => { void handleMaletteSubmit(); }}
                disabled={malLoading || selCase === null || malAmountInt < 100 || !round}
                className="w-full py-3.5 rounded-xl font-black text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg,#1e3a8a,#3b82f6)",
                }}
              >
                {malLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                Émettre {malQty} ticket{malQty > 1 ? "s" : ""}{" "}
                {malAmountInt > 0 ? `· ${fmtFc(malAmountInt * malQty)}` : ""}
              </button>

              {malTickets && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 space-y-1">
                  <p className="text-xs font-black text-blue-800">
                    ✅ {malTickets.length} ticket{malTickets.length > 1 ? "s" : ""} émis
                    — Impression lancée
                  </p>
                  {malTickets.map((t) => (
                    <p key={t.ticketCode} className="text-xs font-mono text-blue-700">
                      Code: {t.ticketCode} · Malette N°{t.caseIndex + 1}
                    </p>
                  ))}
                  <button
                    onClick={() => window.print()}
                    className="mt-1 text-xs font-bold text-blue-700 underline flex items-center gap-1"
                  >
                    <Printer className="w-3 h-3" /> Réimprimer
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════ SPORT ════════════════════ */}
      {mode === "sport" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500">
              {matches.length} match{matches.length !== 1 ? "s" : ""} disponibles
            </p>
            <button
              onClick={() => void fetchMatches()}
              className="text-xs text-blue-700 font-bold flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Rafraîchir
            </button>
          </div>

          {matchesLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}

          {!matchesLoading && matches.length === 0 && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
              Aucun match programmé pour le moment
            </div>
          )}

          {!matchesLoading && matches.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
              {matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelMatch(m);
                    setBetType(null);
                    setSptTickets(null);
                    setSptError("");
                  }}
                  className="w-full text-left rounded-xl border-2 px-4 py-3 transition-all"
                  style={{
                    borderColor: selMatch?.id === m.id ? "#1e3a8a" : "#e5e7eb",
                    background: selMatch?.id === m.id ? "#eff6ff" : "#fff",
                  }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 font-medium truncate">
                        {m.competitionName}
                      </p>
                      <p className="text-sm font-black text-gray-900 truncate">
                        {m.homeTeam} vs {m.awayTeam}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {fmtDateTime(m.matchDate)}
                      </p>
                    </div>
                    <div className="text-right text-[11px] font-bold text-gray-600 whitespace-nowrap shrink-0">
                      <div>1 x{parseFloat(m.oddsHome).toFixed(2)}</div>
                      <div>X x{parseFloat(m.oddsDraw).toFixed(2)}</div>
                      <div>2 x{parseFloat(m.oddsAway).toFixed(2)}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selMatch && (
            <>
              {/* Bet type */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">
                  Pronostic pour{" "}
                  <span className="text-gray-800">
                    {selMatch.homeTeam} vs {selMatch.awayTeam}
                  </span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(["home", "draw", "away"] as const).map((bt) => {
                    const label =
                      bt === "home"
                        ? `1\n${selMatch.homeTeam}`
                        : bt === "draw"
                        ? "X\nNul"
                        : `2\n${selMatch.awayTeam}`;
                    const odds =
                      bt === "home"
                        ? selMatch.oddsHome
                        : bt === "draw"
                        ? selMatch.oddsDraw
                        : selMatch.oddsAway;
                    return (
                      <button
                        key={bt}
                        onClick={() => { setBetType(bt); setSptTickets(null); }}
                        className="rounded-xl border-2 p-2.5 flex flex-col items-center gap-0.5 transition-all active:scale-95"
                        style={{
                          borderColor: betType === bt ? "#1e3a8a" : "#e5e7eb",
                          background: betType === bt ? "#1e3a8a" : "#f9fafb",
                          color: betType === bt ? "#fff" : "#374151",
                        }}
                      >
                        <span className="text-sm font-black">
                          {bt === "home" ? "1" : bt === "draw" ? "X" : "2"}
                        </span>
                        <span className="text-[10px] font-medium truncate w-full text-center">
                          x{parseFloat(String(odds)).toFixed(2)}
                        </span>
                        <span
                          className="text-[9px] truncate w-full text-center leading-tight"
                          style={{ opacity: 0.75 }}
                        >
                          {label.split("\n")[1]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">
                  Montant (FC)
                </label>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setSptAmount(String(p)); setSptTickets(null); }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all"
                      style={
                        sptAmount === String(p)
                          ? { background: "#1e3a8a", color: "#fff", borderColor: "#1e3a8a" }
                          : { background: "#fff", color: "#374151", borderColor: "#e5e7eb" }
                      }
                    >
                      {fmtFc(p)}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={sptAmount}
                  onChange={(e) => { setSptAmount(e.target.value); setSptTickets(null); }}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base font-bold text-gray-800 outline-none focus:border-blue-500"
                  placeholder="Montant en FC"
                  min={100}
                />
              </div>

              {/* Qty */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">
                  Nombre de tickets
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setSptQty((q) => Math.max(1, q - 1)); setSptTickets(null); }}
                    className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 text-xl hover:bg-gray-50 transition-all"
                  >
                    −
                  </button>
                  <span className="flex-1 text-center text-2xl font-black text-gray-900">
                    {sptQty}
                  </span>
                  <button
                    onClick={() => { setSptQty((q) => Math.min(20, q + 1)); setSptTickets(null); }}
                    className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 text-xl hover:bg-gray-50 transition-all"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Summary */}
              {betType && sptAmountInt > 0 && selectedOdds && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700 font-medium">Total à encaisser</span>
                    <span className="font-black text-blue-800">
                      {fmtFc(sptAmountInt * sptQty)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-blue-600">Gain max par ticket</span>
                    <span className="font-bold text-blue-700">
                      {fmtFc(Math.round(sptAmountInt * selectedOdds))}
                    </span>
                  </div>
                </div>
              )}

              {sptError && (
                <p className="text-sm text-red-600 font-medium">{sptError}</p>
              )}

              <button
                onClick={() => { void handleSportSubmit(); }}
                disabled={sptLoading || !betType || sptAmountInt < 100}
                className="w-full py-3.5 rounded-xl font-black text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#1e3a8a,#3b82f6)" }}
              >
                {sptLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                Émettre {sptQty} ticket{sptQty > 1 ? "s" : ""}{" "}
                {sptAmountInt > 0 ? `· ${fmtFc(sptAmountInt * sptQty)}` : ""}
              </button>

              {sptTickets && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 space-y-1">
                  <p className="text-xs font-black text-blue-800">
                    ✅ {sptTickets.length} ticket{sptTickets.length > 1 ? "s" : ""} émis
                    — Impression lancée
                  </p>
                  {sptTickets.map((t) => (
                    <p key={t.ticketCode} className="text-xs font-mono text-blue-700">
                      Code: {t.ticketCode} · x{t.odds.toFixed(2)} · Gain max:{" "}
                      {fmtFc(t.potentialPayoutFc)}
                    </p>
                  ))}
                  <button
                    onClick={() => window.print()}
                    className="mt-1 text-xs font-bold text-blue-700 underline flex items-center gap-1"
                  >
                    <Printer className="w-3 h-3" /> Réimprimer
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════ VERIFY ════════════════════ */}
      {mode === "verify" && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500 font-medium">
            Entrez le code du ticket pour vérifier le résultat et payer le client.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={verifyCode}
              onChange={(e) => {
                setVerifyCode(e.target.value.toUpperCase());
                setVerifyResult(null);
                setVerifyError("");
                setPaySuccess(false);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") void handleVerify(); }}
              placeholder="Ex: HGKM2PQ7"
              maxLength={8}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base font-mono font-bold tracking-widest text-gray-800 outline-none focus:border-blue-500 uppercase"
            />
            <button
              onClick={() => void handleVerify()}
              disabled={verifyLoading || verifyCode.trim().length < 6}
              className="px-4 rounded-xl font-bold text-white flex items-center gap-2 transition-all disabled:opacity-60"
              style={{ background: "#1e3a8a" }}
            >
              {verifyLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </button>
          </div>

          {verifyError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600 font-medium">
              {verifyError}
            </div>
          )}

          {verifyResult && (
            <div
              className="rounded-xl border-2 p-4 space-y-3"
              style={{
                borderColor:
                  verifyResult.status === "won" || verifyResult.status === "paid"
                    ? "#16a34a"
                    : verifyResult.status === "lost"
                    ? "#dc2626"
                    : "#d1d5db",
                background:
                  verifyResult.status === "won" || verifyResult.status === "paid"
                    ? "#f0fdf4"
                    : verifyResult.status === "lost"
                    ? "#fef2f2"
                    : "#f9fafb",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">
                    {verifyResult.gameType === "malette" ? "🧳 Malette" : "⚽ Sport"}
                  </p>
                  <p className="text-base font-black text-gray-900 font-mono tracking-wide">
                    {verifyResult.ticketCode}
                  </p>
                </div>
                <div
                  className="rounded-lg px-3 py-1.5 text-xs font-black"
                  style={{
                    background:
                      verifyResult.status === "won"
                        ? "#16a34a"
                        : verifyResult.status === "paid"
                        ? "#6b7280"
                        : verifyResult.status === "lost"
                        ? "#dc2626"
                        : "#f59e0b",
                    color: "#fff",
                  }}
                >
                  {verifyResult.status === "won"
                    ? "🏆 GAGNANT"
                    : verifyResult.status === "paid"
                    ? "✅ PAYÉ"
                    : verifyResult.status === "lost"
                    ? "❌ PERDANT"
                    : "⏳ EN ATTENTE"}
                </div>
              </div>

              {/* Details */}
              <div className="text-sm space-y-1 text-gray-700">
                <div className="flex justify-between">
                  <span className="font-medium">Mise</span>
                  <span className="font-black">{fmtFc(verifyResult.amountFc)}</span>
                </div>
                {verifyResult.potentialPayoutFc != null && (
                  <div className="flex justify-between">
                    <span className="font-medium">Gain potentiel</span>
                    <span className="font-bold">{fmtFc(verifyResult.potentialPayoutFc)}</span>
                  </div>
                )}
                {verifyResult.actualPayoutFc != null && verifyResult.actualPayoutFc > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span className="font-bold">Gain réel</span>
                    <span className="font-black text-base">
                      {fmtFc(verifyResult.actualPayoutFc)}
                    </span>
                  </div>
                )}
                {verifyResult.homeTeam && (
                  <div className="flex justify-between">
                    <span className="font-medium">Match</span>
                    <span className="font-bold text-right">
                      {verifyResult.homeTeam} vs {verifyResult.awayTeam}
                    </span>
                  </div>
                )}
              </div>

              {/* Pay button */}
              {verifyResult.status === "won" && !paySuccess && (
                <button
                  onClick={() => void handlePay()}
                  disabled={payLoading}
                  className="w-full py-3 rounded-xl font-black text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{ background: "#16a34a" }}
                >
                  {payLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Gamepad2 className="w-4 h-4" />
                  )}
                  Payer {fmtFc(verifyResult.actualPayoutFc ?? 0)} au client
                </button>
              )}

              {paySuccess && (
                <div className="rounded-lg bg-green-600 px-4 py-2.5 text-center text-sm font-black text-white">
                  ✅ Paiement enregistré
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
