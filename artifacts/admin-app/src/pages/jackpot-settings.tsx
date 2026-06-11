import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, Sliders, Trophy, Percent, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface JackpotConfig {
  minAmount: number;
  prizeLabel: string;
  subtitle: string;
  howTo: string;
  cashbackRate: number;
  cashbackTitle: string;
  cashbackLines: string[];
  bonusAmount: string;
  bonusSubtitle: string;
  bonusConditions: string;
}

const DEFAULTS: JackpotConfig = {
  minAmount: 500,
  prizeLabel: "5 000 000 FC",
  subtitle: "Participez au tirage chaque samedi !",
  howTo: "Grattez un ticket ou misez sur votre solde. Chaque tranche de 500 FC = 1 participation supplémentaire.",
  cashbackRate: 10,
  cashbackTitle: "Cashback 10%",
  cashbackLines: [
    "Chaque lundi, on calcule vos mises des 7 jours précédents",
    "10% de ce montant est crédité sur votre solde le lundi à 8h",
    "Valable sur tous les jeux : Crash, Roulette, Paris Sportifs",
    "Activé automatiquement pour tout compte Halgo Cash actif",
  ],
  bonusAmount: "50 000 FC",
  bonusSubtitle: "100% jusqu'à 50 000 FC",
  bonusConditions: "Obtenez jusqu'à 50 000 FC de bonus. Parrainez vos amis pour débloquer des récompenses supplémentaires.",
};

export default function JackpotSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<JackpotConfig>({
    queryKey: ["/api/admin/jackpot-settings"],
    queryFn: async () => {
      const r = await fetch("/api/admin/jackpot-settings", { credentials: "include" });
      if (!r.ok) throw new Error("Erreur de chargement");
      return r.json() as Promise<JackpotConfig>;
    },
  });

  const [form, setForm] = useState<JackpotConfig | null>(null);
  const current = form ?? data ?? DEFAULTS;

  const set = <K extends keyof JackpotConfig>(key: K, val: JackpotConfig[K]) => {
    setForm({ ...current, [key]: val });
  };

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/jackpot-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(current),
      });
      if (!r.ok) {
        const err = await r.json() as { error?: string };
        throw new Error(err.error ?? "Erreur");
      }
      return r.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["/api/admin/jackpot-settings"] });
      setForm(null);
      toast({ title: "Sauvegardé", description: "Configuration jackpot mise à jour." });
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sliders className="w-6 h-6" /> Configuration Jackpot &amp; Promos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurez les montants, textes et conditions affichés aux joueurs.
        </p>
      </div>

      {/* ── Jackpot du Samedi ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="w-4 h-4 text-yellow-500" /> Jackpot du Samedi
          </CardTitle>
          <CardDescription>Montant minimum de participation et contenu affiché</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="minAmount">Montant minimum (FC)</Label>
              <Input
                id="minAmount"
                type="number"
                min={100}
                max={100000}
                value={current.minAmount}
                onChange={e => set("minAmount", Number(e.target.value))}
                placeholder="500"
              />
              <p className="text-[11px] text-muted-foreground">Minimum 100 FC, maximum 100 000 FC</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prizeLabel">Montant du prix jackpot</Label>
              <Input
                id="prizeLabel"
                value={current.prizeLabel}
                onChange={e => set("prizeLabel", e.target.value)}
                placeholder="5 000 000 FC"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subtitle">Sous-titre jackpot</Label>
            <Input
              id="subtitle"
              value={current.subtitle}
              onChange={e => set("subtitle", e.target.value)}
              placeholder="Participez au tirage chaque samedi !"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="howTo">Comment participer (texte affiché dans la modal)</Label>
            <Textarea
              id="howTo"
              rows={3}
              value={current.howTo}
              onChange={e => set("howTo", e.target.value)}
              placeholder="Grattez un ticket ou misez sur votre solde..."
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Cashback ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="w-4 h-4 text-yellow-400" /> Cashback
          </CardTitle>
          <CardDescription>Taux et lignes de description affichés dans la modal Cashback</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cashbackRate">Taux de cashback (%)</Label>
              <Input
                id="cashbackRate"
                type="number"
                min={0}
                max={100}
                value={current.cashbackRate}
                onChange={e => set("cashbackRate", Number(e.target.value))}
                placeholder="10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cashbackTitle">Titre affiché</Label>
              <Input
                id="cashbackTitle"
                value={current.cashbackTitle}
                onChange={e => set("cashbackTitle", e.target.value)}
                placeholder="Cashback 10%"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cashbackLines">
              Lignes d'explication <span className="text-muted-foreground font-normal">(une par ligne)</span>
            </Label>
            <Textarea
              id="cashbackLines"
              rows={5}
              value={current.cashbackLines.join("\n")}
              onChange={e => set("cashbackLines", e.target.value.split("\n"))}
              placeholder="Chaque lundi, on calcule vos mises..."
            />
            <p className="text-[11px] text-muted-foreground">
              {current.cashbackLines.filter(l => l.trim()).length} ligne(s) — chaque ligne = une entrée dans la liste
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Bonus de Bienvenue ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="w-4 h-4 text-green-500" /> Bonus de Bienvenue
          </CardTitle>
          <CardDescription>Montant et conditions du bonus de bienvenue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bonusAmount">Montant affiché</Label>
              <Input
                id="bonusAmount"
                value={current.bonusAmount}
                onChange={e => set("bonusAmount", e.target.value)}
                placeholder="50 000 FC"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bonusSubtitle">Sous-titre sur la carte</Label>
              <Input
                id="bonusSubtitle"
                value={current.bonusSubtitle}
                onChange={e => set("bonusSubtitle", e.target.value)}
                placeholder="100% jusqu'à 50 000 FC"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bonusConditions">Description / conditions</Label>
            <Textarea
              id="bonusConditions"
              rows={3}
              value={current.bonusConditions}
              onChange={e => set("bonusConditions", e.target.value)}
              placeholder="Obtenez jusqu'à 50 000 FC de bonus..."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-8">
        <Button
          onClick={() => void save.mutateAsync()}
          disabled={save.isPending}
          size="lg"
          className="gap-2"
        >
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Sauvegarder les paramètres
        </Button>
      </div>
    </div>
  );
}
