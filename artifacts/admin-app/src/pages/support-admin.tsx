import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Loader2, CheckCheck } from "lucide-react";

interface SupportSession {
  sessionId: string;
  clerkId: string;
  clerkName: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

interface SupportMsg {
  id: number;
  message: string;
  fromAdmin: boolean;
  createdAt: string;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function SupportAdmin() {
  const qc = useQueryClient();
  const [active, setActive] = useState<SupportSession | null>(null);
  const [reply, setReply] = useState("");

  const { data: sessions = [], isLoading } = useQuery<SupportSession[]>({
    queryKey: ["/api/admin/support"],
    queryFn: async () => {
      const r = await fetch("/api/admin/support", { credentials: "include" });
      if (!r.ok) throw new Error("Erreur");
      return r.json();
    },
    refetchInterval: 10000,
  });

  const { data: msgs = [] } = useQuery<SupportMsg[]>({
    queryKey: ["/api/admin/support", active?.sessionId],
    queryFn: async () => {
      if (!active) return [];
      const r = await fetch(`/api/admin/support/${active.sessionId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Erreur");
      return r.json();
    },
    enabled: !!active,
    refetchInterval: 5000,
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!active) return;
      const r = await fetch(`/api/admin/support/reply/${active.sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: reply }),
      });
      if (!r.ok) throw new Error("Erreur");
      return r.json();
    },
    onSuccess: () => {
      setReply("");
      void qc.invalidateQueries({ queryKey: ["/api/admin/support", active?.sessionId] });
      void qc.invalidateQueries({ queryKey: ["/api/admin/support"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="w-6 h-6" /> Support Joueurs</h1>
        <p className="text-sm text-muted-foreground mt-1">Gérez les conversations de support en temps réel</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
        {/* Session list */}
        <div className="rounded-xl border overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b bg-muted/40">
            <p className="font-semibold text-sm">Conversations ({sessions.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-20"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">Aucune conversation</div>
            ) : sessions.map(s => (
              <button key={s.sessionId} onClick={() => setActive(s)}
                className={`w-full px-4 py-3 text-left border-b last:border-b-0 transition-colors hover:bg-muted/30 ${active?.sessionId === s.sessionId ? "bg-muted/60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm truncate">{s.clerkName}</p>
                  {s.unread > 0 && (
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">{s.unread}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{s.lastMessage}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">{fmt(s.lastAt)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Chat view */}
        <div className="md:col-span-2 rounded-xl border flex flex-col overflow-hidden">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-center p-6">
              <div>
                <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Sélectionnez une conversation</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b bg-muted/40 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-black text-primary">
                  {active.clerkName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{active.clerkName}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{active.clerkId.slice(0, 20)}…</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {msgs.map(m => (
                  <div key={m.id} className={`flex ${m.fromAdmin ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm leading-snug ${m.fromAdmin ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                      {m.message}
                      <p className="text-[10px] opacity-60 mt-1 text-right">{fmt(m.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply input */}
              <div className="px-3 py-3 border-t flex gap-2">
                <input
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && reply.trim()) { e.preventDefault(); send.mutate(); } }}
                  placeholder="Répondre au joueur…"
                  className="flex-1 px-3 py-2 rounded-lg border bg-muted/30 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
                <button onClick={() => send.mutate()} disabled={!reply.trim() || send.isPending}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center gap-1.5 disabled:opacity-50 transition-opacity">
                  {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Envoyer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
