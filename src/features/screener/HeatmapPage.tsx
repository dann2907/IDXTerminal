import { memo, useMemo } from "react";
import { fmtPrice, fmtPct } from "@/lib/formatters";
import { QuoteData } from "@/types";

interface HeatmapPageProps {
  quotes: Record<string, QuoteData>;
  onSelectTicker: (ticker: string) => void;
}

const HeatmapPage = memo(function HeatmapPage({ quotes, onSelectTicker }: HeatmapPageProps) {
  const quoteList = useMemo(() => 
    Object.values(quotes).sort((a, b) => b.change_pct - a.change_pct)
  , [quotes]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="p-6 border-b border-border bg-surface/30">
        <h2 className="text-lg font-bold text-white tracking-tight">Market Heatmap</h2>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Relative performance by daily change</p>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="flex flex-wrap gap-2 content-start">
          {quoteList.length > 0 ? (
            quoteList.map((q) => {
              const intensity = Math.min(Math.abs(q.change_pct) / 5, 1);
              const color =
                q.change_pct >= 0
                  ? `rgba(16, 185, 129, ${0.1 + intensity * 0.9})`
                  : `rgba(244, 63, 94, ${0.1 + intensity * 0.9})`;

              const borderColor = 
                q.change_pct >= 0
                  ? `rgba(16, 185, 129, 0.4)`
                  : `rgba(244, 63, 94, 0.4)`;

              return (
                <div
                  key={q.ticker}
                  className="group relative flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] border border-transparent hover:border-white/20 shadow-lg"
                  style={{
                    backgroundColor: color,
                    borderColor: borderColor,
                    width: "72px",
                    height: "72px",
                  }}
                  onClick={() => onSelectTicker(q.ticker)}
                >
                  <span className="text-xs font-black text-white group-hover:text-accent transition-colors">{q.ticker.replace(".JK", "")}</span>
                  <span className="text-[10px] font-bold text-white/80">{fmtPct(q.change_pct)}</span>
                  
                  {/* Tooltip hint */}
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-white/40 rounded-full scale-0 group-hover:scale-100 transition-transform" />
                </div>
              );
            })
          ) : (
            <div className="w-full py-20 flex flex-col items-center justify-center text-slate-500 gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-accent animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">Aggregating market data...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default HeatmapPage;
