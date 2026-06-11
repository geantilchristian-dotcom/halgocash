import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Ticket, Loader2, Copy, CheckCheck, Download, Shuffle,
  User, ChevronDown, TrendingUp, Trophy, Coins,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface TierInfo { count: number; prize: number }
interface PrizeTiers {
  jackpot:     TierInfo;
  grand:       TierInfo;
  moyen:       TierInfo;
  petit:       TierInfo;
  rembourse:   TierInfo;
  consolation: TierInfo;
  perdant:     { count: number };
  totalWinners: number;
  prizePool:    number;
  companyRevenue: number;
  winRate:      number;
}

interface GenerateResult {
  generated: number;
  winners:   number;
  losers:    number;
  winRate:   string;
  codes:     string[];
  distribution: PrizeTiers;
}

interface Vendor {
  vendorId:      number;
  vendorName:    string;
  vendorLocation: string;
  totalTickets:  number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Erreur réseau");
  }
  return res.json();
}

function fc(n: number) {
  return n.toLocaleString("fr-FR") + " FC";
}

/**
 * Mirror of the backend buildPrizeDistribution logic — used for live preview.
 * Keep in sync with artifacts/api-server/src/routes/admin.ts.
 */
function computeDistribution(count: number, price: number, marginPercent: number): PrizeTiers {
  const margin        = Math.max(0, Math.min(99, marginPercent)) / 100;
  const r             = count / 1000;
  const prizePool     = Math.floor(count * price * (1 - margin));
  const targetWinners = Math.round(count * (1 - margin));
  const minWin        = Math.max(50, Math.floor(price * 0.10));

  const jackpotCount   = count >= 100 ? Math.max(1, Math.round(r))      : 0;
  const grandCount     = count >= 200 ? Math.max(0, Math.round(2 * r))  : 0;
  const moyenCount     = Math.max(0, Math.round(7  * r));
  const petitCount     = Math.max(0, Math.round(15 * r));
  const rembourseCount = Math.max(0, Math.round(25 * r));

  const jackpotPrize  = Math.floor(Math.min(200 * price, prizePool * 0.30));
  const grandPrize    = Math.floor(Math.min(40  * price, prizePool * 0.10));
  const moyenPrize    = Math.floor(Math.min(10  * price, prizePool * 0.04));
  const petitPrize    = Math.floor(Math.min(4   * price, prizePool * 0.02));

  const fixedSpend =
    jackpotCount * jackpotPrize + grandCount * grandPrize +
    moyenCount * moyenPrize + petitCount * petitPrize +
    rembourseCount * price;
  const fixedWinners = jackpotCount + grandCount + moyenCount + petitCount + rembourseCount;

  const consolBudget = Math.max(0, prizePool - fixedSpend);
  let consolCount = Math.max(0, targetWinners - fixedWinners);
  let consolPrize = consolCount > 0 ? Math.floor(consolBudget / consolCount) : 0;
  if (consolPrize < minWin) {
    consolCount = Math.floor(consolBudget / minWin);
    consolPrize = consolCount > 0 ? minWin : 0;
  }

  const totalWinners = fixedWinners + consolCount;

  return {
    jackpot:     { count: jackpotCount,   prize: jackpotPrize },
    grand:       { count: grandCount,     prize: grandPrize },
    moyen:       { count: moyenCount,     prize: moyenPrize },
    petit:       { count: petitCount,     prize: petitPrize },
    rembourse:   { count: rembourseCount, prize: price },
    consolation: { count: consolCount,    prize: consolPrize },
    perdant:     { count: count - totalWinners },
    totalWinners,
    prizePool,
    companyRevenue: count * price - prizePool,
    winRate: count > 0 ? Math.round((totalWinners / count) * 100) : 0,
  };
}

// ── Tier rows config ──────────────────────────────────────────────────────────

