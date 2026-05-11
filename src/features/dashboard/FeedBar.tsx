import { memo } from "react";
import { QuoteData } from "../../types";
import { fmtPrice } from "./helpers/formatters";

interface FeedBarProps {
  quotes: Record<string, QuoteData>;
}

const FeedBar = memo(function FeedBar({ quotes }: FeedBarProps) {
  const list = Object.values(quotes).slice(0, 15);

  return (
    <div className="h-10 bg-[#0B1120] border-t border-slate-800 flex items-center overflow-hidden shrink-0">
      <div className="px-4 h-full flex items-center bg-blue-600 text-slate-950 text-[10px] font-black uppercase tracking-widest skew-x-[-15deg] -ml-2">
        <span className="skew-x-[15deg]">Market Feed</span>
      </div>
      
      <div className="flex-1 flex items-center gap-8 px-6 overflow-hidden whitespace-nowrap">
        {/* Simple animation simulate ticker if needed, but for now just a stable list */}
        <div className="flex items-center gap-8 animate-in fade-in duration-500">
          {list.map((q) => (
            <div key={q.ticker} className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase">{q.ticker.replace(".JK", "")}</span> 
              <span className="text-[10px] font-mono font-bold text-white">{fmtPrice(q.price)}</span> 
              <span className={`text-[9px] font-black ${q.change_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {q.change_pct >= 0 ? "+" : ""}{q.change_pct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default FeedBar;
