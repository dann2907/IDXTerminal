import { useState, memo, useMemo, useCallback } from "react";
import { usePortfolioStore } from "../../stores/usePortfolioStore";
import { fmtRp, fmtPrice, fmtPct } from "./helpers/formatters";
import OrdersPanel      from "../../components/portfolio/OrdersPanel";
import TradeHistory     from "../../components/portfolio/TradeHistory";
import PerformancePanel from "../../components/portfolio/PerformancePanel";
import { MoreVertical, TrendingUp, TrendingDown, Wallet, PieChart } from "lucide-react";
import type { Holding } from "../../types";

const TABS = [
  { key: "holdings",    label: "Holdings"      },
  { key: "orders",      label: "Orders TP/SL"  },
  { key: "history",     label: "Trade History" },
  { key: "performance", label: "Performance"   },
] as const;

interface PortfolioPageProps {
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
}

// ── Sub-components (Extracted for performance) ─────────────────────────────

const KPICard = memo(function KPICard({ 
  label, 
  val, 
  icon: Icon, 
  color, 
  bg 
}: { 
  label: string, 
  val: string, 
  icon: any, 
  color: string, 
  bg: string 
}) {
  return (
    <div className={`${bg} border border-slate-800 rounded-xl p-5 shadow-sm transition-all hover:border-slate-700`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
        <Icon size={14} className="text-slate-600" />
      </div>
      <div className={`text-xl font-mono font-black ${color}`}>
        {val}
      </div>
    </div>
  );
});

const HoldingRow = memo(function HoldingRow({ 
  h, 
  onSelectTicker, 
  showAvgCost 
}: { 
  h: Holding, 
  onSelectTicker: (t: string) => void, 
  showAvgCost: boolean 
}) {
  return (
    <tr
      onClick={() => onSelectTicker(h.ticker)}
      className="h-[52px] group hover:bg-slate-800/40 cursor-pointer transition-colors"
    >
      <td className="px-5 py-3">
        <span className="text-sm font-black text-blue-400 group-hover:text-blue-300 transition-colors uppercase">
          {h.ticker.replace(".JK", "")}
        </span>
      </td>
      <td className="text-center px-4 py-3">
        <span className="text-xs font-mono font-bold text-white bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">
          {h.lots ?? h.shares} <span className="text-[10px] text-slate-500 ml-0.5">Lot</span>
        </span>
      </td>
      <td className="text-right px-4 py-3 font-mono text-xs font-bold text-slate-300">
        {fmtPrice(h.current_price)}
      </td>
      {showAvgCost && (
        <td className="text-right px-4 py-3 font-mono text-xs text-slate-500 animate-in fade-in slide-in-from-right-2">
          {fmtPrice(h.avg_cost)}
        </td>
      )}
      <td className="text-right px-4 py-3">
        <div className="flex flex-col items-end">
          <span className={`text-xs font-mono font-black ${h.pnl_rp >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {h.pnl_rp >= 0 ? "+" : ""}{fmtRp(h.pnl_rp)}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${h.pnl_pct >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
            {h.pnl_pct >= 0 ? "+" : ""}{fmtPct(h.pnl_pct)}
          </span>
        </div>
      </td>
      <td className="text-right px-5 py-3 font-mono text-xs font-black text-white">
        {fmtRp(h.market_value)}
      </td>
      <td className="text-center px-4 py-3 relative">
        <button className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-slate-800 transition-all opacity-0 group-hover:opacity-100">
          <MoreVertical size={16} />
        </button>
      </td>
    </tr>
  );
});

// ── Main Component ─────────────────────────────────────────────────────────

const PortfolioPage = memo(function PortfolioPage({ onSelectTicker }: PortfolioPageProps) {
  const [tab, setTab] = useState<typeof TABS[number]["key"]>("holdings");
  const [showAvgCost, setShowAvgCost] = useState(false);
  
  const summary  = usePortfolioStore(s => s.summary);
  const holdings = usePortfolioStore(s => s.holdings);
  const loading = usePortfolioStore(s => s.loading);

  const stats = useMemo(() => [
    { label: "Floating P&L", val: summary ? fmtRp(summary.floating_pnl) : "—", icon: summary && summary.floating_pnl >= 0 ? TrendingUp : TrendingDown, color: summary && summary.floating_pnl >= 0 ? "text-emerald-400" : "text-rose-400", bg: "bg-blue-500/5" },
    { label: "Realized P&L", val: summary ? fmtRp(summary.realized_pnl) : "—", icon: PieChart, color: summary && summary.realized_pnl >= 0 ? "text-emerald-400" : "text-rose-400", bg: "bg-slate-900/50" },
    { label: "Cash Balance", val: summary ? fmtRp(summary.cash) : "—", icon: Wallet, color: "text-white", bg: "bg-slate-900/50" },
    { label: "Total Value",  val: summary ? fmtRp(summary.total_value) : "—", icon: TrendingUp, color: "text-white", bg: "bg-slate-900/50" },
  ], [summary]);

  const toggleAvgCost = useCallback(() => setShowAvgCost(prev => !prev), []);

  return (
    <div className="flex flex-col h-full bg-[#090D16] overflow-hidden">
      {/* Tab bar */}
      <nav className="flex items-center px-6 border-b border-slate-800 shrink-0" aria-label="Portfolio tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
              tab === t.key ? "text-blue-400 border-blue-400" : "text-slate-500 border-transparent hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {tab === "holdings" ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
              {stats.map(s => <KPICard key={s.label} {...s} />)}
            </div>

            {/* Holdings section */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BriefcaseIcon size={16} className="text-blue-500" />
                  <h2 className="text-sm font-black text-white uppercase tracking-tight">Active Holdings</h2>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={toggleAvgCost}
                    className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${showAvgCost ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"}`}
                  >
                    {showAvgCost ? "Hide Avg Cost" : "Show Avg Cost"}
                  </button>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{holdings.length} Positions</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-950/50">
                      <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-800">Ticker</th>
                      <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-800">Lot</th>
                      <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-800">Price (Rp)</th>
                      {showAvgCost && (
                        <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-800">Avg Cost</th>
                      )}
                      <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-800">P&L (Return %)</th>
                      <th className="text-right px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-800">Market Value</th>
                      <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 border-b border-slate-800"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {loading.holdings ? (
                       [...Array(3)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-5 py-4"><div className="h-4 w-16 bg-slate-800 rounded"></div></td>
                          <td className="px-4 py-4"><div className="h-4 w-10 mx-auto bg-slate-800 rounded"></div></td>
                          <td className="px-4 py-4"><div className="h-4 w-20 ml-auto bg-slate-800 rounded"></div></td>
                          <td className="px-4 py-4"><div className="h-4 w-24 ml-auto bg-slate-800 rounded"></div></td>
                          <td className="px-5 py-4"><div className="h-4 w-24 ml-auto bg-slate-800 rounded"></div></td>
                          <td className="px-4 py-4"></td>
                        </tr>
                       ))
                    ) : holdings.length > 0 ? (
                      holdings.map(h => (
                        <HoldingRow 
                          key={h.ticker} 
                          h={h} 
                          onSelectTicker={onSelectTicker} 
                          showAvgCost={showAvgCost} 
                        />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={showAvgCost ? 7 : 6} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="p-4 bg-slate-900/50 rounded-full border border-slate-800 text-slate-700">
                              <BriefcaseIcon size={32} />
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No holdings in portfolio</p>
                              <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-tight">Start by buying stocks from the market</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "orders" ? <OrdersPanel /> : null}
        {tab === "history" ? <TradeHistory /> : null}
        {tab === "performance" ? <PerformancePanel /> : null}
      </div>
    </div>
  );
});

function BriefcaseIcon({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
}

export default PortfolioPage;
