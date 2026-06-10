import { useState, useRef } from "react";
import { Upload, ImagePlus, RotateCcw, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL ?? "/admin/";

const GAMES = [
  {
    key: "halgo_cover_crash",
    label: "Halgo Crash",
    defaultSrc: `${BASE}../game-cover-crash.jpg`,
    accent: "#ef4444",
  },
  {
    key: "halgo_cover_roulette",
    label: "Roulette Halgo",
    defaultSrc: `${BASE}../game-cover-roulette.png`,
    accent: "#F5C518",
  },
  {
    key: "halgo_cover_mines",
    label: "Mines",
    defaultSrc: null,
    accent: "#1abc9c",
  },
  {
    key: "halgo_cover_sport",
    label: "Paris Sportifs",
    defaultSrc: null,
    accent: "#27ae60",
  },
] as const;

type GameKey = (typeof GAMES)[number]["key"];

function readCovers(): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const g of GAMES) {
    try { out[g.key] = localStorage.getItem(g.key); }
    catch { out[g.key] = null; }
  }
  return out;
}

function saveCover(key: string, dataUrl: string) {
  try { localStorage.setItem(key, dataUrl); } catch { /* ignore */ }
}

function removeCover(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function GameCovers() {
  const { toast } = useToast();
  const [covers, setCovers] = useState<Record<string, string | null>>(readCovers);
  const [saving, setSaving] = useState<GameKey | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFile = async (key: GameKey, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Fichier invalide", description: "Veuillez choisir une image.", variant: "destructive" });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: "Fichier trop lourd", description: "Maximum 4 Mo.", variant: "destructive" });
      return;
    }
    setSaving(key);
    try {
      const b64 = await toBase64(file);
      saveCover(key, b64);
      setCovers(prev => ({ ...prev, [key]: b64 }));
      toast({ title: "Pochette mise à jour", description: "Visible immédiatement dans l'application." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de lire le fichier.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handleReset = (key: GameKey) => {
    removeCover(key);
    setCovers(prev => ({ ...prev, [key]: null }));
    toast({ title: "Pochette réinitialisée", description: "L'image par défaut est restaurée." });
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
          const current = covers[game.key];
          const preview = current ?? game.defaultSrc;
          const isSaving = saving === game.key;

          return (
            <Card key={game.key} className="bg-zinc-900 border-zinc-800 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: game.accent }}
                    />
                    {game.label}
                  </CardTitle>
                  {current && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(141,198,63,0.15)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.25)" }}>
                      PERSONNALISÉ
                    </span>
                  )}
                </div>
                <CardDescription className="text-zinc-500 text-xs">
                  {current ? "Image personnalisée active" : "Image par défaut"}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Preview */}
                <div
                  className="w-full rounded-xl overflow-hidden relative"
                  style={{ height: 180, background: "#111" }}
                >
                  {preview ? (
                    <img
                      src={preview}
                      alt={game.label}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <ImagePlus className="w-8 h-8 text-zinc-600" />
                      <span className="text-xs text-zinc-600">Aucune pochette</span>
                    </div>
                  )}
                  {isSaving && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2"
                    style={{ background: game.accent, color: "#fff" }}
                    onClick={() => inputRefs.current[game.key]?.click()}
                    disabled={isSaving}
                  >
                    <Upload className="w-4 h-4" />
                    {current ? "Remplacer" : "Importer"}
                  </Button>

                  {current && (
                    <Button
                      variant="outline"
                      className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
                      onClick={() => handleReset(game.key)}
                      title="Remettre l'image par défaut"
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

                <p className="text-[10px] text-zinc-600">
                  PNG, JPG, WEBP · max 4 Mo · recommandé 400×400 px
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="flex items-start gap-3 py-4">
          <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
          <p className="text-xs text-zinc-400 leading-relaxed">
            Les pochettes sont stockées localement et s'appliquent immédiatement dans l'application joueur sur le même domaine.
            Aucun rechargement nécessaire.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
