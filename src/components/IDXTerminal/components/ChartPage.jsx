// src/components/IDXTerminal/components/ChartPage.jsx
import { useEffect, useState } from "react";
import { useMarketStore } from "../../stores/useMarketStore";
import { calcIndicators } from "../helpers/indicators";
import { fmtPrice } from "../helpers/formatters";
import CandleChart from "../chart/CandleChart";

const PERIOD_MAP = {
  "1D": { period: "1d", interval: "5m" },
  "5D": { period: "5d", interval: "15m" },
  "1M": { period: "1mo", interval: "1d" },
  "3M": { period: "3mo", interval: "1d" },
  "1Y": { period: "1y", interval: "1wk" },
  "5Y": { period: "5y", interval: "1wk" },
};
const PERIOD_KEYS = Object.keys(PERIOD_MAP);

export default function ChartPage({ ticker, inWatchlist, onWatchlistToggle }) {
  const selectedQuote     = useMarketStore(s => s.quotes[ticker]);
  const selectedCandles   = useMarketStore(s => s.candles[ticker] ?? []);
  const fetchCandles      = useMarketStore(s => s.fetchCandles);

  const [period, setPeriod] = useState("3M");

  // Fetch candles when ticker or period changes
  useEffect(() => {
    const { period: p, interval: i } = PERIOD_MAP[period];
    fetchCandles(ticker, p, i);
  }, [ticker, period, fetchCandles]);

  const indicators = calcIndicators(selectedCandles);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div className="chart-header">
        <span className="ch-sym">{ticker.replace(".JK", "")}</span>
        <div>
          <div className="ch-price">{selectedQuote ? fmtPrice(selectedQuote.price) : "—"}</div>
          <div className={`ch-meta ${selectedQuote && selectedQuote.change_pct >= 0 ? "up" : "dn"}`}>
            {selectedQuote
              ? `${selectedQuote.change_pct >= 0 ? "▲" : "▼"} ${Math.abs(selectedQuote.change_pct).toFixed(2)}%  ·  H: ${fmtPrice(selectedQuote.high)}  L: ${fmtPrice(selectedQuote.low)}  Vol: ${(selectedQuote.volume / 1_000_000).toFixed(1)}M`
              : "Memuat data..."}
          </div>
        </div>
        <div className="period-tabs">
          {PERIOD_KEYS.map(p => (
            <button key={p} className={`period-btn${period === p ? " active" : ""}`}
              onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
        <button onClick={onWatchlistToggle}
          title={inWatchlist ? "Hapus dari watchlist" : "Tambah ke watchlist"}
          style={{
            padding: "3px 10px", fontSize: 12, marginLeft: 6,
            border: `1px solid ${inWatchlist ? "#f59e0b" : "#0f2040"}`, borderRadius: 3,
            background: inWatchlist ? "rgba(245,158,11,0.15)" : "transparent",
            color: inWatchlist ? "#f59e0b" : "#4a6080", cursor: "pointer",
          }}>
          {inWatchlist ? "★" : "☆"}
        </button>
      </div>

      {/* Chart + Indicators */}
      <div className="chart-box">
        <div className="chart-inner">
          <CandleChart
            ticker={ticker}
            period={PERIOD_MAP[period].period}
            interval="1d"
            height={300}
            inWatchlist={inWatchlist}
            onWatchlistToggle={onWatchlistToggle}
          />
        </div>
        <div className="indicator-row">
          <div className="ind-pill">MA20 <span style={{ color: "#f59e0b" }}>{indicators.ma20 ? fmtPrice(indicators.ma20) : "—"}</span></div>
          <div className="ind-pill">MA50 <span style={{ color: "#3b82f6" }}>{indicators.ma50 ? fmtPrice(indicators.ma50) : "—"}</span></div>
          <div className="ind-pill">RSI  <span style={{ color: "#a78bfa" }}>{indicators.rsi ? indicators.rsi.toFixed(1) : "—"}</span></div>
          <div className="ind-pill">
            MACD <span className={indicators.macd >= 0 ? "up" : "dn"}>
              {indicators.macd !== null ? `${indicators.macd >= 0 ? "▲" : "▼"} ${Math.abs(indicators.macd).toFixed(1)}` : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}