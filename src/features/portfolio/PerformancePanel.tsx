import { useState, useEffect, useMemo, useRef } from "react";
import { usePortfolioStore } from "@/stores/portfolio";
import { fmtRp, fmtPct } from "@/lib/formatters";
import { TrendingUp, Target, Award, AlertCircle, BarChart3, Calendar, HelpCircle, Briefcase, ChevronRight } from "lucide-react";

interface PerfData {
  period: string
  by_ticker: Record<string, TickerStat>
  pnl_series: { date: string, pnl: number }[]
  floating_pnl: number
  total_realized: number
  win_rate: number
  win_count: number
  total_trades: number
  best_trade: number
  worst_trade: number
}

interface TickerStat {
  buy_total: number
  sell_total: number
  trades: number
  realized: number
  realized_modal: number
  pnl_rp: number
  pnl_pct: number
}

const PERIODS = [
  { key: "day",   label: "Day" },
  { key: "week",  label: "Week" },
  { key: "month", label: "Month" },
  { key: "all",   label: "All Time" },
] as const;

function EquityCurve({ series }: { series: { date: string, pnl: number }[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (series.length < 2) {
    return (
      <div className="h-40 flex flex-col items-center justify-center gap-2 border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
        <BarChart3 size={24} className="text-slate-700" />
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-10 text-center">Not enough data to generate P&L curve for this period</p>
      </div>
    );
  }

  const W = 1000, H = 160;
  const values = series.map(p => p.pnl);
  const min = Math.min(0, ...values); // include 0 baseline
  const max = Math.max(0.1, ...values);
  const range = max - min || 1;

  const pts = series.map((p, i) => {
    const x = (i / (series.length - 1)) * W;
    const y = H - ((p.pnl - min) / range) * (H - 40) - 20;
    return { x, y, val: p.pnl, date: p.date };
  });

  const polylineStr = pts.map(p => `${p.x},${p.y}`).join(" ");
  const lastPoint = pts[pts.length - 1];
  const isUp = lastPoint.val >= pts[0].val;
  const color = isUp ? "#10b981" : "#f43f5e";

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    
    let closestDist = Infinity;
    let closestIdx = 0;
    pts.forEach((p, i) => {
      const dist = Math.abs(p.x - mouseX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });
    setHoverIndex(closestIdx);
  };

  return (
    <div 
      ref={containerRef}
      className="relative cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIndex(null)}
    >
      {/* Tooltip Overlay */}
      {hoverIndex !== null && pts[hoverIndex] && (
        <div 
          className="absolute z-20 pointer-events-none bg-slate-950 border border-slate-700 rounded-lg p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ring-1 ring-slate-800"
          style={{ 
            left: `${(pts[hoverIndex].x / W) * 100}%`, 
            top: `${(pts[hoverIndex].y / H) * 100}%`,
            transform: `translate(${pts[hoverIndex].x > W/2 ? '-110%' : '10%'}, -50%)`
          }}
        >
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{pts[hoverIndex].date.slice(0, 16).replace("T", " ")}</p>
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-bold text-slate-400 uppercase">Cumulative P&L:</span>
             <span className={`text-sm font-mono font-black ${pts[hoverIndex].val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {fmtRp(pts[hoverIndex].val)}
             </span>
          </div>
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40 overflow-visible">
        <defs>
          <linearGradient id="curveGradientPerfFixed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Baseline (Zero) */}
        <line x1="0" y1={H - ((0 - min) / range) * (H - 40) - 20} x2={W} y2={H - ((0 - min) / range) * (H - 40) - 20} className="stroke-slate-800" strokeWidth="1" strokeDasharray="4,2" />
        
        {/* Fill Area */}
        <polyline points={`0,${H} ${polylineStr} ${W},${H}`} fill="url(#curveGradientPerfFixed)" />
        
        {/* Line Path */}
        <polyline 
          points={polylineStr} 
          fill="none" 
          stroke={color} 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="drop-shadow-lg"
        />

        {/* Hover Point */}
        {hoverIndex !== null && pts[hoverIndex] && (
          <>
            <line x1={pts[hoverIndex].x} y1="0" x2={pts[hoverIndex].x} y2={H} className="stroke-slate-700/50" strokeWidth="1" />
            <circle cx={pts[hoverIndex].x} cy={pts[hoverIndex].y} r="5" fill={color} className="animate-pulse" />
            <circle cx={pts[hoverIndex].x} cy={pts[hoverIndex].y} r="2" fill="#fff" />
          </>
        )}
      </svg>
    </div>
  );
}

export default function PerformancePanel() {
  const performance    = usePortfolioStore(s => s.performance) as PerfData | null;
  const holdings       = usePortfolioStore(s => s.holdings);
  const fetchPerformance = usePortfolioStore(s => s.fetchPerformance);
  const fetchHistory   = usePortfolioStore(s => s.fetchHistory);

  const [period, setPeriod] = useState<"day" | "week" | "month" | "all">("all");

  useEffect(() => {
    fetchPerformance(period);
    fetchHistory();
  }, [period, fetchPerformance, fetchHistory]);

  const perf = performance;

  const topMetrics = useMemo(() => [
    { label: "Realized P&L", val: perf ? fmtRp(perf.total_realized) : "—", color: perf ? (perf.total_realized >= 0 ? "text-emerald-400" : "text-rose-400") : "text-white", icon: Award, desc: "Profit/loss from closed positions in this period" },
    { label: "Win Rate", val: perf ? `${perf.win_rate.toFixed(1)}%` : "—", color: perf && perf.win_rate >= 50 ? "text-emerald-400" : "text-rose-400", sub: perf ? `${perf.win_count} WINS OUT OF ${perf.total_trades} TRADES` : "", icon: Target, desc: "Percentage of profitable sell trades" },
  ], [perf]);

  const subMetrics = useMemo(() => [
    { label: "Best Trade", val: perf && perf.best_trade !== undefined ? fmtRp(perf.best_trade) : "—", color: "text-emerald-400", icon: TrendingUp },
    { label: "Worst Trade", val: perf && perf.worst_trade !== undefined ? fmtRp(perf.worst_trade) : "—", color: "text-rose-400", icon: AlertCircle },
  ], [perf]);

  return (
    <div className="flex flex-col space-y-6 pb-12">
      
      {/* Time Period Selector - High Fidelity */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-slate-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analysis Period</span>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-900/50 border border-slate-800 rounded-xl shadow-sm">
          {PERIODS.map(p => (
            <button 
              key={p.key} 
              onClick={() => setPeriod(p.key as any)} 
              className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                period === p.key 
                  ? "bg-blue-600 text-white shadow-lg ring-1 ring-blue-500/50" 
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards - Balanced Hierarchy & Standardized Height */}
      <div className="grid grid-cols-12 gap-4 shrink-0">
        {topMetrics.map(m => (
          <div key={m.label} className="col-span-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl group hover:border-slate-700 transition-all min-h-[120px] flex flex-col justify-center">
             <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 brightness-125">{m.label}</span>
                <HelpCircle size={10} className="text-slate-600 cursor-help" />
              </div>
              <m.icon size={16} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
            </div>
            <div className={`text-2xl font-mono font-black tracking-tight ${m.color}`}>
              {m.val}
            </div>
            {m.sub ? (
              <p className="text-[9px] font-black text-slate-500 mt-2 uppercase tracking-widest">{m.sub}</p>
            ) : (
              <div className="h-4 mt-2" /> // spacer to match height
            )}
          </div>
        ))}
        <div className="col-span-4 flex flex-col gap-3">
           {subMetrics.map(m => (
             <div key={m.label} className="flex-1 bg-slate-900/30 border border-slate-800 rounded-xl px-5 py-3 shadow-sm flex items-center justify-between hover:border-slate-700 transition-all group">
               <div>
                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">{m.label}</p>
                 <p className={`text-sm font-mono font-black ${m.color}`}>{m.val}</p>
               </div>
               <m.icon size={18} className="text-slate-800 group-hover:text-slate-600 transition-colors" />
             </div>
           ))}
        </div>
      </div>

      {/* Equity Curve Section - Accurate Cumulative Realized */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <TrendingUp size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Periodic Profit Growth</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mt-0.5">Time-series of cumulative realized returns (closed trades)</p>
            </div>
          </div>
          <div className="px-3 py-1.5 bg-slate-950/50 rounded-lg border border-slate-800">
             <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Volatility: </span>
             <span className="text-[10px] font-mono font-bold text-emerald-500/80">LIMITED</span>
          </div>
        </div>
        <EquityCurve series={perf?.pnl_series || []} />
      </div>

      {/* Per-ticker Breakdown Table - No Cut-off (Parent Scroll) */}
      {perf && perf.by_ticker && Object.keys(perf.by_ticker).length > 0 && (
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/20">
             <div className="flex items-center gap-2">
               <Briefcase size={16} className="text-slate-400" />
               <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-300">Performance by Asset</h3>
             </div>
             <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{Object.keys(perf.by_ticker).length} Assets tracked</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-950/50">
                <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">Asset</th>
                <th className="text-right px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">Realized P&L</th>
                <th className="text-right px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">Current Value</th>
                <th className="text-center px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">Trades</th>
                <th className="text-right px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">Return %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {Object.entries(perf.by_ticker)
                .sort(([, a], [, b]) => b.pnl_rp - a.pnl_rp)
                .map(([ticker, stat]) => {
                  const holding = holdings.find(h => h.ticker === ticker);
                  return (
                    <tr key={ticker} className="h-[56px] hover:bg-slate-800/40 transition-all group cursor-pointer">
                      <td className="px-6 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-blue-400 group-hover:text-blue-300 uppercase tracking-tight transition-colors">
                            {ticker.replace(".JK", "")}
                          </span>
                          <ChevronRight size={14} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                        </div>
                      </td>
                      <td className={`px-6 py-2 font-mono text-xs font-black text-right ${stat.pnl_rp >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {fmtRp(stat.pnl_rp)}
                      </td>
                      <td className="px-6 py-2 text-right">
                        <span className="font-mono text-xs font-bold text-slate-300">
                          {holding ? fmtRp(holding.market_value) : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-2 text-center text-xs font-bold text-slate-500 font-mono">
                        {stat.trades}
                      </td>
                      <td className="px-6 py-2">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-20 h-1.5 bg-slate-800/50 rounded-full overflow-hidden shrink-0 border border-slate-800">
                            <div 
                              className={`h-full rounded-full transition-all duration-700 ease-out ${stat.pnl_pct >= 0 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-rose-500"}`}
                              style={{ width: `${Math.min(100, Math.max(5, Math.abs(stat.pnl_pct)))}%` }}
                            />
                          </div>
                          <span className={`text-[11px] font-black font-mono w-14 text-right ${stat.pnl_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {fmtPct(stat.pnl_pct)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {!perf && (
        <div className="flex flex-col items-center justify-center py-32 animate-pulse">
           <BarChart3 size={64} className="text-slate-800 mb-6" />
           <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Aggregating Intelligence...</p>
        </div>
      )}
    </div>
  );
}
