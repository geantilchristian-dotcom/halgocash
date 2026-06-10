import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, CheckCircle2, ImagePlus, Megaphone, RefreshCw, Save, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/compress-image";

interface BannerMeta {
  id: number;
  fileName: string;
  mimeType: string;
  isActive: boolean;
  createdAt: string;
}

interface PromoBannerConfig {
  bgColor1: string;
  bgColor2: string;
  bgColor3: string;
  line1Text: string;
  line1Color: string;
  line1Font: string;
  line2Text: string;
  line2Color: string;
  line2Font: string;
  line2Suffix: string;
  line2SuffixColor: string;
  badgeText: string;
  badgeColor: string;
  badgeBg: string;
  animation: "slide" | "glow" | "pulse" | "shimmer";
}

const DEFAULT_PROMO: PromoBannerConfig = {
  bgColor1: "#1a5c2a", bgColor2: "#22c55e", bgColor3: "#F5C518",
  line1Text: "GAGNEZ JUSQU'À", line1Color: "#ffffffdd", line1Font: "Plus Jakarta Sans",
  line2Text: "1.000.000", line2Color: "#ffffff", line2Font: "Oswald",
  line2Suffix: "CDF", line2SuffixColor: "#F5C518",
  badgeText: "CHAQUE SAMEDI", badgeColor: "#ffffff", badgeBg: "rgba(0,0,0,0.30)",
  animation: "slide",
};

const FONTS = [
  "Plus Jakarta Sans", "Oswald", "Bebas Neue", "Anton",
  "Montserrat", "Raleway", "Playfair Display", "Black Han Sans",
  "Roboto Condensed", "Impact",
];


async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erreur" }));
    throw new Error((err as { error: string }).error || "Erreur");
  }
  return res.json() as Promise<T>;
}

