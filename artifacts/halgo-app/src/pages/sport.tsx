import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/react";
import { useLocation } from "wouter";
import { ArrowLeft, Trophy, Clock, Loader2, ChevronRight, CheckCircle, XCircle, AlertCircle, Wallet, RefreshCw } from "lucide-react";

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".") + " FC";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
    + " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const COMP_META: Record<string, { label: string; flag: string; color: string }> = {
  WC:  { label: "Coupe du Monde",   flag: "🌍", color: "#c0392b" },
  CLI: { label: "Copa Libertadores",flag: "🏆", color: "#1a73e8" },
  BSA: { label: "Brasileirão",      flag: "🇧🇷", color: "#009c3b" },
  CL:  { label: "Champions League", flag: "🏆", color: "#1a73e8" },
  FL1: { label: "Ligue 1",          flag: "🇫🇷", color: "#003399" },
  BL1: { label: "Bundesliga",       flag: "🇩🇪", color: "#d00000" },
  PL:  { label: "Premier League",   flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", color: "#3d195b" },
  SA:  { label: "Serie A",          flag: "🇮🇹", color: "#1565c0" },
  PD:  { label: "La Liga",          flag: "🇪🇸", color: "#c0392b" },
  PPL: { label: "Primeira Liga",    flag: "🇵🇹", color: "#006600" },
  DED: { label: "Eredivisie",       flag: "🇳🇱", color: "#e66000" },
  ELC: { label: "Championship",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", color: "#1e3a5f" },
};

interface Match {
  id: number;
  fixtureId: number;
  competition: string;
  competitionName: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamCrest?: string | null;
  awayTeamCrest?: string | null;
  matchDate: string;
  status: string;
  oddsHome: string;
  oddsDraw: string;
  oddsAway: string;
}

interface Bet {
  id: number;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  betType: string;
  amount: string;
  odds: string;
  potentialWin: string;
  status: string;
  createdAt: string;
}

type Tab = "matchs" | "paris";
type BetType = "home" | "draw" | "away";

interface BetSlip {
  match: Match;
  betType: BetType;
  odds: number;
}

export default function SportPage() {
  const { getToken } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("matchs");

  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);

  const [bets, setBets] = useState<Bet[]>([]);
  const [sportBalance, setSportBalance] = useState<number>(50000);
  const [loadingBets, setLoadingBets] = useState(false);

  const [betSlip, setBetSlip] = useState<BetSlip | null>(null);
  const [betAmount, setBetAmount] = useState("1000");
  const [placingBet, setPlacingBet] = useState(false);
  const [betResult, setBetResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getToken().catch(() => null);
    const headers: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (options.body) headers["Content-Type"] = "application/json";
    return fetch(url, { ...options, headers, credentials: "include" });
  }, [getToken]);

  const loadMatches = useCallback(async () => {
    setLoadingMatches(true);
    setMatchError(null);
    try {
      const r = await authFetch("/api/sport/matches");
      if (!r.ok) throw new Error("Erreur chargement");
      const d = await r.json() as { matches: Match[] };
      setMatches(d.matches ?? []);
    } catch {
      setMatchError("Impossible de charger les matchs. Réessayez.");
    } finally {
      setLoadingMatches(false);
    }
  }, [authFetch]);

  const loadBets = useCallback(async () => {
    setLoadingBets(true);
    try {
      const r = await authFetch("/api/sport/bets/my");
      if (!r.ok) return;
      const d = await r.json() as { bets: Bet[]; balance: number };
      setBets(d.bets ?? []);
      setSportBalance(d.balance ?? 50000);
    } finally {
      setLoadingBets(false);
    }
  }, [authFetch]);

  useEffect(() => { loadMatches(); }, [loadMatches]);
  useEffect(() => { if (tab === "paris") loadBets(); }, [tab, loadBets]);

  const openBetSlip = (match: Match, betType: BetType) => {
    const oddsMap = { home: match.oddsHome, draw: match.oddsDraw, away: match.oddsAway };
    setBetSlip({ match, betType, odds: parseFloat(oddsMap[betType]) });
    setBetAmount("1000");
    setBetResult(null);
  };

  const placeBet = async () => {
    if (!betSlip) return;
    const amount = parseInt(betAmount, 10);
    if (isNaN(amount) || amount < 100) {
      setBetResult({ ok: false, msg: "Mise minimale : 100 FC" });
      return;
    }
    setPlacingBet(true);
    setBetResult(null);
    try {
      const r = await authFetch("/api/sport/bets", {
        method: "POST",
        body: JSON.stringify({ matchId: betSlip.match.id, betType: betSlip.betType, amount }),
      });
      const d = await r.json() as { error?: string; newBalance?: number };
      if (!r.ok) {
        setBetResult({ ok: false, msg: d.error ?? "Erreur" });
      } else {
        setSportBalance(d.newBalance ?? sportBalance - amount);
        setBetResult({ ok: true, msg: "Pari enregistré !" });
        setTimeout(() => { setBetSlip(null); setBetResult(null); }, 1400);
      }
    } catch {
      setBetResult({ ok: false, msg: "Erreur réseau" });
    } finally {
      setPlacingBet(false);
    }
  };

  // Group matches by competition
  const grouped = matches.reduce<Record<string, Match[]>>((acc, m) => {
    (acc[m.competition] = acc[m.competition] ?? []).push(m);
    return acc;
  }, {});

  const betTypeLabel: Record<BetType, string> = { home: "Victoire domicile", draw: "Match nul", away: "Victoire extérieur" };
  const betStatusColor: Record<string, string> = {
    pending: "#f5a623",
    won:     "#27ae60",
    lost:    "#e74c3c",
    cancelled: "#888",
  };
  const betStatusLabel: Record<string, string> = {
    pending:   "En attente",
    won:       "Gagné",
    lost:      "Perdu",
    cancelled: "Annulé",
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "linear-gradient(160deg,#05120a 0%,#0a1f10 100%)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button onClick={() => navigate("/app")} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl">⚽</span>
          <span className="text-white font-black text-lg tracking-wide">Paris Sportifs</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 bg-[#1a3a22] border border-[#27ae60]/30 rounded-full px-3 py-1">
          <Wallet className="w-3.5 h-3.5 text-[#27ae60]" />
          <span className="text-[#27ae60] font-bold text-xs">{formatFC(sportBalance)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mb-4 bg-white/5 rounded-xl p-1 gap-1">
        {(["matchs", "paris"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
            style={{
              background: tab === t ? "#27ae60" : "transparent",
              color: tab === t ? "#fff" : "rgba(255,255,255,0.5)",
            }}
          >
            {t === "matchs" ? "⚽ Matchs" : "🎯 Mes paris"}
          </button>
        ))}
      </div>

      {/* MATCHS TAB */}
      {tab === "matchs" && (
        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-5">
          {loadingMatches && (
            <div className="flex flex-col items-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#27ae60]" />
              <p className="text-white/50 text-sm">Chargement des matchs…</p>
            </div>
          )}
          {matchError && (
            <div className="flex flex-col items-center py-12 gap-3">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-white/70 text-sm text-center">{matchError}</p>
              <button
                onClick={loadMatches}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#27ae60] text-white text-sm font-bold"
              >
                <RefreshCw className="w-4 h-4" /> Réessayer
              </button>
            </div>
          )}
          {!loadingMatches && !matchError && Object.keys(grouped).length === 0 && (
            <div className="flex flex-col items-center py-16 gap-3">
              <Trophy className="w-10 h-10 text-white/20" />
              <p className="text-white/50 text-sm text-center">Aucun match à venir pour l'instant</p>
            </div>
          )}
          {!loadingMatches && !matchError && Object.entries(grouped).map(([comp, compMatches]) => {
            const meta = COMP_META[comp] ?? { label: comp, flag: "⚽", color: "#27ae60" };
            return (
              <div key={comp}>
                {/* Competition header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{meta.flag}</span>
                  <span className="text-white/80 font-bold text-xs uppercase tracking-widest">{meta.label}</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <div className="space-y-2.5">
                  {compMatches.map((match) => (
                    <div
                      key={match.id}
                      className="rounded-2xl border border-white/10 overflow-hidden"
                      style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.02) 100%)" }}
                    >
                      {/* Match info */}
                      <div className="px-4 pt-3 pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                            {match.homeTeamCrest && (
                              <img src={match.homeTeamCrest} alt="" className="w-7 h-7 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            )}
                            <span className="text-white text-xs font-bold text-center leading-tight truncate w-full px-1">{match.homeTeam}</span>
                          </div>
                          <div className="flex flex-col items-center mx-2 gap-0.5 flex-shrink-0">
                            <span className="text-white/30 text-[10px] font-mono">VS</span>
                            <div className="flex items-center gap-1 text-white/40">
                              <Clock className="w-3 h-3" />
                              <span className="text-[10px]">{formatDate(match.matchDate)}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                            {match.awayTeamCrest && (
                              <img src={match.awayTeamCrest} alt="" className="w-7 h-7 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            )}
                            <span className="text-white text-xs font-bold text-center leading-tight truncate w-full px-1">{match.awayTeam}</span>
                          </div>
                        </div>
                      </div>

                      {/* Odds buttons */}
                      <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
                        {(["home", "draw", "away"] as BetType[]).map((type) => {
                          const oddsVal = parseFloat(type === "home" ? match.oddsHome : type === "draw" ? match.oddsDraw : match.oddsAway);
                          const label = type === "home" ? "1" : type === "draw" ? "X" : "2";
                          return (
                            <button
                              key={type}
                              onClick={() => openBetSlip(match, type)}
                              className="flex flex-col items-center py-2 rounded-xl border border-white/15 hover:border-[#27ae60]/60 hover:bg-[#27ae60]/10 transition-all group"
                              style={{ background: "rgba(255,255,255,0.04)" }}
                            >
                              <span className="text-white/50 text-[10px] font-bold group-hover:text-[#27ae60]/70">{label}</span>
                              <span className="text-white font-black text-sm group-hover:text-[#27ae60]">{oddsVal.toFixed(2)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PARIS TAB */}
      {tab === "paris" && (
        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3">
          {loadingBets && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#27ae60]" />
            </div>
          )}
          {!loadingBets && bets.length === 0 && (
            <div className="flex flex-col items-center py-16 gap-3">
              <Trophy className="w-10 h-10 text-white/20" />
              <p className="text-white/50 text-sm">Aucun pari pour l'instant</p>
              <button onClick={() => setTab("matchs")} className="flex items-center gap-1.5 text-[#27ae60] text-sm font-bold">
                Voir les matchs <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {!loadingBets && bets.map((bet) => (
            <div
              key={bet.id}
              className="rounded-2xl border border-white/10 px-4 py-3"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{bet.homeTeam} vs {bet.awayTeam}</p>
                  <p className="text-white/40 text-xs mt-0.5">{betTypeLabel[bet.betType as BetType] ?? bet.betType} · cote {parseFloat(bet.odds).toFixed(2)}</p>
                  <p className="text-white/30 text-[10px] mt-1">{new Date(bet.createdAt).toLocaleDateString("fr-FR")}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: betStatusColor[bet.status] + "22", color: betStatusColor[bet.status] }}>
                    {betStatusLabel[bet.status] ?? bet.status}
                  </span>
                  <span className="text-white/70 text-xs font-bold">{formatFC(parseFloat(bet.amount))}</span>
                  <span className="text-[#f5a623] text-[10px]">→ {formatFC(parseFloat(bet.potentialWin))}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BET SLIP MODAL */}
      {betSlip && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.75)" }} onClick={() => { if (!placingBet) setBetSlip(null); }}>
          <div
            className="w-full rounded-t-3xl px-5 pt-5 pb-8 space-y-4"
            style={{ background: "linear-gradient(160deg,#0d2015 0%,#091510 100%)", border: "1px solid rgba(39,174,96,0.25)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center -mt-1 mb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="text-center">
              <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Bulletin de pari</p>
              <p className="text-white font-black text-base">{betSlip.match.homeTeam} vs {betSlip.match.awayTeam}</p>
              <p className="text-[#27ae60] font-bold text-sm mt-0.5">{betTypeLabel[betSlip.betType]} · cote {betSlip.odds.toFixed(2)}</p>
            </div>

            {/* Amount input */}
            <div className="space-y-2">
              <label className="text-white/50 text-xs font-bold uppercase tracking-widest">Mise (FC)</label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-lg font-bold text-center focus:outline-none focus:border-[#27ae60]"
                placeholder="1000"
                min={100}
                step={100}
              />
              <div className="flex gap-2 flex-wrap">
                {[500, 1000, 5000, 10000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setBetAmount(String(v))}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/20 text-white/70 hover:border-[#27ae60] hover:text-[#27ae60] transition-colors"
                  >
                    {formatFC(v)}
                  </button>
                ))}
              </div>
            </div>

            {/* Potential win */}
            {betAmount && !isNaN(parseInt(betAmount)) && (
              <div className="flex items-center justify-between bg-[#27ae60]/10 rounded-xl px-4 py-3 border border-[#27ae60]/20">
                <span className="text-white/60 text-sm">Gain potentiel</span>
                <span className="text-[#27ae60] font-black text-base">
                  {formatFC(Math.round(parseInt(betAmount) * betSlip.odds))}
                </span>
              </div>
            )}

            {betResult && (
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${betResult.ok ? "bg-[#27ae60]/15 border border-[#27ae60]/30" : "bg-red-500/15 border border-red-500/30"}`}>
                {betResult.ok
                  ? <CheckCircle className="w-4 h-4 text-[#27ae60] flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                <span className={`text-sm font-bold ${betResult.ok ? "text-[#27ae60]" : "text-red-400"}`}>{betResult.msg}</span>
              </div>
            )}

            <button
              onClick={placeBet}
              disabled={placingBet}
              className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#27ae60 0%,#1e8449 100%)" }}
            >
              {placingBet ? <Loader2 className="w-5 h-5 animate-spin" /> : "✅ Confirmer le pari"}
            </button>

            <p className="text-white/30 text-xs text-center">Solde disponible : {formatFC(sportBalance)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
