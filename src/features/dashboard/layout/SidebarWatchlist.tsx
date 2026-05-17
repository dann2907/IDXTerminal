import { useRef, useEffect, memo } from "react";
import Sparkline from "@/shared/ui/Sparkline";
import { fmtPrice, fmtPct } from "@/lib/formatters";
import { useMarketStore } from "@/stores/market";
import { WatchlistCategory } from "@/types";
import { Plus, Trash2, Edit3, X } from "lucide-react";

interface SidebarWatchlistProps {
  watchlist: {
    categories: WatchlistCategory[];
    active: WatchlistCategory | null;
    activeTickers: string[];
    setActiveId: (id: number) => void;
    newName: string;
    setNewName: (name: string) => void;
    createNew: () => void;
    renameActive: () => void;
    deleteActive: () => void;
    tickerInput: string;
    setTickerInput: (ticker: string) => void;
    manualAdd: () => void;
    removeTicker: (ticker: string) => void;
    msg: { ok: boolean; message: string } | null;
  };
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  flashMap: Record<string, "up" | "dn">;
}

const SidebarWatchlist = memo(function SidebarWatchlist({ watchlist, selectedTicker, onSelectTicker, flashMap }: SidebarWatchlistProps) {
  const quotes = useMarketStore((s) => s.quotes);
  const sparkRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    const activeSet = new Set(watchlist.activeTickers);
    for (const ticker of activeSet) {
      const q = quotes[ticker];
      if (!q) continue;

      if (!sparkRef.current[ticker]) sparkRef.current[ticker] = [];
      const history = sparkRef.current[ticker];
      history.push(q.price);
      if (history.length > 20) history.shift();
    }
  }, [quotes, watchlist.activeTickers]);

  return (
    <nav className="flex flex-col border-r border-slate-800 bg-[#0B1120] overflow-hidden" aria-label="Watchlist">
      <div className="p-4 flex flex-col h-full space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">Watchlist</h2>
          <span className="text-[10px] font-bold text-slate-600">{watchlist.activeTickers.length} Tickers</span>
        </div>

        {/* Categories Select */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {watchlist.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => watchlist.setActiveId(cat.id)}
                className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                  watchlist.active?.id === cat.id 
                    ? "bg-blue-600 text-white" 
                    : "bg-slate-800/50 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] font-medium placeholder:text-slate-600 focus:outline-none"
              placeholder="New category..."
              value={watchlist.newName}
              onChange={(e) => watchlist.setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && watchlist.createNew()}
            />
            <button 
              onClick={watchlist.createNew}
              className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Add Ticker Input */}
        <div className="flex gap-1">
          <input
            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            placeholder={watchlist.active ? "Add symbol (e.g. ASII)" : "Create category first"}
            value={watchlist.tickerInput}
            onChange={(e) => watchlist.setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && watchlist.manualAdd()}
            disabled={!watchlist.active}
          />
          <button
            onClick={watchlist.manualAdd}
            disabled={!watchlist.active}
            className="px-3 bg-blue-600 text-white rounded-lg disabled:opacity-30 flex items-center justify-center"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Watchlist Items */}
        <div className="flex-1 space-y-1 overflow-y-auto -mx-2 px-2 relative">
          {watchlist.activeTickers.map((ticker) => {
            const q = quotes[ticker];
            const fl = flashMap[ticker];
            const spark = sparkRef.current[ticker] || [];
            const isSelected = selectedTicker === ticker;

            return (
              <div
                key={ticker}
                onClick={() => onSelectTicker(ticker)}
                className={`group relative flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                  isSelected ? "bg-slate-800 shadow-lg ring-1 ring-slate-700" : "hover:bg-slate-800/50"
                } ${fl === "up" ? "bg-emerald-500/10" : fl === "dn" ? "bg-rose-500/10" : ""}`}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-black tracking-wide">{ticker.replace(".JK", "")}</span>
                  <div className="h-4 w-12 mt-1 opacity-50">
                    <Sparkline data={spark} color={q && q.change_pct >= 0 ? "#10b981" : "#f43f5e"} />
                  </div>
                </div>

                <div className="flex flex-col items-end mr-4">
                  <span className="text-xs font-mono font-bold">{q ? fmtPrice(q.price) : "—"}</span>
                  <span className={`text-[10px] font-black ${q && q.change_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {q ? (q.change_pct >= 0 ? "+" : "") + fmtPct(q.change_pct) : ""}
                  </span>
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); watchlist.removeTicker(ticker); }}
                  className="opacity-0 group-hover:opacity-100 absolute right-2 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-rose-500 text-slate-400 hover:text-white rounded-md p-1 transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}

          {watchlist.activeTickers.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Empty Watchlist</p>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
           <button 
            onClick={watchlist.renameActive}
            disabled={!watchlist.active}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800/50 hover:bg-slate-800 rounded-lg text-[10px] font-bold text-slate-400 disabled:opacity-30 transition-colors"
          >
            <Edit3 size={12} /> Edit
          </button>
          <button 
            onClick={watchlist.deleteActive}
            disabled={!watchlist.active || watchlist.active?.is_default}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800/50 hover:bg-rose-900/30 hover:text-rose-400 rounded-lg text-[10px] font-bold text-slate-400 disabled:opacity-30 transition-colors"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    </nav>
  );
});

export default SidebarWatchlist;