const TIER_CONFIG = [
  { key: "jackpot",     label: "🏆 Jackpot",     color: "#F5C518" },
  { key: "grand",       label: "🥇 Grand lot",    color: "#f97316" },
  { key: "moyen",       label: "🥈 Lot moyen",    color: "#a855f7" },
  { key: "petit",       label: "🥉 Petit lot",    color: "#3b82f6" },
  { key: "rembourse",   label: "🎫 Remboursé",    color: "#22c55e" },
  { key: "consolation", label: "🎟 Consolation",  color: "#06b6d4" },
  { key: "perdant",     label: "❌ Perdants",     color: "#6b7280" },
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export default function GenerateCodes() {
  const { toast } = useToast();
  const [count,          setCount]          = useState(1000);
  const [price,          setPrice]          = useState(500);
  const [series,         setSeries]         = useState("A");
  const [marginPercent,  setMarginPercent]  = useState(30);
  const [selectedVendorId, setSelectedVendorId] = useState<number | "">("");
  const [result,         setResult]         = useState<GenerateResult | null>(null);
  const [copied,         setCopied]         = useState(false);

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/admin/workers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/workers", { credentials: "include" });
      if (!res.ok) throw new Error("Erreur");
      return res.json() as Promise<Vendor[]>;
    },
  });

  const preview = useMemo(
    () => computeDistribution(count, price, marginPercent),
    [count, price, marginPercent],
  );

  const generateMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/admin/codes/generate", {
        method: "POST",
        body: JSON.stringify({
          count,
          price,
          series,
          marginPercent,
          vendorId: selectedVendorId !== "" ? selectedVendorId : undefined,
        }),
      }) as Promise<GenerateResult>,
    onSuccess: (data) => {
      setResult(data);
      const vendorName = vendors.find(v => v.vendorId === selectedVendorId)?.vendorName;
      toast({
        title: `${data.generated} codes générés`,
        description: vendorName
          ? `Assignés à ${vendorName} — ${data.winners} gagnants (${data.winRate})`
          : `${data.winners} gagnants (${data.winRate}) — Série ${series}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const copyAll = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCSV = () => {
    if (!result) return;
    const vendorName = vendors.find(v => v.vendorId === selectedVendorId)?.vendorName ?? "";
    const header = "Code,Série,Prix (FC),Vendeur\n";
    const rows = result.codes.map((c) => `${c},${series},${price},${vendorName}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `halgo-codes-${series}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedVendor = vendors.find(v => v.vendorId === selectedVendorId);
  const dist = result?.distribution ?? preview;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Ticket className="w-6 h-6 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Génération de codes</h1>
          <p className="text-zinc-400 text-sm">
            Définissez la marge entreprise — la distribution des prix se calcule automatiquement
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column: form ─────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">

          {/* Form card */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Paramètres du lot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Vendor */}
              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-sm flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  Vendeur (optionnel)
                </Label>
                <div className="relative">
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full appearance-none bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 pr-8"
                  >
                    <option value="">— Sans vendeur —</option>
                    {vendors.map((v) => (
                      <option key={v.vendorId} value={v.vendorId}>
                        {v.vendorName} · {v.vendorLocation}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                </div>
                {selectedVendor && (
                  <p className="text-xs text-indigo-400">
                    {selectedVendor.totalTickets} tickets déjà assignés
                  </p>
                )}
              </div>

              {/* Quantité + Prix */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 text-sm">Quantité</Label>
                  <Input
                    type="number" min={1} max={5000}
                    value={count}
                    onChange={(e) => setCount(Math.max(1, Math.min(5000, parseInt(e.target.value) || 1)))}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 text-sm">Prix ticket (FC)</Label>
                  <Input
                    type="number" min={100}
                    value={price}
                    onChange={(e) => setPrice(Math.max(100, parseInt(e.target.value) || 500))}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
              </div>

              {/* Série */}
              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-sm">Série</Label>
                <Input
                  maxLength={10} placeholder="A"
                  value={series}
                  onChange={(e) => setSeries(e.target.value.toUpperCase())}
                  className="bg-zinc-800 border-zinc-700 text-white font-mono"
                />
              </div>

              {/* Marge entreprise slider */}
              <div className="space-y-3 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-200 text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    Marge entreprise
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min={5} max={90}
                      value={marginPercent}
                      onChange={(e) => setMarginPercent(Math.max(5, Math.min(90, parseInt(e.target.value) || 30)))}
                      className="w-16 h-7 text-center bg-zinc-700 border-zinc-600 text-white text-sm p-1"
                    />
                    <span className="text-zinc-300 text-sm font-bold">%</span>
                  </div>
                </div>
                <Slider
                  min={5} max={80} step={1}
                  value={[marginPercent]}
                  onValueChange={([v]) => setMarginPercent(v)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>5% (très généreux)</span>
                  <span>80% (conservateur)</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Sur <span className="text-white font-medium">{fc(count * price)}</span> de recette :{" "}
                  <span className="text-green-400 font-semibold">{fc(preview.companyRevenue)}</span> pour l'entreprise,{" "}
                  <span className="text-amber-400 font-semibold">{fc(preview.prizePool)}</span> en prix.
                </p>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-zinc-800/60 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-0.5">Gagnants</p>
                  <p className="text-lg font-bold text-emerald-400">{preview.winRate}%</p>
                </div>
                <div className="bg-zinc-800/60 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-0.5">Perdants</p>
                  <p className="text-lg font-bold text-zinc-400">{marginPercent}%</p>
                </div>
                <div className="bg-zinc-800/60 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-0.5">Min. gain</p>
                  <p className="text-lg font-bold text-cyan-400">
                    {Math.max(50, Math.floor(price * 0.10)).toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !series}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Génération...</>
                ) : (
                  <><Shuffle className="w-4 h-4 mr-2" />Générer {count.toLocaleString("fr-FR")} codes</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Live preview prize table */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                {result ? "Distribution réelle" : "Aperçu de la distribution"}
              </CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                Pour {count.toLocaleString("fr-FR")} tickets à {price.toLocaleString("fr-FR")} FC
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {TIER_CONFIG.map(({ key, label, color }) => {
                const tier = key === "perdant" ? dist.perdant : dist[key as keyof Omit<PrizeTiers, "perdant" | "totalWinners" | "prizePool" | "companyRevenue" | "winRate">];
                const isTierInfo = (t: unknown): t is TierInfo => typeof t === "object" && t !== null && "prize" in t;
                const cnt   = tier.count;
                const prize = isTierInfo(tier) ? tier.prize : 0;
                const pct   = count > 0 ? ((cnt / count) * 100).toFixed(1) : "0";
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-zinc-300 w-28 shrink-0">{label}</span>
                    <span className="font-mono text-zinc-400 w-10 text-right shrink-0">
                      {cnt.toLocaleString("fr-FR")}×
                    </span>
                    <span className="font-semibold shrink-0" style={{ color }}>
                      {prize > 0 ? fc(prize) : "—"}
                    </span>
                    <span className="text-zinc-600 ml-auto">{pct}%</span>
                  </div>
                );
              })}

              <div className="pt-2 mt-1 border-t border-zinc-800 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Total gagnants</span>
                  <span className="text-emerald-400 font-bold">
                    {dist.totalWinners.toLocaleString("fr-FR")} ({dist.winRate}%)
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Pool de prix</span>
                  <span className="text-amber-400 font-bold">{fc(dist.prizePool)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-green-400 font-semibold flex items-center gap-1">
                    <Coins className="w-3 h-3" />Entreprise
                  </span>
                  <span className="text-green-400 font-bold">{fc(dist.companyRevenue)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: result ───────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <Card className="bg-zinc-900 border-zinc-800 h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-base">Codes générés</CardTitle>
                  <CardDescription className="text-zinc-400">
                    {result
                      ? `${result.generated} codes — ${result.winners} gagnants (${result.winRate})${selectedVendor ? ` — ${selectedVendor.vendorName}` : ""}`
                      : "Les codes apparaîtront ici après génération"}
                  </CardDescription>
                </div>
                {result && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 h-8 text-xs" onClick={copyAll}>
                      {copied
                        ? <><CheckCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />Copié</>
                        : <><Copy className="w-3.5 h-3.5 mr-1" />Copier</>}
                    </Button>
                    <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 h-8 text-xs" onClick={downloadCSV}>
                      <Download className="w-3.5 h-3.5 mr-1" />CSV
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!result ? (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-600">
                  <Ticket className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Configurez les paramètres et cliquez sur Générer</p>
                  <p className="text-xs mt-1 text-zinc-700">L'aperçu ci-dessous se met à jour en temps réel</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Result distribution grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {TIER_CONFIG.map(({ key, label, color }) => {
                      const tier = key === "perdant"
                        ? result.distribution.perdant
                        : result.distribution[key as keyof Omit<PrizeTiers, "perdant" | "totalWinners" | "prizePool" | "companyRevenue" | "winRate">];
                      const isTierInfo = (t: unknown): t is TierInfo => typeof t === "object" && t !== null && "prize" in t;
                      return (
                        <div key={key} className="bg-zinc-800/60 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-zinc-400 truncate">{label}</p>
                          <p className="text-base font-bold mt-0.5" style={{ color }}>{tier.count}</p>
                          {isTierInfo(tier) && tier.prize > 0 && (
                            <p className="text-[10px] text-zinc-500 mt-0.5">{fc(tier.prize)}</p>
                          )}
                        </div>
                      );
                    })}
                    <div className="bg-zinc-800/60 rounded-lg p-2.5 text-center col-span-1">
                      <p className="text-[10px] text-zinc-400">💰 Entreprise</p>
                      <p className="text-base font-bold mt-0.5 text-green-400">
                        {fc(result.distribution.companyRevenue)}
                      </p>
                    </div>
                  </div>

                  {/* Code list */}
                  <div className="h-96 overflow-y-auto rounded-md bg-zinc-950 border border-zinc-800 p-3">
                    <div className="grid grid-cols-2 gap-1.5">
                      {result.codes.map((code, i) => (
                        <div
                          key={code}
                          className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800"
                        >
                          <span className="text-zinc-600 text-xs w-6 shrink-0 text-right">{i + 1}</span>
                          <span className="text-white font-mono text-sm tracking-widest">{code}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
