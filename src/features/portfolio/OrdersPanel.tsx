import { useState, useEffect, useRef } from "react";
import { usePortfolioStore } from "@/stores/portfolio";
import { useMarketStore } from "@/stores/market";
import { fmtPrice, fmtRp } from "@/lib/formatters";
import { Info, Plus, Trash2, CheckCircle2, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";

const STATUS_CONFIG: Record<string, { color: string, bg: string, icon: any, label: string }> = {
  ACTIVE:          { color: "text-blue-400", bg: "bg-blue-500/10", icon: Clock, label: "Active" },
  PENDING_CONFIRM: { color: "text-amber-400", bg: "bg-amber-500/10", icon: AlertTriangle, label: "Confirming" },
  EXECUTED:        { color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2, label: "Executed" },
  CANCELLED:       { color: "text-slate-500", bg: "bg-slate-800/50", icon: Trash2, label: "Cancelled" },
};

const fmtDate  = (s: string) => s ? s.slice(0, 16).replace("T", " ") : "—";

export default function OrdersPanel() {
  const orders      = usePortfolioStore(s => s.orders);
  const holdings    = usePortfolioStore(s => s.holdings);
  const loading     = usePortfolioStore(s => s.loading);
  const fetchOrders = usePortfolioStore(s => s.fetchOrders);
  const addOrder    = usePortfolioStore(s => s.addOrder);
  const fetchHoldings = usePortfolioStore(s => s.fetchHoldings);
  const cancelOrder = usePortfolioStore(s => s.cancelOrder);
  const quotes      = useMarketStore(s => s.quotes);

  const [formTicker, setFormTicker]   = useState("");
  const [formType, setFormType]       = useState<"TP" | "SL">("TP");
  const [formPrice, setFormPrice]     = useState("");
  const [formLots, setFormLots]       = useState("");
  const [formMsg, setFormMsg]         = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling]           = useState(false);
  const [filterStatus, setFilterStatus] = useState<"active" | "all">("active");

  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (formMsg?.ok) {
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
      msgTimerRef.current = setTimeout(() => setFormMsg(null), 6_000);
    }
    return () => { if (msgTimerRef.current) clearTimeout(msgTimerRef.current); };
  }, [formMsg]);

  useEffect(() => {
    fetchOrders();
    fetchHoldings();
  }, [fetchOrders, fetchHoldings]);

  const filteredOrders = filterStatus === "active"
    ? orders.filter(o => o.status === "ACTIVE" || o.status === "PENDING_CONFIRM")
    : orders;

  const selectedHolding = holdings.find(h => h.ticker === formTicker);
  const currentQuote = quotes[formTicker];
  const avgCost = selectedHolding?.avg_cost ?? 0;
  
  const priceNum  = parseFloat(formPrice);
  const lotsNum = parseInt(formLots, 10);
  const priceValid = !formPrice || !avgCost
    ? true
    : formType === "TP" ? priceNum > avgCost : priceNum < avgCost;

  const estimatedValue = !isNaN(priceNum) && !isNaN(lotsNum) && priceNum > 0 && lotsNum > 0
    ? priceNum * lotsNum * 100
    : null;

  const handleAddOrder = async () => {
    const price = parseFloat(formPrice);
    const lots  = parseInt(formLots, 10);
    if (!formTicker || !price || !lots) return;

    setSubmitting(true);
    const res = await addOrder(formTicker, formType, price, lots);
    setFormMsg(res);
    if (res.ok) {
      setFormPrice("");
      setFormLots("");
    }
    setSubmitting(false);
  };

  return (
    <div className="flex gap-6 h-full overflow-hidden">
      {/* Table Section */}
      <div className="flex-1 flex flex-col min-w-0 space-y-4 overflow-hidden">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            {(["active", "all"] as const).map(f => (
              <button 
                key={f} 
                onClick={() => setFilterStatus(f)} 
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                  filterStatus === f ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {f === "active" ? "Active" : "History"}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{filteredOrders.length} Orders Found</span>
        </div>

        <div className="flex-1 bg-slate-900/30 border border-slate-800 rounded-xl overflow-auto shadow-sm">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-sm">
              <tr>
                {["Ticker", "Type", "Trigger", "Qty", "Status", "Date", ""].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading.orders && filteredOrders.length === 0 ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-5 py-4"><div className="h-4 bg-slate-800 rounded w-full opacity-20"></div></td>
                  </tr>
                ))
              ) : filteredOrders.map(order => {
                const conf = STATUS_CONFIG[order.status] || STATUS_CONFIG.ACTIVE;
                const isCancelPending = pendingCancelId === order.order_id;
                const canCancel = order.status === "ACTIVE" || order.status === "PENDING_CONFIRM";
                
                return (
                  <tr key={order.order_id} className="group hover:bg-slate-800/30 transition-colors h-[52px]">
                    <td className="px-5 py-3 font-black text-xs text-blue-400 uppercase tracking-wide">
                      {order.ticker.replace(".JK", "")}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        order.order_type === "TP" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}>
                        {order.order_type === "TP" ? "Profit" : "Loss"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono font-bold text-white">{fmtPrice(order.trigger_price)}</span>
                        {quotes[order.ticker] && (
                          <span className="text-[10px] text-slate-500 font-medium">Last: {fmtPrice(quotes[order.ticker].price)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-300">{order.lots} <span className="text-[10px] text-slate-600 uppercase">Lots</span></span>
                        <span className="text-[9px] text-slate-600">{(order.lots * 100).toLocaleString()} shares</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${conf.bg}`}>
                        <conf.icon size={12} className={conf.color} />
                        <span className={`text-[10px] font-black uppercase tracking-tight ${conf.color}`}>{conf.label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[10px] font-bold text-slate-600 font-mono">
                      {fmtDate(order.created_at)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canCancel && (
                        isCancelPending ? (
                          <div className="flex items-center justify-end gap-2 animate-in fade-in slide-in-from-right-2">
                             <span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter">Cancel?</span>
                             <button 
                               onClick={async () => {
                                 setCancelling(true);
                                 await cancelOrder(order.order_id);
                                 setPendingCancelId(null);
                                 setCancelling(false);
                               }}
                               disabled={cancelling}
                               className="px-2 py-1 bg-rose-600 text-white text-[9px] font-black uppercase rounded hover:bg-rose-500 transition-colors"
                             >
                               Yes
                             </button>
                             <button onClick={() => setPendingCancelId(null)} className="px-2 py-1 bg-slate-800 text-slate-400 text-[9px] font-black uppercase rounded hover:bg-slate-700 transition-colors">
                               No
                             </button>
                          </div>
                        ) : (
                          <button onClick={() => setPendingCancelId(order.order_id)} className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 size={16} />
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading.orders && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-slate-900/50 rounded-full border border-slate-800 text-slate-700">
                        <Clock size={32} />
                      </div>
                      <div className="max-w-[200px]">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No Active Orders</p>
                        <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-tight">Automate your trades by setting TP/SL triggers</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Section */}
      <div className="w-72 shrink-0 flex flex-col space-y-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col space-y-5">
          <div className="flex items-center gap-2">
            <Plus size={16} className="text-blue-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Create Trigger</h3>
          </div>

          {/* Type Toggle */}
          <div className="flex p-1 bg-slate-950 rounded-lg gap-1">
            {(["TP", "SL"] as const).map(t => (
              <button 
                key={t} 
                onClick={() => setFormType(t)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black rounded-md transition-all ${
                  formType === t 
                    ? (t === "TP" ? "bg-emerald-500 text-slate-950 shadow-lg" : "bg-rose-500 text-slate-950 shadow-lg") 
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t === "TP" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {t === "TP" ? "TAKE PROFIT" : "STOP LOSS"}
              </button>
            ))}
          </div>

          <div className={`p-3 rounded-lg border flex gap-3 ${
            formType === "TP" ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500/80" : "bg-rose-500/5 border-rose-500/20 text-rose-500/80"
          }`}>
            <Info size={16} className="shrink-0 mt-0.5" />
            <p className="text-[10px] font-bold leading-relaxed uppercase tracking-tight">
              {formType === "TP" ? "Sell automatically when price rises to target." : "Sell automatically when price drops to limit."}
            </p>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Symbol Select */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target Asset</label>
              <select
                value={formTicker}
                onChange={e => { setFormTicker(e.target.value); setFormPrice(""); }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
              >
                <option value="">Select from holdings...</option>
                {holdings.map(h => (
                  <option key={h.ticker} value={h.ticker}>
                    {h.ticker.replace(".JK", "")} (Avg: {fmtPrice(h.avg_cost)})
                  </option>
                ))}
              </select>
            </div>

            {/* Price Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Trigger Price (Rp)</label>
              <input
                type="number"
                placeholder={formType === "TP" ? "Target price..." : "Exit price..."}
                value={formPrice}
                onChange={e => setFormPrice(e.target.value)}
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none transition-colors ${
                  formPrice && !priceValid ? "border-rose-500" : "border-slate-800 focus:border-blue-500/50"
                }`}
              />
              {avgCost > 0 && (
                 <p className={`text-[9px] font-bold uppercase tracking-tight ${formPrice && !priceValid ? "text-rose-500" : "text-slate-600"}`}>
                   {formType === "TP" ? `Suggested: > ${fmtPrice(avgCost)}` : `Suggested: < ${fmtPrice(avgCost)}`}
                 </p>
              )}
            </div>

            {/* Lots Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantity</label>
                <span className="text-[9px] font-bold text-blue-500/80">1 LOT = 100 SHARES</span>
              </div>
              <input
                type="number"
                placeholder="Enter lots..."
                min={1}
                value={formLots}
                onChange={e => setFormLots(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>

            {/* Estimate */}
            {estimatedValue !== null && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg border-dashed">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-bold text-slate-600 uppercase">Estimated Value</span>
                  <span className="text-[10px] font-mono font-black text-white">{fmtRp(estimatedValue)}</span>
                </div>
                <p className="text-[8px] font-bold text-slate-700 uppercase tracking-tighter text-right">
                  {formLots} lots × 100 × {fmtPrice(parseFloat(formPrice))}
                </p>
              </div>
            )}

            <button
              onClick={handleAddOrder}
              disabled={submitting || !formTicker || !formPrice || !formLots || !priceValid}
              className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                formType === "TP" 
                  ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" 
                  : "bg-rose-500 text-slate-950 hover:bg-rose-400"
              } disabled:opacity-30 disabled:pointer-events-none shadow-lg`}
            >
              {submitting ? "Processing..." : `Set ${formType === "TP" ? "Profit Target" : "Stop Loss"}`}
            </button>
          </div>

          {/* Feedback */}
          {formMsg && (
            <div className={`p-4 rounded-xl text-[10px] font-bold flex justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 ${
              formMsg.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            }`}>
              <span className="uppercase tracking-tight flex-1">{formMsg.message}</span>
              {!formMsg.ok && <button onClick={() => setFormMsg(null)} className="shrink-0 hover:text-white">✕</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
