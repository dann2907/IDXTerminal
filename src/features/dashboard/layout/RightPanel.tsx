import { memo, useMemo } from "react";
import { fmtPrice, fmtRp, fmtPct } from "@/lib/formatters";
import { QuoteData, Holding, PortfolioSummary } from "@/types";
import { ArrowUpRight, ArrowDownRight, Wallet, Briefcase, TrendingUp, Zap } from "lucide-react";

interface RightPanelProps {
  summary: PortfolioSummary | null;
  holdings: Holding[];
  gainers: QuoteData[];
  losers: QuoteData[];
  selectedTicker: string;
  selectedQuote: QuoteData | undefined;
  trade: {
    action: "BUY" | "SELL";
    setAction: (action: "BUY" | "SELL") => void;
    lots: string;
    setLots: (lots: string) => void;
    message: { ok: boolean; message: string } | null;
    setMessage: (msg: { ok: boolean; message: string } | null) => void;
    handleOpenConfirm: () => void;
  };
  onSelectTicker: (ticker: string) => void;
}

const RightPanel = memo(function RightPanel({
  summary, holdings, gainers, losers,
  selectedTicker, selectedQuote, trade,
  onSelectTicker
}: RightPanelProps) {
  const holdingsList = useMemo(() => holdings.slice(0, 5), [holdings]);

  return (
    <aside className="flex flex-col border-l border-slate-800 bg-[#0B1120] overflow-y-auto">
      <div className="p-4 space-y-6">
        
        {/* Quick Trade Section - STICKY */}
        <div className="sticky top-0 z-10 bg-[#0B1120] pb-2">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 shadow-xl ring-1 ring-slate-800/50">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={14} className="text-amber-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quick Execution</h3>
            </div>

            {selectedQuote ? (
              <div className="mb-4">
                <div className="flex items-baseline justify-between">
                  <h4 className="text-xl font-black text-white">{selectedTicker.replace(".JK", "")}</h4>
                  <span className="text-xs font-mono font-bold text-slate-400">{fmtPrice(selectedQuote.price)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-[10px] font-bold mt-0.5 ${selectedQuote.change_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {selectedQuote.change_pct >= 0 ? "+" : ""}{selectedQuote.change_pct.toFixed(2)}%
                  </p>
                  <span className="text-[8px] text-slate-500 font-bold uppercase">{selectedQuote.sector || "Unknown Sector"}</span>
                </div>
              </div>
            ) : (
              <div className="mb-4 py-2 border border-dashed border-slate-800 rounded-lg text-center">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Select Ticker</p>
              </div>
            )}

            <div className="flex p-1 bg-slate-950 rounded-lg gap-1 mb-4">
              <button 
                onClick={() => trade.setAction("BUY")}
                className={`flex-1 py-1.5 text-[10px] font-black rounded-md transition-all ${
                  trade.action === "BUY" ? "bg-emerald-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                BUY
              </button>
              <button 
                onClick={() => trade.setAction("SELL")}
                className={`flex-1 py-1.5 text-[10px] font-black rounded-md transition-all ${
                  trade.action === "SELL" ? "bg-rose-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                SELL
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Quantity (Lots)</span>
                  <span className="text-blue-400">1 lot = 100 shares</span>
                </div>
                <input 
                  type="number" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="0"
                  value={trade.lots}
                  onChange={e => trade.setLots(e.target.value)}
                />
              </div>

              {selectedQuote && trade.lots && (
                <div className="flex justify-between items-center py-2 border-t border-slate-800">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Est. Total</span>
                  <span className="text-xs font-mono font-black text-white">
                    {fmtRp(parseInt(trade.lots, 10) * 100 * selectedQuote.price)}
                  </span>
                </div>
              )}

              <button 
                onClick={trade.handleOpenConfirm}
                disabled={!trade.lots || !selectedQuote}
                className={`w-full py-2.5 rounded-lg text-xs font-black transition-all ${
                  trade.action === "BUY" 
                    ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:bg-emerald-900/30 disabled:text-emerald-800" 
                    : "bg-rose-500 hover:bg-rose-400 text-slate-950 disabled:bg-rose-900/30 disabled:text-rose-800"
                }`}
              >
                {trade.action === "BUY" ? "CONFIRM BUY" : "CONFIRM SELL"}
              </button>
            </div>
          </div>
        </div>

        {/* Key Metrics Section */}
        {selectedQuote && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-slate-500" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Key Metrics</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900/30 p-2.5 rounded-lg border border-slate-800/50">
                <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tight">Mkt Cap</p>
                <p className="text-[10px] font-mono font-bold text-white mt-0.5">{fmtRp(selectedQuote.market_cap)}</p>
              </div>
              <div className="bg-slate-900/30 p-2.5 rounded-lg border border-slate-800/50">
                <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tight">P/E Ratio</p>
                <p className="text-[10px] font-mono font-bold text-white mt-0.5">{selectedQuote.pe_ratio ? selectedQuote.pe_ratio.toFixed(1) : "—"}</p>
              </div>
              <div className="bg-slate-900/30 p-2.5 rounded-lg border border-slate-800/50">
                <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tight">PBV</p>
                <p className="text-[10px] font-mono font-bold text-white mt-0.5">{selectedQuote.pbv_ratio ? selectedQuote.pbv_ratio.toFixed(1) : "—"}</p>
              </div>
              <div className="bg-slate-900/30 p-2.5 rounded-lg border border-slate-800/50">
                <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tight">Div Yield</p>
                <p className="text-[10px] font-mono font-bold text-white mt-0.5">{selectedQuote.dividend_yield ? (selectedQuote.dividend_yield * 100).toFixed(2) + "%" : "—"}</p>
              </div>
            </div>
          </section>
        )}

        {/* Portfolio Stats */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Wallet size={14} className="text-slate-500" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Portfolio</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            <div className="bg-slate-900/30 p-3 rounded-lg border border-slate-800/50">
              <p className="text-[10px] font-bold text-slate-600 uppercase">Buying Power</p>
              <p className="text-xs font-mono font-bold text-white mt-1">{summary ? fmtRp(summary.cash) : "—"}</p>
            </div>
            <div className="bg-slate-900/30 p-3 rounded-lg border border-slate-800/50">
              <p className="text-[10px] font-bold text-slate-600 uppercase">Total Value</p>
              <p className="text-xs font-mono font-bold text-white mt-1">{summary ? fmtRp(summary.total_value) : "—"}</p>
            </div>
            <div className="bg-slate-900/30 p-3 rounded-lg border border-slate-800/50">
              <p className="text-[10px] font-bold text-slate-600 uppercase">Floating P&L</p>
              <p className={`text-xs font-mono font-bold mt-1 ${summary && summary.floating_pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {summary ? (summary.floating_pnl >= 0 ? "+" : "") + fmtRp(summary.floating_pnl) : "—"}
              </p>
            </div>
          </div>
        </section>

        {/* Top Holdings Mini */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Briefcase size={14} className="text-slate-500" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Top Holdings</h3>
          </div>

          <div className="space-y-1">
            {holdingsList.length > 0 ? (
              holdingsList.map(h => (
                <div 
                  key={h.ticker} 
                  onClick={() => onSelectTicker(h.ticker)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer border border-transparent hover:border-slate-800"
                >
                  <div>
                    <p className="text-[11px] font-black text-white">{h.ticker.replace(".JK", "")}</p>
                    <p className="text-[9px] font-bold text-slate-600">{h.lots ?? h.shares} Lots</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[10px] font-black ${h.pnl_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {fmtPct(h.pnl_pct)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-4 text-center border border-dashed border-slate-800 rounded-lg">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">No Holdings</p>
              </div>
            )}
          </div>
        </section>

        {/* Market Movers */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-slate-500" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Market Movers</h3>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Gainers */}
            <div className="space-y-1">
              {gainers.map(q => (
                <div key={q.ticker} onClick={() => onSelectTicker(q.ticker)} className="flex items-center justify-between group cursor-pointer">
                  <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-400 transition-colors">{q.ticker.replace(".JK", "")}</span>
                  <div className="flex-1 mx-2 h-[1px] bg-slate-800/50" />
                  <span className="text-[10px] font-black text-emerald-400">+{q.change_pct.toFixed(2)}%</span>
                </div>
              ))}
            </div>
            
            <div className="h-px bg-slate-800/50 mx-4" />

            {/* Losers */}
            <div className="space-y-1">
              {losers.map(q => (
                <div key={q.ticker} onClick={() => onSelectTicker(q.ticker)} className="flex items-center justify-between group cursor-pointer">
                  <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-400 transition-colors">{q.ticker.replace(".JK", "")}</span>
                  <div className="flex-1 mx-2 h-[1px] bg-slate-800/50" />
                  <span className="text-[10px] font-black text-rose-400">{q.change_pct.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </aside>
  );
});

export default RightPanel;
