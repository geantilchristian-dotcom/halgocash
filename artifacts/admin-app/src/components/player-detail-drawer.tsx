import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, User, Shield, Pause, Play, AlertTriangle, Ban, MessageSquare,
  Trash2, Loader2, CheckCircle, Clock, AlertCircle, Ticket,
  TrendingUp, TrendingDown, Wallet, ArrowDownRight, Copy, Check,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Types ─────────────────────────────────────────────────────────────────

interface Credit { id: number; amount: number; reason: string; refId: string | null; createdAt: string; }
interface TicketItem { id: number; code: string; status: string; isWinner: boolean; prizeAmount: number | null; registeredAt: string | null; createdAt: string; }
interface WithdrawalItem { id: number; amount: number; status: string; paidAt: string | null; createdAt: string; }
interface SupportMsg { id: number; message: string; fromAdmin: boolean; createdAt: string; }

interface PlayerDetail {
  clerkId: string;
  clerkName: string;
  profile: { referralCode: string; referredByCode: string | null; createdAt: string } | null;
  balance: number;
  credits: Credit[];
  tickets: TicketItem[];
  withdrawals: WithdrawalItem[];
  kyc: { status: string; fullName: string | null; adminNote: string | null; submittedAt: string } | null;
  messages: SupportMsg[];
  moderation: { status: string; blockedEmail: string | null; blockedIp: string | null; warnCount: number; adminNotes: string | null };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n))).replace(/\s/g, ".");
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const REASON_LABELS: Record<string, string> = {
  ticket_win: "Gain ticket",
  jackpot_win: "Gain jackpot",
  jackpot_entry: "Participation jackpot",
  crash_win: "Gain Crash",
  crash_bet: "Mise Crash",
  crash_loss: "Perte Crash",
  roulette_win: "Gain Roulette",
  roulette_bet: "Mise Roulette",
  roulette_loss: "Perte Roulette",
  sport_win: "Gain sport",
  sport_bet: "Pari sportif",
  sport_loss: "Perte sport",
  withdrawal: "Retrait",
  withdrawal_pending: "Retrait demandé",
  referral_bonus: "Bonus parrainage",
  referral_ticket: "Ticket parrainage",
  cashback: "Cashback",
  admin_credit: "Crédit admin",
  transfer_in: "Transfert reçu",
  transfer_out: "Transfert envoyé",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:  { label: "Actif",    color: "text-emerald-400", bg: "bg-emerald-900/30 border-emerald-700/40" },
  paused:  { label: "Suspendu", color: "text-amber-400",   bg: "bg-amber-900/30 border-amber-700/40"   },
  blocked: { label: "Bloqué",   color: "text-red-400",     bg: "bg-red-900/30 border-red-700/40"       },
};

const KYC_CONFIG: Record<string, { label: string; color: string }> = {
  not_submitted: { label: "Non soumis",  color: "text-zinc-400"   },
  pending:       { label: "En examen",   color: "text-amber-400"  },
  approved:      { label: "Vérifié ✓",   color: "text-emerald-400"},
  rejected:      { label: "Refusé",      color: "text-red-400"    },
};

// ── Main Component ────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  clerkId: string;
  displayId: string;
  onClose: () => void;
}

