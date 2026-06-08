import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, CheckCircle2, ImagePlus, Megaphone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface BannerMeta {
  id: number;
  fileName: string;
  mimeType: string;
  isActive: boolean;
  createdAt: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erreur" }));
    throw new Error((err as { error: string }).error || "Erreur");
  }
  return res.json() as Promise<T>;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Publicite() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: banners = [], isLoading } = useQuery<BannerMeta[]>({
    queryKey: ["/api/admin/banners"],
    queryFn: () => apiFetch("/api/admin/banners"),
  });

  const activateMut = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: boolean }>(`/api/admin/banners/${id}/activate`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      toast({ title: "Bannière activée", description: "Les joueurs voient maintenant cette image." });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: boolean }>(`/api/admin/banners/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      toast({ title: "Bannière supprimée" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await toBase64(file);
    setPreview(dataUrl);
    setPendingFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleUpload() {
    if (!pendingFile || !preview) return;
    setUploading(true);
    try {
      await apiFetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: preview, mimeType: pendingFile.type, fileName: pendingFile.name }),
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      toast({ title: "Bannière publiée", description: "Visible immédiatement pour les joueurs." });
      setPreview(null);
      setPendingFile(null);
    } catch (e) {
      toast({ title: "Erreur upload", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const activeBanner = banners.find((b) => b.isActive);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-indigo-500" /> Publicité
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gérez la bannière promotionnelle affichée dans l'app joueur.
        </p>
      </div>

      {/* Upload zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uploader une nouvelle bannière</CardTitle>
          <CardDescription>
            Format recommandé : PNG/JPG, ratio 16:9 (ex. 1780×930 px). La bannière uploadée sera immédiatement activée.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview ? (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden border border-border aspect-[1780/930] bg-muted relative">
                <img src={preview} alt="Prévisualisation" className="w-full h-full object-cover" />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleUpload} disabled={uploading} className="gap-2">
                  {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Publication…" : "Publier cette bannière"}
                </Button>
                <Button variant="outline" onClick={() => { setPreview(null); setPendingFile(null); }}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full aspect-[1780/930] max-h-64 rounded-xl border-2 border-dashed border-border hover:border-indigo-500 transition-colors flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-indigo-500 bg-muted/30"
            >
              <ImagePlus className="w-10 h-10" />
              <span className="text-sm font-medium">Cliquer pour choisir une image</span>
              <span className="text-xs">PNG, JPG, WebP</span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
        </CardContent>
      </Card>

      {/* Active banner preview */}
      {activeBanner && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Bannière active
            </CardTitle>
            <CardDescription>C'est ce que voient les joueurs en ce moment.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl overflow-hidden border border-green-500/20 aspect-[1780/930] bg-muted">
              <img
                src={`/api/banners/active/image?t=${Date.now()}`}
                alt="Bannière active"
                className="w-full h-full object-cover"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* All banners list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des bannières</CardTitle>
          <CardDescription>Vous pouvez réactiver ou supprimer une ancienne bannière.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : banners.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune bannière uploadée.</p>
          ) : (
            <div className="space-y-2">
              {[...banners].reverse().map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{b.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {b.isActive ? (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-500 text-white text-[10px]">
                        Active
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => activateMut.mutate(b.id)}
                        disabled={activateMut.isPending}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Activer
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                      onClick={() => deleteMut.mutate(b.id)}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
