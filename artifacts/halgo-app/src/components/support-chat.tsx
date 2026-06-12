import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, HeadphonesIcon } from "lucide-react";
import { useAuth, useUser } from "@clerk/react";

interface SupportMessage {
  id: number;
  message: string;
  fromAdmin: boolean;
  isRead: boolean;
  createdAt: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function SupportChat() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getToken().catch(() => null);
    const headers: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...options, headers, credentials: "include" });
  }, [getToken]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await authFetch("/api/support/messages");
      if (res.ok) {
        const data = await res.json() as SupportMessage[];
        setMessages(data);
        if (!open) {
          const newUnread = data.filter(m => m.fromAdmin && !m.isRead).length;
          setUnread(newUnread);
        } else {
          setUnread(0);
        }
      }
    } catch { /* silent */ }
  }, [authFetch, open]);

  useEffect(() => {
    void fetchMessages();
    const id = setInterval(() => { void fetchMessages(); }, 10000);
    return () => clearInterval(id);
  }, [fetchMessages]);

  useEffect(() => {
    if (open) { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); setUnread(0); }
  }, [open, messages.length]);

  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const text = input.trim();
    setInput("");
    try {
      const res = await authFetch("/api/support/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, clerkName: user?.fullName ?? user?.username ?? "Joueur" }),
      });
      if (res.ok) { await fetchMessages(); }
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-[84px] right-4 z-40 w-13 h-13 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{
            width: 50, height: 50,
            background: "linear-gradient(135deg,#3aab3a,#22a84a)",
            boxShadow: "0 4px 20px rgba(34,168,74,0.5)",
          }}
        >
          <MessageCircle style={{ width: 22, height: 22, color: "#fff" }} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
              style={{ background: "#e74c3c", color: "#fff" }}>{unread > 9 ? "9+" : unread}</span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-0">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm rounded-t-3xl flex flex-col"
            style={{ background: "#0d1f12", height: "65dvh", maxHeight: "75dvh", boxShadow: "0 -8px 40px rgba(0,0,0,0.6)" }}>

            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(141,198,63,0.15)" }}>
                <HeadphonesIcon style={{ width: 16, height: 16, color: "#8DC63F" }} />
              </div>
              <div className="flex-1">
                <p className="font-black text-sm text-white">Support Halgo Cash</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>En ligne</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                <X style={{ width: 15, height: 15, color: "rgba(255,255,255,0.6)" }} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <MessageCircle style={{ width: 36, height: 36, color: "rgba(255,255,255,0.15)" }} />
                  <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>Démarrez une conversation</p>
                  <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>Notre équipe vous répond dans les plus brefs délais</p>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.fromAdmin ? "justify-start" : "justify-end"}`}>
                  <div className="max-w-[78%] px-3.5 py-2.5 rounded-2xl"
                    style={{
                      background: m.fromAdmin ? "rgba(255,255,255,0.08)" : "rgba(141,198,63,0.2)",
                      borderRadius: m.fromAdmin ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                    }}>
                    {m.fromAdmin && <p className="text-[9px] font-black uppercase tracking-wide mb-1" style={{ color: "#8DC63F" }}>Support</p>}
                    <p className="text-[13px] leading-snug text-white">{m.message}</p>
                    <p className="text-[9px] mt-1 text-right" style={{ color: "rgba(255,255,255,0.3)" }}>{formatTime(m.createdAt)}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="flex gap-2 items-center">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  placeholder="Votre message…"
                  className="flex-1 px-4 py-2.5 rounded-2xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                />
                <button
                  onClick={() => void send()}
                  disabled={!input.trim() || sending}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#3aab3a,#22a84a)" }}
                >
                  {sending ? <Loader2 style={{ width: 16, height: 16, color: "#fff" }} className="animate-spin" /> : <Send style={{ width: 16, height: 16, color: "#fff" }} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
