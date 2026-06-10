import { useState, useRef, useEffect } from "react";
import { Upload, ImagePlus, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/compress-image";

const GAMES = [
  { key: "halgo_cover_crash",    label: "Halgo Crash",     accent: "#ef4444" },
  { key: "halgo_cover_roulette", label: "Roulette Halgo",  accent: "#F5C518" },
  { key: "halgo_cover_mines",    label: "Mines",           accent: "#1abc9c" },
  { key: "halgo_cover_sport",    label: "Paris Sportifs",  accent: "#27ae60" },
] as const;

type GameKey = (typeof GAMES)[number]["key"];

export default function GameCovers() {
  const { toast } = useToast();
  const [saving, setSaving] = useState<GameKey | null>(null);
  const [deleting, setDeleting] = useState<GameKey | null>(null);
  // Track which keys have a cover in DB (null = loading, true = exists, false = none)
  const [exists, setExists] = useState<Record<string, boolean>>({});
  // Cache-bust timestamps per key so <img> reloads after upload
  const [ts, setTs] = useState<Record<string, number>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetch("/api/game-covers")
      .then(r => r.json())
      .then((data: Record<string, boolean>) => setExists(data))
      .catch(() => {});
  }, []);

  const handleFile = async (key: GameKey, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Fichier invalide", description: "Veuillez choisir une image.", variant: "destructive" });
      return;
    }
    setSaving(key);
    try {
      const { dataUrl, mimeType, originalKb, compressedKb } = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.82 });
      const res = await fetch(`/api/admin/game-covers/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageData: dataUrl, mimeType }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      setExists(prev => ({ ...prev, [key]: true }));
      setTs(prev => ({ ...prev, [key]: Date.now() }));
      toast({ title: "Pochette mise à jour", description: `${originalKb} Ko → ${compressedKb} Ko (WebP)` });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'enregistrer la pochette.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async (key: GameKey) => {
    setDeleting(key);
    try {
      await fetch(`/api/admin/game-covers/${key}`, { method: "DELETE", credentials: "include" });
      setExists(prev => ({ ...prev, [key]: false }));
      setTs(prev => ({ ...prev, [key]: Date.now() }));
      toast({ title: "Pochette supprimée", description: "L'image par défaut est restaurée." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer la pochette.", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Pochettes des jeux</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Importez une image de couverture pour chaque jeu. Elle s'affiche dans la grille sur l'application joueur.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {GAMES.map((game) => {
          const hasCustom = exists[game.key] ?? false;
          const imgSrc = `/api/game-covers/${game.key}/image?t=${ts[game.key] ?? 0}`;
          const isSaving  = saving  === game.key;
          const isDeleting = deleting === game.key;
          const busy = isSaving || isDeleting;

          return (
            <Card key={game.key} className="bg-zinc-900 border-zinc-800 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: game.accent }} />
                    {game.label}
                  </CardTitle>
                  {hasCustom && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(141,198,63,0.15)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.25)" }}
                    >
                      PERSONNALISÉ
                    </span>
                  )}
                </div>
                <CardDescription className="text-zinc-500 text-xs">
                  {hasCustom ? "Image personnalisée active (visible par tous)" : "Image par défaut"}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="w-full rounded-xl overflow-hidden relative" style={{ height: 180, background: "#111" }}>
                  {hasCustom ? (
                    <img key={imgSrc} src={imgSrc} alt={game.label} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <ImagePlus className="w-8 h-8 text-zinc-600" />
                      <span className="text-xs text-zinc-600">Aucune pochette personnalisée</span>
                    </div>
                  )}
                  {busy && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2"
                    style={{ background: game.accent, color: "#fff" }}
                    onClick={() => inputRefs.current[game.key]?.click()}
                    disabled={busy}
                  >
                    <Upload className="w-4 h-4" />
                    {hasCustom ? "Remplacer" : "Importer"}
                  </Button>

                  {hasCustom && (
                    <Button
                      variant="outline"
                      className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
                      onClick={() => void handleReset(game.key)}
                      disabled={busy}
                      title="Supprimer la pochette personnalisée"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  )}

                  <input
                    ref={el => { inputRefs.current[game.key] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) void handleFile(game.key, f);
                      e.target.value = "";
                    }}
                  />
                </div>

                <p className="text-[10px] text-zinc-600">PNG, JPG, WEBP · max 4 Mo · recommandé 400×400 px</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="flex items-start gap-3 py-4">
          <span className="text-green-400 mt-0.5 shrink-0">✓</span>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Les pochettes sont stockées en base de données et s'affichent immédiatement pour <strong className="text-zinc-300">tous les utilisateurs</strong>, sur tous les appareils.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
