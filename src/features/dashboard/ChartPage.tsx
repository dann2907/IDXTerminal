import { useEffect, useState, useMemo, memo } from "react";
import { useMarketStore } from "../../stores/useMarketStore";
import { calcIndicators } from "./helpers/indicators";
import { fmtPrice } from "./helpers/formatters";
import CandleChart from "../../components/chart/CandleChart";
import { Star, StarOff, Info, Maximize2, TrendingUp, TrendingDown } from "lucide-react";

interface PeriodConfig {
  period: string;
  interval: string;
}

const PERIOD_MAP: Record<string, PeriodConfig> = {
  "1D": { period: "1d",  interval: "5m"  },
  "5D": { period: "5d",  interval: "15m" },
  "1M": { period: "1mo", interval: "1d"  },
  "3M": { period: "3mo", interval: "1d"  },
  "1Y": { period: "1y",  interval: "1wk" },
  "5Y": { period: "5y",  interval: "1wk" },
};
const PERIOD_KEYS = Object.keys(PERIOD_MAP);

interface ChartPageProps {
  ticker: string;
  inWatchlist: boolean;
  onWatchlistToggle: () => void;
}

const ChartPage = memo(function ChartPage({ ticker, inWatchlist, onWatchlistToggle }: ChartPageProps) {
  const selectedQuote   = useMarketStore(s => s.quotes[ticker]);
  const selectedCandles = useMarketStore(s => s.candles[ticker] ?? []);
  const fetchCandles    = useMarketStore(s => s.fetchCandles);

  const [period, setPeriod] = useState("3M");

  // Fetch candles when ticker or period changes
  useEffect(() => {
    const config = PERIOD_MAP[period];
    if (config) {
      fetchCandles(ticker, config.period, config.interval);
    }
  }, [ticker, period, fetchCandles]);

  // Memoize indicators calculation
  const indicators = useMemo(() => calcIndicators(selectedCandles), [selectedCandles]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="chart-header flex items-center justify-between px-6 py-4 border-b border-border bg-surface/30">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-xl font-bold text-white tracking-tight">{ticker.replace(".JK", "")}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">IDX | Equity</span>
          </div>
          
          <div className="h-10 w-[1px] bg-border mx-2" />
          
          <div className="flex flex-col gap-0.5">
            <div className="text-2xl font-mono font-bold text-slate-100">{selectedQuote ? fmtPrice(selectedQuote.price) : "—"}</div>
            <div className={`text-xs font-bold flex items-center gap-2 ${selectedQuote && selectedQuote.change_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {selectedQuote ? (
                <>
                  <span>{selectedQuote.change_pct >= 0 ? "+" : ""}{selectedQuote.change_pct.toFixed(2)}%</span>
                  <span className="text-slate-600 font-medium tracking-tight">
                    H: {fmtPrice(selectedQuote.high)} · L: {fmtPrice(selectedQuote.low)}
                  </span>
                </>
              ) : "Streaming feed..."}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-slate-900 p-1 rounded-lg border border-border">
            {PERIOD_KEYS.map(p => (
              <button
                key={p}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                  period === p 
                    ? "bg-accent text-black shadow-lg" 
                    : "text-slate-500 hover:text-slate-300"
                }`}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onWatchlistToggle}
              className={`p-2 rounded-lg border transition-all ${
                inWatchlist 
                  ? "bg-amber-500/10 border-amber-500/50 text-amber-500" 
                  : "bg-slate-900 border-border text-slate-500 hover:text-slate-300"
              }`}
            >
              {inWatchlist ? <Star size={16} fill="currentColor" /> : <StarOff size={16} />}
            </button>
            <button className="p-2 bg-slate-900 border border-border rounded-lg text-slate-500 hover:text-slate-300 transition-colors">
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Chart + Indicators */}
      <div className="flex-1 flex flex-col p-6 gap-4">
        <div className="flex-1 bg-surface border border-border rounded-xl overflow-hidden shadow-inner p-4 relative">
          <CandleChart
            ticker={ticker}
            period={PERIOD_MAP[period].period}
            interval={PERIOD_MAP[period].interval}
            height={400}
            inWatchlist={inWatchlist}
            onWatchlistToggle={onWatchlistToggle}
          />
        </div>
        
        <div className="flex items-center gap-4 px-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg shadow-sm">
            <span className="text-[10px] font-bold text-slate-500">MA20</span>
            <span className="text-xs font-mono font-bold text-amber-400">
              {indicators.ma20 ? fmtPrice(indicators.ma20) : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg shadow-sm">
            <span className="text-[10px] font-bold text-slate-500">MA50</span>
            <span className="text-xs font-mono font-bold text-blue-400">
              {indicators.ma50 ? fmtPrice(indicators.ma50) : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg shadow-sm">
            <span className="text-[10px] font-bold text-slate-500">RSI</span>
            <span className="text-xs font-mono font-bold text-purple-400">
              {indicators.rsi ? indicators.rsi.toFixed(1) : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg shadow-sm">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">MACD</span>
            <div className={`flex items-center gap-1 text-xs font-mono font-bold ${(indicators.macd ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {indicators.macd !== null ? (
                <>
                  {indicators.macd >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {Math.abs(indicators.macd).toFixed(2)}
                </>
              ) : "—"}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 text-slate-600">
            <Info size={14} />
            <span className="text-[9px] font-bold uppercase tracking-widest">Real-time indicators processed by sidecar</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ChartPage;
