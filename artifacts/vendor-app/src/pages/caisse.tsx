import { useState, useRef, useEffect, useCallback } from "react";
import { AppLayout } from "../components/layout/app-layout";
import { useAuth } from "@/lib/auth-context";
import JeuxTab from "./caisse-jeux";
import {
  Printer,
  Loader2,
  Plus,
  Minus,
  ReceiptText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Smartphone,
  CheckCircle,
  X,
  CalendarCheck,
  Clock,
  LockKeyhole,
  UnlockKeyhole,
  TrendingUp,
} from "lucide-react";

interface PosSale {
  saleId: number;
  codes: string[];
  unitAmount: number;
  quantity: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

interface HistoryEntry {
  id: number;
  unit_amount: string;
  quantity: number;
  total_amount: string;
  codes: string[];
  currency: string;
  created_at: string;
}

interface DailySale {
  id: number;
  unit_amount: string;
  quantity: number;
  total_amount: string;
  currency: string;
  created_at: string;
}

interface DayClosure {
  id: number;
  day_date: string;
  total_tickets: number;
  total_amount_usd: string;
  total_amount_fc: string;
  closed_at: string;
}

interface DailyReport {
  sales: DailySale[];
  closure: DayClosure | null;
  dayDate: string;
}

function fmt(n: number, currency: string) {
  if (currency === "FC") {
    return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".") + " FC";
  }
  return "$" + n.toFixed(2);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const MM_NETWORKS = [
  { id: "VODACOM_MPESA", label: "M-Pesa",      color: "#E40613" },
  { id: "AIRTEL_MONEY",  label: "Airtel Money", color: "#FF0000" },
  { id: "ORANGE_MONEY",  label: "Orange Money", color: "#FF6600" },
] as const;

type MmStep = "form" | "pending" | "success" | "error";
type Tab = "pos" | "mobilemoney" | "journee" | "jeux";

// ── Time helpers for open/close logic ──
// Work window: 08:00 → 16:30
// "Clôturer" button active: 16:30 → 08:00 (next day)
// Warning shown: 16:00 → 16:30

function getMinutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

const CLOSE_OPEN_MIN  = 8 * 60;       // 08:00
const CLOSE_AVAIL_MIN = 16 * 60 + 30; // 16:30
const WARN_START_MIN  = 16 * 60;      // 16:00

function isCloseButtonActive(now: Date): boolean {
  const m = getMinutesOfDay(now);
  return m >= CLOSE_AVAIL_MIN || m < CLOSE_OPEN_MIN;
}

function isWarningPeriod(now: Date): boolean {
  const m = getMinutesOfDay(now);
  return m >= WARN_START_MIN && m < CLOSE_AVAIL_MIN;
}

function secondsUntilClose(now: Date): number {
  const m = getMinutesOfDay(now);
  if (m < CLOSE_AVAIL_MIN) return (CLOSE_AVAIL_MIN - m) * 60 - now.getSeconds();
  return 0;
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export default function Caisse() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("pos");
  const [unitAmount, setUnitAmount] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [currency, setCurrency] = useState<"USD" | "FC">("USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sale, setSale] = useState<PosSale | null>(null);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);

  const [mmAmount, setMmAmount] = useState("");
  const [mmCurrency, setMmCurrency] = useState<"USD" | "CDF">("USD");
  const [mmPhone, setMmPhone] = useState("+243");
  const [mmNetwork, setMmNetwork] = useState("VODACOM_MPESA");
  const [mmStep, setMmStep] = useState<MmStep>("form");
  const [mmChargeId, setMmChargeId] = useState<string | null>(null);
  const [mmMessage, setMmMessage] = useState("");
  const [mmError, setMmError] = useState("");
  const [mmPollCount, setMmPollCount] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Journée tab state
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeSuccess, setCloseSuccess] = useState(false);
  const [now, setNow] = useState(new Date());

  const printRef = useRef<HTMLDivElement>(null);

  const amount = parseFloat(unitAmount) || 0;
  const total = amount * quantity;

  // Tick every second for countdown
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/vendor/pos/history", { credentials: "include" });
      const data = await res.json() as HistoryEntry[];
      setHistory(data);
    } catch {
      setHistory([]);
    }
    setHistoryLoading(false);
  };

  const loadDailyReport = useCallback(async () => {
    setDailyLoading(true);
    try {
      const res = await fetch("/api/vendor/daily-report", { credentials: "include" });
      const data = await res.json() as DailyReport;
      setDailyReport(data);
    } catch {
      setDailyReport(null);
    }
    setDailyLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "journee") void loadDailyReport();
  }, [tab, loadDailyReport]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    setError("");
    setLoading(true);
    setSale(null);
    try {
      const res = await fetch("/api/vendor/pos/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitAmount: amount, quantity, currency }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Erreur serveur");
      }
      const data = await res.json() as PosSale;
      setSale(data);
      setHistory(null);
    } catch (err: unknown) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  const handlePrint = () => window.print();

  const handleMmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMmError("");
    setMmStep("pending");
    try {
      const res = await fetch("/api/payments/mobile-money/vendor", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(mmAmount), currency: mmCurrency, phone: mmPhone, network: mmNetwork }),
      });
      const data = await res.json() as { chargeId?: string; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur serveur");
      setMmChargeId(data.chargeId ?? null);
      setMmMessage(data.message ?? "En attente de confirmation client.");
      setMmPollCount(0);
    } catch (err: unknown) {
      setMmError((err as Error).message);
      setMmStep("error");
    }
  };

  useEffect(() => {
    if (mmStep !== "pending" || !mmChargeId) return;
    if (mmPollCount >= 24) { setMmError("Délai dépassé. Réessayez."); setMmStep("error"); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/payments/mobile-money/status/${mmChargeId}`, { credentials: "include" });
        const data = await res.json() as { status?: string };
        if (data.status === "succeeded") setMmStep("success");
        else if (data.status === "failed" || data.status === "expired") { setMmError("Paiement refusé ou annulé."); setMmStep("error"); }
        else setMmPollCount((c) => c + 1);
      } catch { setMmPollCount((c) => c + 1); }
    }, 5000);
    return () => clearTimeout(t);
  }, [mmStep, mmChargeId, mmPollCount]);

  const handleCloseDay = async () => {
    setCloseLoading(true);
    try {
      const res = await fetch("/api/vendor/close-day", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      setCloseSuccess(true);
      await loadDailyReport();
    } catch {
      // silent
    }
    setCloseLoading(false);
  };

  if (!user?.vendorId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground" />
          <p className="font-bold text-muted-foreground">Compte vendeur non configuré.</p>
        </div>
      </AppLayout>
    );
  }

  const closeActive   = isCloseButtonActive(now);
  const warnActive    = isWarningPeriod(now);
  const countdown     = warnActive ? secondsUntilClose(now) : 0;
  const alreadyClosed = !!dailyReport?.closure;

  // Compute daily totals
  const dailySales = dailyReport?.sales ?? [];
  const dailyTotalTickets = dailySales.reduce((s, r) => s + r.quantity, 0);
  const dailyTotalUsd = dailySales.filter(r => r.currency === "USD").reduce((s, r) => s + parseFloat(r.total_amount), 0);
  const dailyTotalFc  = dailySales.filter(r => r.currency === "FC").reduce((s, r) => s + parseFloat(r.total_amount), 0);

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-zone, #print-zone * { visibility: visible !important; }
          #print-zone { position: fixed; top: 0; left: 0; width: 100%; }
          .ticket-card {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1.5px dashed #aaa;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 12px;
            font-family: monospace;
          }
        }
      `}</style>

      <AppLayout>
        <div className="space-y-5">

          {/* ── Onglets ── */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {([
              { id: "pos",         label: "Tickets POS",  icon: ReceiptText },
              { id: "mobilemoney", label: "Mobile Money", icon: Smartphone  },
              { id: "jeux",        label: "Jeux",         icon: TrendingUp  },
              { id: "journee",     label: "Journée",      icon: CalendarCheck },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1 transition-all"
                style={tab === id ? { background: "#16a34a", color: "#fff" } : { background: "#f9fafb", color: "#6b7280" }}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════
              TAB — TICKETS POS
          ══════════════════════════════════════════ */}
          {tab === "pos" && (
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ReceiptText className="w-5 h-5 text-green-600" />
                <h2 className="font-black text-base text-gray-900">Générer des tickets</h2>
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600 font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={(e) => { void handleGenerate(e); }} className="space-y-4">
                <div className="flex rounded-xl overflow-hidden border border-gray-200">
                  {(["USD", "FC"] as const).map((c) => (
                    <button key={c} type="button" onClick={() => setCurrency(c)}
                      className="flex-1 py-2 text-sm font-bold transition-all"
                      style={currency === c ? { background: "#16a34a", color: "#fff" } : { background: "#f9fafb", color: "#6b7280" }}
                    >{c}</button>
                  ))}
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-1.5 font-medium">Montant par ticket</label>
                  <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100 transition">
                    <span className="px-3 text-gray-400 font-bold text-sm select-none">{currency === "USD" ? "$" : "FC"}</span>
                    <input
                      type="number" min="0.01" step="0.01" placeholder="0.00"
                      value={unitAmount} onChange={(e) => setUnitAmount(e.target.value)} required
                      className="flex-1 py-3 pr-4 text-base text-gray-800 outline-none bg-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-1.5 font-medium">Nombre de tickets</label>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="flex-1 text-center text-2xl font-black text-gray-900">{quantity}</span>
                    <button type="button" onClick={() => setQuantity((q) => Math.min(50, q + 1))}
                      className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {amount > 0 && (
                  <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-green-700 font-medium">Total à encaisser</span>
                    <span className="text-lg font-black text-green-700">{fmt(total, currency)}</span>
                  </div>
                )}

                <button type="submit" disabled={loading || amount <= 0}
                  className="w-full py-3.5 rounded-xl font-black text-white bg-green-600 hover:bg-green-700 active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ReceiptText className="w-4 h-4" />}
                  Générer les tickets
                </button>
              </form>
            </div>
          )}

          {/* Generated tickets */}
          {tab === "pos" && sale && (
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-black text-base text-gray-900">{sale.quantity} ticket{sale.quantity > 1 ? "s" : ""} générés</p>
                  <p className="text-sm text-gray-500 mt-0.5">Total encaissé : <span className="font-black text-green-700">{fmt(sale.totalAmount, sale.currency)}</span></p>
                </div>
                <button onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 active:scale-95 transition-all">
                  <Printer className="w-4 h-4" /> Imprimer
                </button>
              </div>
              <div id="print-zone" ref={printRef} className="space-y-2">
                {sale.codes.map((code, i) => (
                  <div key={code} className="ticket-card rounded-xl border border-dashed border-gray-300 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Ticket #{i + 1} · Halgo Cash</p>
                      <p className="text-base font-black text-gray-900 tracking-widest mt-0.5">{code}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{fmt(sale.unitAmount, sale.currency)} · {fmtDate(sale.createdAt)}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                      <ReceiptText className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* POS History */}
          {tab === "pos" && (
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
              <button onClick={() => { if (!history) void loadHistory(); else setHistory(null); }}
                className="w-full flex items-center justify-between px-5 py-4">
                <span className="font-black text-sm text-gray-700">Historique des ventes POS</span>
                {historyLoading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  : history ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {history && history.length === 0 && <p className="px-5 pb-4 text-sm text-gray-400">Aucune vente enregistrée.</p>}
              {history && history.length > 0 && (
                <div className="divide-y divide-gray-50">
                  {history.map((h) => {
                    const open = expandedIds.has(h.id);
                    const unit = parseFloat(h.unit_amount);
                    const tot = parseFloat(h.total_amount);
                    return (
                      <div key={h.id}>
                        <button className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                          onClick={() => toggleExpanded(h.id)}>
                          <div>
                            <p className="text-sm font-bold text-gray-800">{h.quantity} ticket{h.quantity > 1 ? "s" : ""} × {fmt(unit, h.currency)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(h.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-green-700">{fmt(tot, h.currency)}</span>
                            {open ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
                          </div>
                        </button>
                        {open && (
                          <div className="px-5 pb-3 space-y-1">
                            {(h.codes ?? []).map((code, i) => (
                              <div key={code} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                                <span className="text-[10px] text-gray-400 font-bold w-5">#{i + 1}</span>
                                <span className="font-mono text-sm font-black text-gray-700 tracking-widest">{code}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB — MOBILE MONEY
          ══════════════════════════════════════════ */}
          {tab === "mobilemoney" && (
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone className="w-5 h-5 text-green-600" />
                <h2 className="font-black text-base text-gray-900">Encaissement Mobile Money</h2>
              </div>

              {mmStep === "form" && (
                <form onSubmit={(e) => { void handleMmSubmit(e); }} className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Réseau</p>
                    <div className="flex gap-2">
                      {MM_NETWORKS.map((n) => (
                        <button key={n.id} type="button" onClick={() => setMmNetwork(n.id)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold border transition-all"
                          style={mmNetwork === n.id
                            ? { background: n.color + "18", border: `2px solid ${n.color}`, color: n.color }
                            : { background: "#f9fafb", border: "1px solid #e5e7eb", color: "#9ca3af" }}
                        >{n.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Devise</p>
                    <div className="flex rounded-xl overflow-hidden border border-gray-200">
                      {(["USD", "CDF"] as const).map((c) => (
                        <button key={c} type="button" onClick={() => setMmCurrency(c)}
                          className="flex-1 py-2.5 text-sm font-bold transition-all"
                          style={mmCurrency === c ? { background: "#16a34a", color: "#fff" } : { background: "#f9fafb", color: "#6b7280" }}
                        >{c}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Montant</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">{mmCurrency === "USD" ? "$" : "FC"}</span>
                      <input type="number" min="1" step="any" placeholder="0.00" required
                        value={mmAmount} onChange={(e) => setMmAmount(e.target.value)}
                        className="w-full h-12 pl-9 pr-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-bold focus:outline-none focus:border-green-400"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Téléphone client</p>
                    <input type="tel" placeholder="+243810000000" required
                      value={mmPhone} onChange={(e) => setMmPhone(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:outline-none focus:border-green-400"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Format : +243 suivi de 9 chiffres</p>
                  </div>
                  <button type="submit"
                    className="w-full h-12 rounded-xl bg-green-600 text-white font-black text-sm hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <Smartphone className="w-4 h-4" /> Initier l'encaissement
                  </button>
                </form>
              )}

              {mmStep === "pending" && (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-3" />
                  <p className="font-black text-gray-900 mb-1">En attente de confirmation</p>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">{mmMessage || "Le client doit confirmer le paiement sur son téléphone."}</p>
                  <p className="text-xs text-gray-300 mt-4">Vérification automatique toutes les 5 secondes…</p>
                </div>
              )}

              {mmStep === "success" && (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="font-black text-green-700 text-lg mb-1">Paiement reçu !</p>
                  <p className="text-sm text-gray-500 mb-5">{mmAmount} {mmCurrency} encaissés.</p>
                  <button onClick={() => { setMmStep("form"); setMmAmount(""); setMmPhone("+243"); setMmChargeId(null); }}
                    className="px-6 py-2.5 rounded-xl bg-green-600 text-white font-black text-sm hover:bg-green-700 transition-all">
                    Nouvel encaissement
                  </button>
                </div>
              )}

              {mmStep === "error" && (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                  <p className="font-black text-red-600 mb-1">Échec du paiement</p>
                  <p className="text-sm text-gray-500 mb-5">{mmError}</p>
                  <button onClick={() => { setMmStep("form"); setMmError(""); }}
                    className="px-6 py-2.5 rounded-xl bg-gray-800 text-white font-black text-sm hover:bg-gray-700 transition-all">
                    Réessayer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB — JEUX POS
          ══════════════════════════════════════════ */}
          {tab === "jeux" && (
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-700" />
                <h2 className="font-black text-base text-gray-900">Jeux POS</h2>
                <span className="ml-auto text-[10px] text-gray-400 font-medium">Malette · Sport</span>
              </div>
              <JeuxTab />
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB — JOURNÉE
          ══════════════════════════════════════════ */}
          {tab === "journee" && (
            <div className="space-y-4">

              {/* ── Countdown warning ── */}
              {warnActive && !alreadyClosed && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-black text-amber-800">Clôture dans {formatCountdown(countdown)}</p>
                    <p className="text-xs text-amber-600 mt-0.5">Préparez votre versement — la journée se clôture à 16h30.</p>
                  </div>
                </div>
              )}

              {/* ── Daily totals card ── */}
              {dailyLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>
              ) : (
                <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <h2 className="font-black text-base text-gray-900">Résumé du jour</h2>
                    <span className="ml-auto text-xs text-gray-400">{dailyReport?.dayDate ?? ""}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tickets vendus</p>
                      <p className="text-2xl font-black text-gray-900">{dailyTotalTickets}</p>
                    </div>
                    <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3">
                      <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">À verser</p>
                      {dailyTotalUsd > 0 && <p className="text-lg font-black text-green-700">{fmt(dailyTotalUsd, "USD")}</p>}
                      {dailyTotalFc > 0  && <p className="text-lg font-black text-green-700">{fmt(dailyTotalFc, "FC")}</p>}
                      {dailyTotalUsd === 0 && dailyTotalFc === 0 && <p className="text-sm text-gray-400">—</p>}
                    </div>
                  </div>

                  {/* Transactions list */}
                  {dailySales.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Aucune vente aujourd'hui.</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Détail des ventes</p>
                      {dailySales.map((s) => (
                        <div key={s.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                          <div>
                            <p className="text-sm font-bold text-gray-800">
                              {s.quantity} ticket{s.quantity > 1 ? "s" : ""} × {fmt(parseFloat(s.unit_amount), s.currency)}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {fmtTime(s.created_at)}
                            </p>
                          </div>
                          <span className="text-sm font-black text-green-700">{fmt(parseFloat(s.total_amount), s.currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Closure status / button ── */}
              <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
                {alreadyClosed ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 border border-green-200 flex items-center justify-center mx-auto mb-3">
                      <LockKeyhole className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="font-black text-green-700 text-base mb-1">Journée clôturée</p>
                    <p className="text-xs text-gray-400">
                      {fmtDate(dailyReport!.closure!.closed_at)}
                    </p>
                    {(parseFloat(dailyReport!.closure!.total_amount_usd) > 0 || parseFloat(dailyReport!.closure!.total_amount_fc) > 0) && (
                      <div className="mt-3 rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-left">
                        <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-1">Montant à verser</p>
                        {parseFloat(dailyReport!.closure!.total_amount_usd) > 0 &&
                          <p className="font-black text-green-800">{fmt(parseFloat(dailyReport!.closure!.total_amount_usd), "USD")}</p>}
                        {parseFloat(dailyReport!.closure!.total_amount_fc) > 0 &&
                          <p className="font-black text-green-800">{fmt(parseFloat(dailyReport!.closure!.total_amount_fc), "FC")}</p>}
                        <p className="text-xs text-green-600 mt-1">{dailyReport!.closure!.total_tickets} ticket{(dailyReport!.closure!.total_tickets ?? 0) > 1 ? "s" : ""} vendus</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <UnlockKeyhole className="w-5 h-5 text-gray-500" />
                      <h3 className="font-black text-gray-900 text-sm">Clôturer la journée</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                      {closeActive
                        ? "Confirmez la clôture pour enregistrer votre bilan du jour et préparer le versement."
                        : "La clôture est disponible à partir de 16h30. Revenez en fin de journée."}
                    </p>

                    {closeSuccess && (
                      <div className="mb-3 rounded-xl bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700 font-bold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Journée clôturée avec succès !
                      </div>
                    )}

                    <button
                      onClick={() => { void handleCloseDay(); }}
                      disabled={!closeActive || closeLoading}
                      className="w-full py-3.5 rounded-xl font-black text-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                      style={closeActive
                        ? { background: "#16a34a", color: "#fff" }
                        : { background: "#f3f4f6", color: "#9ca3af", cursor: "not-allowed" }}
                    >
                      {closeLoading
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <LockKeyhole className="w-4 h-4" />}
                      {closeActive ? "Clôturer la journée" : `Disponible à 16h30`}
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </AppLayout>
    </>
  );
}