function PromoBannerPreview({ cfg, animKey }: { cfg: PromoBannerConfig; animKey: number }) {
  const anim = cfg.animation;

  const line1Anim = anim === "glow"
    ? "promo-glow-line 1.8s ease-in-out infinite"
    : "promo-slide-left 0.55s cubic-bezier(0.23,1,0.32,1) 0.1s both";

  const line2Anim = anim === "pulse"
    ? "promo-zoom-in 0.6s cubic-bezier(0.23,1,0.32,1) 0.4s both, promo-pulse-amount 1.8s ease-in-out 1.5s infinite"
    : anim === "glow"
    ? "promo-zoom-in 0.6s cubic-bezier(0.23,1,0.32,1) 0.4s both, promo-glow-line 1.8s ease-in-out 1.5s infinite"
    : "promo-zoom-in 0.6s cubic-bezier(0.23,1,0.32,1) 0.4s both, promo-pulse-amount 2.5s ease-in-out 1.5s infinite";

  return (
    <div
      className="rounded-2xl overflow-hidden relative shadow-lg"
      style={{ background: `linear-gradient(135deg, ${cfg.bgColor1} 0%, ${cfg.bgColor2} 55%, ${cfg.bgColor3} 100%)`, minHeight: 90 }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 80% 50%, ${cfg.bgColor3}80 0%, transparent 60%)` }} />
      <div className="relative z-10 px-5 py-4">
        <p key={`l1-${animKey}`} className="text-[11px] font-bold uppercase tracking-widest mb-0.5 leading-none"
          style={{ color: cfg.line1Color, fontFamily: `'${cfg.line1Font}', sans-serif`, animation: line1Anim }}>
          {cfg.line1Text || "Ligne 1"}
        </p>
        <p key={`l2-${animKey}`} className="font-black text-2xl leading-none mb-2"
          style={{ color: anim !== "shimmer" ? cfg.line2Color : undefined, fontFamily: `'${cfg.line2Font}', sans-serif`,
            animation: line2Anim, textShadow: "0 2px 10px rgba(0,0,0,0.25)",
            ...(anim === "shimmer" ? {
              background: `linear-gradient(90deg, ${cfg.line2Color} 20%, rgba(255,255,255,0.95) 50%, ${cfg.line2Color} 80%)`,
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "promo-shimmer-bg 2.5s linear infinite",
            } : {}) }}>
          {cfg.line2Text || "0"} <span style={{ color: cfg.line2SuffixColor, WebkitTextFillColor: anim === "shimmer" ? cfg.line2SuffixColor : undefined }}>
            {cfg.line2Suffix}
          </span>
        </p>
        <div key={`badge-${animKey}`} className="inline-flex items-center px-2.5 py-1 rounded-full"
          style={{ background: cfg.badgeBg, color: cfg.badgeColor,
            animation: "promo-bounce-in 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.75s both, promo-badge-pulse 2.2s ease-in-out 2s infinite" }}>
          <span className="font-black text-[10px] uppercase tracking-widest">{cfg.badgeText || "Badge"}</span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

export default function Publicite() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingMime, setPendingMime] = useState<string>("image/webp");
  const [bannerStats, setBannerStats] = useState<{ originalKb: number; compressedKb: number } | null>(null);

  const [cfg, setCfg] = useState<PromoBannerConfig>(DEFAULT_PROMO);
  const [animKey, setAnimKey] = useState(0);
  const [savingPromo, setSavingPromo] = useState(false);

  // Jackpot poster state
  const jpInputRef = useRef<HTMLInputElement>(null);
  const [jpPreview, setJpPreview] = useState<string | null>(null);
  const [jpMime, setJpMime] = useState<string>("image/webp");
  const [jpStats, setJpStats] = useState<{ originalKb: number; compressedKb: number } | null>(null);
  const [jpUploading, setJpUploading] = useState(false);
  const [jpTs, setJpTs] = useState(Date.now());
  const [jpExists, setJpExists] = useState(false);

  useEffect(() => {
    fetch("/api/jackpot-poster/exists", { credentials: "include" })
      .then(r => r.ok ? r.json() as Promise<{ exists: boolean }> : null)
      .then(d => { if (d) setJpExists(d.exists); })
      .catch(() => {});
  }, [jpTs]);

  async function handleJpFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl, mimeType, originalKb, compressedKb } = await compressImage(file, { maxWidth: 1200, maxHeight: 1600, quality: 0.82 });
      setJpPreview(dataUrl);
      setJpMime(mimeType);
      setJpStats({ originalKb, compressedKb });
    } catch {
      toast({ title: "Erreur lecture image", variant: "destructive" });
    }
  }

  async function uploadJpPoster() {
    if (!jpPreview) return;
    setJpUploading(true);
    try {
      const r = await apiFetch<{ ok: boolean }>("/api/admin/jackpot-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: jpPreview, mimeType: jpMime }),
      });
      if (r.ok) {
        toast({ title: "Affiche jackpot mise à jour", description: jpStats ? `${jpStats.originalKb} Ko → ${jpStats.compressedKb} Ko (WebP)` : undefined });
        setJpPreview(null);
        setJpStats(null);
        setJpTs(Date.now());
      }
    } catch {
      toast({ title: "Erreur upload", variant: "destructive" });
    } finally {
      setJpUploading(false);
    }
  }

  async function deleteJpPoster() {
    await apiFetch<{ ok: boolean }>("/api/admin/jackpot-poster", { method: "DELETE" });
    toast({ title: "Affiche supprimée" });
    setJpTs(Date.now());
    setJpExists(false);
  }

  const { data: banners = [], isLoading } = useQuery<BannerMeta[]>({
    queryKey: ["/api/admin/banners"],
    queryFn: () => apiFetch("/api/admin/banners"),
  });

  const { data: promoData } = useQuery<PromoBannerConfig>({
    queryKey: ["/api/admin/promo-banner"],
    queryFn: () => apiFetch<PromoBannerConfig>("/api/admin/promo-banner"),
  });

  useEffect(() => {
    if (promoData) setCfg(promoData);
  }, [promoData]);


  const activateMut = useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: boolean }>(`/api/admin/banners/${id}/activate`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      toast({ title: "Bannière activée" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: boolean }>(`/api/admin/banners/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/banners"] }); toast({ title: "Bannière supprimée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl, mimeType, originalKb, compressedKb } = await compressImage(file, { maxWidth: 1200, maxHeight: 600, quality: 0.82 });
      setPreview(dataUrl);
      setPendingFile(file);
      setPendingMime(mimeType);
      setBannerStats({ originalKb, compressedKb });
    } catch {
      toast({ title: "Erreur lecture image", variant: "destructive" });
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleUpload() {
    if (!pendingFile || !preview) return;
    setUploading(true);
    try {
      await apiFetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: preview, mimeType: pendingMime, fileName: pendingFile.name }),
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      toast({ title: "Bannière publiée", description: bannerStats ? `${bannerStats.originalKb} Ko → ${bannerStats.compressedKb} Ko (WebP)` : undefined });
      setPreview(null); setPendingFile(null); setBannerStats(null);
    } catch (e) {
      toast({ title: "Erreur upload", description: (e as Error).message, variant: "destructive" });
    } finally { setUploading(false); }
  }

  async function savePromo() {
    setSavingPromo(true);
    try {
      await apiFetch("/api/admin/promo-banner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      toast({ title: "Bannière promo sauvegardée", description: "Visible immédiatement pour les joueurs." });
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally { setSavingPromo(false); }
  }

  const set = (k: keyof PromoBannerConfig, v: string) =>
    setCfg((prev) => ({ ...prev, [k]: v }));

  const activeBanner = banners.find((b) => b.isActive);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-indigo-500" /> Publicité
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gérez la bannière image et la bannière promo animée.</p>
      </div>

      {/* ── Promo Banner Texte Editor ── */}
      <Card className="border-yellow-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-xl">🎯</span> Bannière Promo Animée
          </CardTitle>
          <CardDescription>
            Personnalisez les textes, couleurs, polices et l'animation de la bannière "Gagnez jusqu'à…" de l'app joueur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Live preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Aperçu live
              </p>
              <button
                onClick={() => setAnimKey((k) => k + 1)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Rejouer animation
              </button>
            </div>
            <PromoBannerPreview cfg={cfg} animKey={animKey} />
          </div>

          {/* Style animation */}
          <Field label="Style d'animation">
            <div className="grid grid-cols-4 gap-2">
              {(["slide", "glow", "pulse", "shimmer"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => { set("animation", a); setAnimKey((k) => k + 1); }}
                  className="py-2 rounded-lg text-xs font-bold uppercase border transition-all"
                  style={{
                    borderColor: cfg.animation === a ? "#6366f1" : undefined,
                    background: cfg.animation === a ? "rgb(99 102 241 / 0.1)" : undefined,
                    color: cfg.animation === a ? "#6366f1" : undefined,
                  }}
                >
                  {a === "slide" ? "🎬 Slide" : a === "glow" ? "✨ Glow" : a === "pulse" ? "💫 Pulse" : "🌟 Shimmer"}
                </button>
              ))}
            </div>
          </Field>

          {/* Backgrounds */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Dégradé de fond</p>
            <div className="grid grid-cols-3 gap-4">
              {(["bgColor1", "bgColor2", "bgColor3"] as const).map((k, i) => (
                <Field key={k} label={`Couleur ${i + 1}`}>
                  <div className="flex items-center gap-2">
                    <input type="color" value={cfg[k]} onChange={(e) => set(k, e.target.value)}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-transparent" />
                    <span className="text-xs font-mono text-muted-foreground">{cfg[k]}</span>
                  </div>
                </Field>
              ))}
            </div>
          </div>

          {/* Line 1 */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase">Ligne 1 (sous-titre)</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Texte">
                <input value={cfg.line1Text} onChange={(e) => set("line1Text", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
              </Field>
              <Field label="Police">
                <select value={cfg.line1Font} onChange={(e) => { set("line1Font", e.target.value); }}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                  {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </Field>
              <Field label="Couleur texte">
                <div className="flex items-center gap-2">
                  <input type="color" value={cfg.line1Color.startsWith("rgba") ? "#ffffff" : cfg.line1Color}
                    onChange={(e) => set("line1Color", e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-transparent" />
                  <input value={cfg.line1Color} onChange={(e) => set("line1Color", e.target.value)}
                    className="flex-1 px-2 py-2 rounded-lg border border-border bg-background text-xs font-mono" />
                </div>
              </Field>
            </div>
          </div>

          {/* Line 2 */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase">Ligne 2 (montant principal)</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Montant">
                <input value={cfg.line2Text} onChange={(e) => set("line2Text", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
              </Field>
              <Field label="Suffixe (ex: CDF)">
                <input value={cfg.line2Suffix} onChange={(e) => set("line2Suffix", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
              </Field>
              <Field label="Police">
                <select value={cfg.line2Font} onChange={(e) => { set("line2Font", e.target.value); }}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                  {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </Field>
              <Field label="Couleur montant">
                <div className="flex items-center gap-2">
                  <input type="color" value={cfg.line2Color.startsWith("rgba") ? "#ffffff" : cfg.line2Color}
                    onChange={(e) => set("line2Color", e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-transparent" />
                  <input value={cfg.line2Color} onChange={(e) => set("line2Color", e.target.value)}
                    className="flex-1 px-2 py-2 rounded-lg border border-border bg-background text-xs font-mono" />
                </div>
              </Field>
              <Field label="Couleur suffixe">
                <div className="flex items-center gap-2">
                  <input type="color" value={cfg.line2SuffixColor.startsWith("rgba") ? "#F5C518" : cfg.line2SuffixColor}
                    onChange={(e) => set("line2SuffixColor", e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-transparent" />
                  <span className="text-xs font-mono text-muted-foreground">{cfg.line2SuffixColor}</span>
                </div>
              </Field>
            </div>
          </div>

          {/* Badge */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase">Badge</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Texte du badge">
                <input value={cfg.badgeText} onChange={(e) => set("badgeText", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
              </Field>
              <Field label="Couleur texte">
                <div className="flex items-center gap-2">
                  <input type="color" value={cfg.badgeColor.startsWith("rgba") ? "#ffffff" : cfg.badgeColor}
                    onChange={(e) => set("badgeColor", e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-transparent" />
                  <span className="text-xs font-mono text-muted-foreground">{cfg.badgeColor}</span>
                </div>
              </Field>
              <Field label="Fond du badge (rgba)">
                <input value={cfg.badgeBg} onChange={(e) => set("badgeBg", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-mono" />
              </Field>
            </div>
          </div>

          <Button onClick={savePromo} disabled={savingPromo} className="gap-2 w-full">
            {savingPromo ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingPromo ? "Sauvegarde…" : "Sauvegarder et publier"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Image Banner Upload ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bannière image (photo)</CardTitle>
          <CardDescription>Format recommandé : PNG/JPG, ratio 16:9 (ex. 1780×930 px).</CardDescription>
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
                <Button variant="outline" onClick={() => { setPreview(null); setPendingFile(null); }}>Annuler</Button>
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
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden" onChange={handleFileChange} />
        </CardContent>
      </Card>

      {activeBanner && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> Bannière image active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl overflow-hidden border border-green-500/20 aspect-[1780/930] bg-muted">
              <img src={`/api/banners/active/image?t=${Date.now()}`} alt="Bannière active" className="w-full h-full object-cover" />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des bannières images</CardTitle>
          <CardDescription>Réactiver ou supprimer une ancienne bannière.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : banners.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune bannière uploadée.</p>
          ) : (
            <div className="space-y-2">
              {[...banners].reverse().map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{b.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.createdAt).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {b.isActive ? (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-500 text-white text-[10px]">Active</Badge>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => activateMut.mutate(b.id)} disabled={activateMut.isPending}>
                        <CheckCircle2 className="w-3 h-3" /> Activer
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                      onClick={() => deleteMut.mutate(b.id)} disabled={deleteMut.isPending}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Affiche Jackpot ── */}
      <div className="border-t pt-6 mt-2">
        <h2 className="text-lg font-bold mb-1">Affiche Jackpot</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Cette image s'affiche dans la zone jackpot de l'app joueur. Le bouton <strong>PARTICIPER</strong> reste toujours visible par-dessus.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImagePlus className="w-4 h-4" /> Importer une affiche jackpot
          </CardTitle>
          <CardDescription>PNG, JPG ou WebP. Taille recommandée : 800×400 px.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {jpPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-border">
              <img src={jpPreview} alt="Aperçu affiche" className="w-full object-cover max-h-64" />
              <button
                onClick={() => { setJpPreview(null); setJpStats(null); }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => jpInputRef.current?.click()}
              className="w-full aspect-[2/1] max-h-52 rounded-xl border-2 border-dashed border-border hover:border-amber-500 transition-colors flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-amber-500 bg-muted/30"
            >
              <ImagePlus className="w-10 h-10" />
              <span className="text-sm font-medium">Cliquer pour choisir une affiche</span>
              <span className="text-xs">PNG, JPG, WebP</span>
            </button>
          )}
          <input ref={jpInputRef} type="file" accept="image/png,image/jpeg,image/webp"
            className="hidden" onChange={handleJpFile} />

          {jpPreview && (
            <Button onClick={uploadJpPoster} disabled={jpUploading} className="w-full gap-2">
              {jpUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {jpUploading ? "Envoi en cours…" : "Publier cette affiche"}
            </Button>
          )}
        </CardContent>
      </Card>

      {jpExists && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-500" /> Affiche jackpot active
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl overflow-hidden border border-amber-500/20">
              <img src={`/api/jackpot-poster/image?t=${jpTs}`} alt="Affiche jackpot active" className="w-full object-cover max-h-52" />
            </div>
            <Button variant="destructive" size="sm" className="gap-2" onClick={deleteJpPoster}>
              <Trash2 className="w-3.5 h-3.5" /> Supprimer l'affiche
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
