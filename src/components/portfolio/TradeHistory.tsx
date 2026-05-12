import { useState, useEffect, useMemo } from "react";
import { usePortfolioStore } from "../../stores/usePortfolioStore";
import { fmtPrice, fmtRp } from "../../features/dashboard/helpers/formatters";
import { Filter, ChevronLeft, ChevronRight, History } from "lucide-react";

const fmtDate = (s: string) => s ? s.slice(0, 16).replace("T", " ") : "—";
const PAGE_SIZE = 25;

export default function TradeHistory() {
  const history     = usePortfolioStore(s => s.history);
  const fetchHistory = usePortfolioStore(s => s.fetchHistory);

  const [filterTicker, setFilterTicker] = useState("");
  const [filterAction, setFilterAction] = useState<"" | "BUY" | "SELL">("");
  const [page, setPage]                 = useState(1);

  useEffect(() => {
    fetchHistory(filterTicker || undefined);
    setPage(1);
  }, [filterTicker, fetchHistory]);

  const filtered = useMemo(() => history.filter(t => {
    if (filterAction && t.action !== filterAction) return false;
    return true;
  }), [history, filterAction]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allTickers = Array.from(new Set(history.map(t => t.ticker))).sort();

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      {/* Filter Bar */}
      <div className="flex items-center gap-4 shrink-0 px-1">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filter</span>
        </div>

        <select
          value={filterTicker}
          onChange={e => setFilterTicker(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-[10px] font-bold text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer min-w-[120px]"
        >
          <option value="">All Tickers</option>
          {allTickers.map(t => <option key={t} value={t}>{t.replace(".JK", "")}</option>)}
        </select>

        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          {(["", "BUY", "SELL"] as const).map(a => (
            <button 
              key={a} 
              onClick={() => { setFilterAction(a); setPage(1); }} 
              className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                filterAction === a ? "bg-slate-800 text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {a || "All"}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[10px] font-bold text-slate-600 uppercase tracking-widest">{filtered.length} Transactions</span>
      </div>

      {/* Table Section */}
      <div className="flex-1 bg-slate-900/30 border border-slate-800 rounded-xl overflow-auto shadow-sm">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-sm">
            <tr>
              {["Date", "Action", "Ticker", "Lot", "Price", "Total", "Source"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {pageData.length > 0 ? (
              pageData.map(t => (
                <tr key={t.id} className="h-[48px] hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-2 text-[10px] font-bold text-slate-500 font-mono">
                    {fmtDate(t.traded_at)}
                  </td>
                  <td className="px-5 py-2">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      t.action === "BUY" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}>
                      {t.action === "BUY" ? "Buy" : "Sell"}
                    </span>
                  </td>
                  <td className="px-5 py-2 font-black text-xs text-blue-400 uppercase tracking-wide">
                    {t.ticker.replace(".JK", "")}
                  </td>
                  <td className="px-5 py-2 text-xs font-bold text-slate-300">
                    {t.lots ?? Math.round(t.shares / 100)} <span className="text-[10px] text-slate-600 font-bold ml-0.5 uppercase">Lot</span>
                  </td>
                  <td className="px-5 py-2 font-mono text-xs font-bold text-slate-300">
                    {fmtPrice(t.price)}
                  </td>
                  <td className={`px-5 py-2 font-mono text-xs font-black ${t.action === "SELL" ? "text-emerald-400" : "text-rose-400"}`}>
                    {t.action === "SELL" ? "+" : "-"}{fmtRp(t.total)}
                  </td>
                  <td className="px-5 py-2">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">
                      {t.source || "MANUAL"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-24 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 bg-slate-900/50 rounded-full border border-slate-800 text-slate-700">
                      <History size={32} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No Transactions</p>
                      <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-tight">Your trade history will appear here</p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-2 shrink-0">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Page <span className="text-blue-400">{page}</span> of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
