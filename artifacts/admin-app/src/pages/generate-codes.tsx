import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Loader2, Copy, CheckCheck, Download, Shuffle } from "lucide-react";

interface Draw {
  id: number;
  drawNumber: number;
  status: string;
  scheduledAt: string;
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

export default function GenerateCodes() {
  const { toast } = useToast();
  const [count, setCount] = useState(10);
  const [price, setPrice] = useState(500);
  const [series, setSeries] = useState("A");
  const [drawId, setDrawId] = useState<number | "">("");
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const { data: draws = [] } = useQuery<Draw[]>({
    queryKey: ["/api/admin/draws"],
    queryFn: () => apiFetch("/api/admin/draws"),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/admin/codes/generate", {
        method: "POST",
        body: JSON.stringify({
          count,
          price,
          series,
          drawId: drawId !== "" ? drawId : undefined,
        }),
      }),
    onSuccess: (data: { generated: number; codes: string[] }) => {
      setGeneratedCodes(data.codes);
      toast({
        title: `${data.generated} codes générés`,
        description: `Série ${series} — ${price} FC l'unité`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const copyAll = async () => {
    await navigator.clipboard.writeText(generatedCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCSV = () => {
    const header = "Code,Série,Prix (FC),Tirage\n";
    const drawNum = draws.find((d) => d.id === drawId)?.drawNumber ?? "";
    const rows = generatedCodes.map((c) => `${c},${series},${price},${drawNum}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `halgo-codes-serie-${series}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Ticket className="w-6 h-6 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Génération de codes</h1>
          <p className="text-zinc-400 text-sm">Créer des codes de tickets à 10 chiffres pour la vente</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Paramètres de génération</CardTitle>
            <CardDescription className="text-zinc-400">
              Les codes générés sont uniques et enregistrés dans la base de données.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm">Quantité</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
                <p className="text-zinc-500 text-xs">Max 500 par lot</p>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm">Prix unitaire (FC)</Label>
                <Input
                  type="number"
                  min={100}
                  value={price}
                  onChange={(e) => setPrice(parseInt(e.target.value) || 500)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Série</Label>
              <Input
                type="text"
                maxLength={10}
                placeholder="A"
                value={series}
                onChange={(e) => setSeries(e.target.value.toUpperCase())}
                className="bg-zinc-800 border-zinc-700 text-white font-mono"
              />
              <p className="text-zinc-500 text-xs">Identifiant de lot (ex: A, B, PROMO-1)</p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Tirage associé (optionnel)</Label>
              <select
                value={drawId}
                onChange={(e) => setDrawId(e.target.value ? parseInt(e.target.value) : "")}
                className="w-full h-9 px-3 rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">Aucun tirage</option>
                {draws.map((d) => (
                  <option key={d.id} value={d.id}>
                    Tirage #{d.drawNumber} — {d.status === "upcoming" ? "À venir" : d.status === "active" ? "Actif" : "Terminé"}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 p-3 bg-zinc-800/50 rounded-lg">
              <p className="text-zinc-400 text-xs">
                Résumé :{" "}
                <span className="text-white font-medium">{count}</span> codes ×{" "}
                <span className="text-white font-medium">{price.toLocaleString("fr-FR")} FC</span>
                {" = "}
                <span className="text-indigo-300 font-bold">{(count * price).toLocaleString("fr-FR")} FC</span>
              </p>
            </div>

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || !series}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Génération...</>
              ) : (
                <><Shuffle className="w-4 h-4 mr-2" />Générer {count} codes</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white text-base">Codes générés</CardTitle>
                <CardDescription className="text-zinc-400">
                  {generatedCodes.length > 0
                    ? `${generatedCodes.length} codes disponibles`
                    : "Les codes apparaîtront ici après génération"}
                </CardDescription>
              </div>
              {generatedCodes.length > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 h-8 text-xs" onClick={copyAll}>
                    {copied ? <CheckCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copied ? "Copié!" : "Copier"}
                  </Button>
                  <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 h-8 text-xs" onClick={downloadCSV}>
                    <Download className="w-3.5 h-3.5 mr-1" />CSV
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {generatedCodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
                <Ticket className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Aucun code généré pour le moment</p>
              </div>
            ) : (
              <div className="h-80 overflow-y-auto rounded-md bg-zinc-950 border border-zinc-800 p-3">
                <div className="grid grid-cols-2 gap-1.5">
                  {generatedCodes.map((code, i) => (
                    <div
                      key={code}
                      className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800"
                    >
                      <span className="text-zinc-600 text-xs w-5 shrink-0">{i + 1}</span>
                      <span className="text-white font-mono text-sm tracking-widest">{code}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