export default function PlayerDetailDrawer({ open, clerkId, displayId, onClose }: Props) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  // Action dialog states
  const [warnOpen, setWarnOpen]       = useState(false);
  const [blockOpen, setBlockOpen]     = useState(false);
  const [msgOpen, setMsgOpen]         = useState(false);
  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [warnMsg, setWarnMsg]         = useState("");
  const [warnNotes, setWarnNotes]     = useState("");
  const [blockEmail, setBlockEmail]   = useState("");
  const [blockIp, setBlockIp]         = useState("");
  const [blockNotes, setBlockNotes]   = useState("");
  const [alertMsg, setAlertMsg]       = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const { data, isLoading } = useQuery<PlayerDetail>({
    queryKey: ["/api/admin/players", clerkId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/players/${clerkId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Erreur");
      return r.json() as Promise<PlayerDetail>;
    },
    enabled: open && !!clerkId,
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["/api/admin/players", clerkId] });
    void qc.invalidateQueries({ queryKey: ["/api/admin/players"] });
  }

  const { mutate: doPause, isPending: pausing } = useMutation({
    mutationFn: () => fetch(`/api/admin/players/${clerkId}/pause`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: invalidate,
  });
  const { mutate: doResume, isPending: resuming } = useMutation({
    mutationFn: () => fetch(`/api/admin/players/${clerkId}/resume`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: invalidate,
  });
  const { mutate: doWarn, isPending: warning } = useMutation({
    mutationFn: () => fetch(`/api/admin/players/${clerkId}/warn`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: warnMsg, notes: warnNotes }) }).then(r => r.json()),
    onSuccess: () => { setWarnOpen(false); setWarnMsg(""); setWarnNotes(""); invalidate(); },
  });
  const { mutate: doBlock, isPending: blocking } = useMutation({
    mutationFn: () => fetch(`/api/admin/players/${clerkId}/block`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blockedEmail: blockEmail, blockedIp: blockIp, notes: blockNotes }) }).then(r => r.json()),
    onSuccess: () => { setBlockOpen(false); setBlockEmail(""); setBlockIp(""); setBlockNotes(""); invalidate(); },
  });
  const { mutate: doMessage, isPending: messaging } = useMutation({
    mutationFn: () => fetch(`/api/admin/players/${clerkId}/message`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: alertMsg }) }).then(r => r.json()),
    onSuccess: () => { setMsgOpen(false); setAlertMsg(""); invalidate(); },
  });
  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: () => fetch(`/api/admin/players/${clerkId}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { setDeleteOpen(false); setDeleteConfirm(""); onClose(); void qc.invalidateQueries({ queryKey: ["/api/admin/players"] }); },
  });

  const status = data?.moderation?.status ?? "active";
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active!;
  const kycStatus = data?.kyc?.status ?? "not_submitted";
  const kycCfg = KYC_CONFIG[kycStatus] ?? KYC_CONFIG.not_submitted!;

  function copyId() {
    void navigator.clipboard.writeText(clerkId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const initials = (data?.clerkName ?? displayId).slice(0, 2).toUpperCase();

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-zinc-950 border-zinc-800 p-0 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-4 px-6 py-5 border-b border-zinc-800 shrink-0">
            <div className="w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center shrink-0">
              <span className="text-indigo-300 font-black text-lg">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-white font-bold text-lg truncate">{data?.clerkName ?? displayId}</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-zinc-400 font-mono text-xs">{displayId}</span>
                <button onClick={copyId} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors ml-auto shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
          ) : !data ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500">Données introuvables</div>
          ) : (
            <Tabs defaultValue="profil" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-6 mt-4 mb-0 bg-zinc-900 border border-zinc-800 shrink-0">
                <TabsTrigger value="profil" className="flex-1 text-xs">Profil</TabsTrigger>
                <TabsTrigger value="mouvements" className="flex-1 text-xs">Mouvements</TabsTrigger>
                <TabsTrigger value="tickets" className="flex-1 text-xs">Tickets</TabsTrigger>
                <TabsTrigger value="support" className="flex-1 text-xs">Support</TabsTrigger>
                <TabsTrigger value="moderation" className="flex-1 text-xs">Modération</TabsTrigger>
              </TabsList>

              {/* ── Profil ── */}
              <TabsContent value="profil" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full px-6 py-4">
                  {/* Balance */}
                  <div className="rounded-xl bg-gradient-to-br from-indigo-900/40 to-purple-900/30 border border-indigo-700/30 p-5 mb-4 text-center">
                    <p className="text-zinc-400 text-xs uppercase tracking-widest mb-1">Solde actuel</p>
                    <p className="text-4xl font-black text-white">{formatFC(data.balance)} <span className="text-indigo-300 text-2xl">FC</span></p>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: "Tickets grattés",  value: data.tickets.length,                                    color: "text-zinc-200"    },
                      { label: "Tickets gagnants",  value: data.tickets.filter(t => t.isWinner).length,           color: "text-yellow-400"  },
                      { label: "Retraits effectués",value: data.withdrawals.filter(w => w.status === "paid").length, color: "text-emerald-400" },
                      { label: "Avertissements",    value: data.moderation.warnCount,                             color: data.moderation.warnCount > 0 ? "text-amber-400" : "text-zinc-500" },
                    ].map(s => (
                      <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-zinc-500 text-[10px] uppercase tracking-wide mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Info rows */}
                  <div className="space-y-2">
                    <InfoRow label="Code parrainage" value={data.profile?.referralCode ?? "—"} mono />
                    {data.profile?.referredByCode && <InfoRow label="Parrainé par" value={data.profile.referredByCode} mono />}
                    <InfoRow label="Inscrit le" value={data.profile ? formatDate(data.profile.createdAt) : "—"} />
                    <InfoRow
                      label="Identité (KYC)"
                      value={data.kyc?.fullName ? `${data.kyc.fullName} — ${kycCfg.label}` : kycCfg.label}
                      valueClass={kycCfg.color}
                    />
                    {data.kyc?.submittedAt && <InfoRow label="KYC soumis le" value={formatDate(data.kyc.submittedAt)} />}
                    <InfoRow label="Clerk ID" value={clerkId.slice(0, 20) + "…"} mono />
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* ── Mouvements ── */}
              <TabsContent value="mouvements" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full">
                  <div className="px-6 py-4">
                    {data.credits.length === 0 ? (
                      <Empty label="Aucun mouvement enregistré" />
                    ) : (
                      <div className="space-y-1">
                        {data.credits.map(c => (
                          <div key={c.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-zinc-900/60 transition-colors">
                            <div className="flex items-center gap-2.5">
                              {c.amount >= 0 ? (
                                <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
                              )}
                              <div>
                                <p className="text-sm text-white">{REASON_LABELS[c.reason] ?? c.reason}</p>
                                <p className="text-[11px] text-zinc-500">{formatDateTime(c.createdAt)}</p>
                              </div>
                            </div>
                            <span className={`font-bold text-sm ${c.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {c.amount >= 0 ? "+" : "-"}{formatFC(c.amount)} FC
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* ── Tickets ── */}
              <TabsContent value="tickets" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full">
                  <div className="px-6 py-4">
                    {data.tickets.length === 0 ? (
                      <Empty label="Aucun ticket grattable enregistré" />
                    ) : (
                      <div className="space-y-2">
                        {data.tickets.map(t => (
                          <div key={t.id} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${t.isWinner ? "bg-yellow-900/20 border-yellow-700/30" : "bg-zinc-900 border-zinc-800"}`}>
                            <div className="flex items-center gap-2.5">
                              <Ticket className={`w-4 h-4 shrink-0 ${t.isWinner ? "text-yellow-400" : "text-zinc-500"}`} />
                              <div>
                                <p className="font-mono text-sm text-white">{t.code}</p>
                                <p className="text-[11px] text-zinc-500">{t.registeredAt ? formatDate(t.registeredAt) : formatDate(t.createdAt)}</p>
                              </div>
                            </div>
                            {t.isWinner ? (
                              <span className="text-yellow-400 font-bold text-sm">+{formatFC(t.prizeAmount ?? 0)} FC</span>
                            ) : (
                              <span className="text-zinc-500 text-xs">{t.status}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* ── Support ── */}
              <TabsContent value="support" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full">
                  <div className="px-6 py-4 space-y-3">
                    {data.messages.length === 0 ? (
                      <Empty label="Aucun message de support" />
                    ) : (
                      data.messages.map(m => (
                        <div key={m.id} className={`flex ${m.fromAdmin ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${m.fromAdmin ? "bg-indigo-700/50 text-indigo-100" : "bg-zinc-800 text-zinc-200"}`}>
                            <p className="leading-snug whitespace-pre-wrap">{m.message}</p>
                            <p className={`text-[10px] mt-1 ${m.fromAdmin ? "text-indigo-300" : "text-zinc-500"}`}>{formatDateTime(m.createdAt)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* ── Modération ── */}
              <TabsContent value="moderation" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full">
                  <div className="px-6 py-4 space-y-4">
                    {/* Status card */}
                    <div className={`rounded-xl p-4 border ${statusCfg.bg}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Statut du compte</p>
                          <p className={`font-black text-xl ${statusCfg.color}`}>{statusCfg.label}</p>
                        </div>
                        {status === "active" ? (
                          <button
                            onClick={() => doPause()}
                            disabled={pausing}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600/20 border border-amber-600/30 text-amber-400 text-sm font-bold hover:bg-amber-600/30 transition-colors disabled:opacity-50"
                          >
                            {pausing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
                            Suspendre
                          </button>
                        ) : status === "paused" ? (
                          <button
                            onClick={() => doResume()}
                            disabled={resuming}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 text-sm font-bold hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
                          >
                            {resuming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Réactiver
                          </button>
                        ) : (
                          <button
                            onClick={() => doResume()}
                            disabled={resuming}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-700/50 border border-zinc-600/30 text-zinc-300 text-sm font-bold hover:bg-zinc-600/50 transition-colors disabled:opacity-50"
                          >
                            {resuming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Débloquer
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Avertissements */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-zinc-400 text-xs uppercase tracking-wider">Avertissements</p>
                        <span className={`font-black text-lg ${data.moderation.warnCount > 0 ? "text-amber-400" : "text-zinc-500"}`}>{data.moderation.warnCount}</span>
                      </div>
                      {data.moderation.adminNotes && (
                        <p className="text-zinc-300 text-sm italic bg-zinc-800/60 rounded-lg px-3 py-2">{data.moderation.adminNotes}</p>
                      )}
                    </div>

                    {/* Blocked info */}
                    {(data.moderation.blockedEmail || data.moderation.blockedIp) && (
                      <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4 space-y-1.5">
                        <p className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Accès bloqués</p>
                        {data.moderation.blockedEmail && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-zinc-500 text-xs">Email :</span>
                            <span className="font-mono text-red-300">{data.moderation.blockedEmail}</span>
                          </div>
                        )}
                        {data.moderation.blockedIp && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-zinc-500 text-xs">IP :</span>
                            <span className="font-mono text-red-300">{data.moderation.blockedIp}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <Separator className="bg-zinc-800" />

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <ActionBtn icon={AlertTriangle} label="Avertir" color="amber" onClick={() => setWarnOpen(true)} />
                      <ActionBtn icon={Ban} label="Bloquer" color="red" onClick={() => setBlockOpen(true)} />
                      <ActionBtn icon={MessageSquare} label="Envoyer message" color="indigo" onClick={() => setMsgOpen(true)} />
                      <ActionBtn icon={Trash2} label="Supprimer compte" color="red" onClick={() => setDeleteOpen(true)} />
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Warn Dialog ── */}
      <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" /> Avertir le joueur
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-zinc-400 text-xs uppercase">Message d'avertissement (visible par le joueur)</Label>
              <Textarea
                value={warnMsg}
                onChange={e => setWarnMsg(e.target.value)}
                placeholder="Ex: Comportement suspect détecté sur votre compte…"
                className="mt-1.5 bg-zinc-800 border-zinc-600 text-white resize-none"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-zinc-400 text-xs uppercase">Note interne (admin uniquement)</Label>
              <Input
                value={warnNotes}
                onChange={e => setWarnNotes(e.target.value)}
                placeholder="Note interne…"
                className="mt-1.5 bg-zinc-800 border-zinc-600 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWarnOpen(false)} className="text-zinc-400">Annuler</Button>
            <Button onClick={() => doWarn()} disabled={warning || !warnMsg.trim()} className="bg-amber-600 hover:bg-amber-500 text-white">
              {warning ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <AlertTriangle className="w-4 h-4 mr-1" />}
              Envoyer l'avertissement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Block Dialog ── */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Ban className="w-5 h-5" /> Bloquer le compte
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-zinc-400 text-sm">Le compte sera bloqué définitivement. Le joueur recevra une notification.</p>
            <div>
              <Label className="text-zinc-400 text-xs uppercase">Bloquer l'adresse email</Label>
              <Input value={blockEmail} onChange={e => setBlockEmail(e.target.value)} placeholder="email@exemple.com" className="mt-1.5 bg-zinc-800 border-zinc-600 text-white" />
            </div>
            <div>
              <Label className="text-zinc-400 text-xs uppercase">Bloquer l'adresse IP</Label>
              <Input value={blockIp} onChange={e => setBlockIp(e.target.value)} placeholder="192.168.1.1" className="mt-1.5 bg-zinc-800 border-zinc-600 text-white" />
            </div>
            <div>
              <Label className="text-zinc-400 text-xs uppercase">Notes internes</Label>
              <Textarea value={blockNotes} onChange={e => setBlockNotes(e.target.value)} placeholder="Motif du blocage…" className="mt-1.5 bg-zinc-800 border-zinc-600 text-white resize-none" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBlockOpen(false)} className="text-zinc-400">Annuler</Button>
            <Button onClick={() => doBlock()} disabled={blocking} className="bg-red-700 hover:bg-red-600 text-white">
              {blocking ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Ban className="w-4 h-4 mr-1" />}
              Bloquer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Send Message Dialog ── */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-400">
              <MessageSquare className="w-5 h-5" /> Envoyer un message
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-zinc-400 text-xs uppercase">Message à envoyer au joueur</Label>
            <Textarea
              value={alertMsg}
              onChange={e => setAlertMsg(e.target.value)}
              placeholder="Votre message sera visible dans le chat support du joueur…"
              className="mt-1.5 bg-zinc-800 border-zinc-600 text-white resize-none"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMsgOpen(false)} className="text-zinc-400">Annuler</Button>
            <Button onClick={() => doMessage()} disabled={messaging || !alertMsg.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              {messaging ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MessageSquare className="w-4 h-4 mr-1" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" /> Supprimer le compte
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3">
              <p className="text-red-300 text-sm font-bold">⚠ Action irréversible</p>
              <p className="text-zinc-400 text-sm mt-1">Toutes les données du joueur (profil, crédits, KYC, messages) seront supprimées définitivement. Les tickets et retraits sont conservés pour des raisons comptables.</p>
            </div>
            <div>
              <Label className="text-zinc-400 text-xs uppercase">Tapez SUPPRIMER pour confirmer</Label>
              <Input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="SUPPRIMER"
                className="mt-1.5 bg-zinc-800 border-zinc-600 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} className="text-zinc-400">Annuler</Button>
            <Button
              onClick={() => doDelete()}
              disabled={deleting || deleteConfirm !== "SUPPRIMER"}
              className="bg-red-700 hover:bg-red-600 text-white disabled:opacity-40"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function InfoRow({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-800/60 last:border-0">
      <span className="text-zinc-500 text-xs uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-semibold ${mono ? "font-mono" : ""} ${valueClass ?? "text-white"}`}>{value}</span>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="text-center py-12 text-zinc-500 text-sm">{label}</div>;
}

const COLOR_MAP: Record<string, string> = {
  amber:  "bg-amber-600/15 border-amber-700/30 text-amber-400 hover:bg-amber-600/25",
  red:    "bg-red-600/15 border-red-700/30 text-red-400 hover:bg-red-600/25",
  indigo: "bg-indigo-600/15 border-indigo-700/30 text-indigo-400 hover:bg-indigo-600/25",
  zinc:   "bg-zinc-700/30 border-zinc-600/30 text-zinc-300 hover:bg-zinc-700/50",
};

function ActionBtn({ icon: Icon, label, color, onClick }: { icon: typeof AlertTriangle; label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${COLOR_MAP[color] ?? COLOR_MAP.zinc}`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
