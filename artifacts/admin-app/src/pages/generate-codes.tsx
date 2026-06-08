import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Loader2, Copy, CheckCheck, Download, Shuffle } from "lucide-react";

interface GenerateResult {
  generated: number;
  winners: number;
  codes: string[];
  distribution: {
    super: number;
    tresGrand: number;
    grand: number;
    gagnant: number;
    petit: number;
    perdant: number;
  };
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Erreur réseau");
  }
  return res.json();
}

// Prize structure per 1000 codes
const PRIZE_STRUCTURE = [
  { label: "Super Gagnant",         count: 1,   prize: "50 000 FC", total: "50 000 FC",  color: "#F5C518" },
  { label: "Très Grand Gagnant",    count: 2,   prize: "25 000 FC", total: "50 000 FC",  color: "#f97316" },
  { label: "Grand Gagnant",         count: 10,  prize: "10 000 FC", total: "100 000 FC", color: "#a855f7" },
  { label: "Gagnant",               count: 10,  prize: "5 000 FC",  total: "50 000 FC",  color: "#3b82f6" },
  { label: "Remboursé (Petit)",     count: 100, prize: "= prix ticket", total: "50 000 FC", color: "#22c55e" },
  { label: "Perdant",               count: 877, prize: "0 FC",      total: "0 FC",       color: "#6b7280" },
];

export default function GenerateCodes() {
  const { toast } = useToast();
  const [count, setCount] = useState(1000);
  const [price, setPrice] = useState(500);
  const [series, setSeries] = useState("A");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/admin/codes/generate", {
        method: "POST",
        body: JSON.stringify({ count, price, series }),
      }),
    onSuccess: (data: GenerateResult) => {
      setResult(data);
      toast({
        title: `${data.generated} codes générés`,
        description: `${data.winners} gagnants sur ${data.generated} — Série ${series}`,
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
    const header = "Code,Série,Prix (FC)\n";
    const rows = result.codes.map((c) => `${c},${series},${price}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `halgo-codes-${series}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scaledCount = (base: number) => Math.round(base * (count / 1000));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Ticket className="w-6 h-6 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Génération de codes</h1>
          <p className="text-zinc-400 text-sm">Codes alphanumériques avec distribution automatique des prix</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Form */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Paramètres du lot</CardTitle>
              <CardDescription className="text-zinc-400">
                Chaque lot de 1 000 codes contient exactement 123 gagnants.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 text-sm">Quantité</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5000}
                    value={count}
                    onChange={(e) => setCount(Math.max(1, Math.min(5000, parseInt(e.target.value) || 1)))}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 text-sm">Prix du ticket (FC)</Label>
                  <Input
                    type="number"
                    min={100}
                    value={price}
                    onChange={(e) => setPrice(parseInt(e.target.value) || 500)}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-sm">Série</Label>
                <Input
                  maxLength={10}
                  placeholder="A"
                  value={series}
                  onChange={(e) => setSeries(e.target.value.toUpperCase())}
                  className="bg-zinc-800 border-zinc-700 text-white font-mono"
                />
              </div>
              {/* Summary 70/30 */}
              {(() => {
                const revenue = count * price;
                const fixedPrizes = (Math.round(1*(count/1000))||0)*50000 + (Math.max(1,Math.round(2*(count/1000)))||0)*25000 + Math.round(10*(count/1000))*10000 + Math.round(10*(count/1000))*5000;
                const petitRatio = Math.max(0, 0.70 - 250 / price);
                const petitCount = Math.round(count * petitRatio);
                const totalPrizes = fixedPrizes + petitCount * price;
                const company = revenue - totalPrizes;
                const pct = revenue > 0 ? Math.round((company / revenue) * 100) : 30;
                return (
              <div className="p-3 bg-zinc-800/60 rounded-lg space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Total billets</span>
                  <span className="text-white font-medium">{count.toLocaleString("fr-FR")}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Recette brute</span>
                  <span className="text-indigo-300 font-bold">{revenue.toLocaleString("fr-FR")} FC</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Redistribué (70%)</span>
                  <span className="text-amber-400 font-medium">{totalPrizes.toLocaleString("fr-FR")} FC</span>
                </div>
                <div className="flex justify-between text-xs border-t border-zinc-700 pt-1">
                  <span className="text-green-400 font-semibold">Entreprise ({pct}%)</span>
                  <span className="text-green-400 font-bold">{company.toLocaleString("fr-FR")} FC</span>
                </div>
              </div>
                );
              })()}

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

          {/* Prize structure preview */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm">Structure des prix (par {count.toLocaleString("fr-FR")} codes)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {PRIZE_STRUCTURE.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
                    <span className="text-zinc-300">{row.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 font-mono">{scaledCount(row.count)}×</span>
                    <span className="font-medium" style={{ color: row.color }}>{row.prize}</span>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-zinc-800 flex justify-between text-xs">
                <span className="text-zinc-400 font-bold">Total redistribué</span>
                <span className="text-amber-400 font-bold">
                  {((Math.round(count / 1000) || 1) * 300000).toLocaleString("fr-FR")} FC
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Result */}
        <div className="lg:col-span-2">
          <Card className="bg-zinc-900 border-zinc-800 h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-base">Codes générés</CardTitle>
                  <CardDescription className="text-zinc-400">
                    {result
                      ? `${result.generated} codes — ${result.winners} gagnants`
                      : "Les codes apparaîtront ici après génération"}
                  </CardDescription>
                </div>
                {result && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 h-8 text-xs" onClick={copyAll}>
                      {copied ? <CheckCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                      {copied ? "Copié" : "Copier"}
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
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Distribution stats */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Super", val: result.distribution.super, color: "#F5C518" },
                      { label: "Très Grand", val: result.distribution.tresGrand, color: "#f97316" },
                      { label: "Grand", val: result.distribution.grand, color: "#a855f7" },
                      { label: "Gagnant", val: result.distribution.gagnant, color: "#3b82f6" },
                      { label: "Remboursé", val: result.distribution.petit, color: "#22c55e" },
                      { label: "Perdant", val: result.distribution.perdant, color: "#6b7280" },
                    ].map((s) => (
                      <div key={s.label} className="bg-zinc-800/60 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-zinc-400 uppercase tracking-wide">{s.label}</p>
                        <p className="text-lg font-bold" style={{ color: s.color }}>{s.val}</p>
                      </div>
                    ))}
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
