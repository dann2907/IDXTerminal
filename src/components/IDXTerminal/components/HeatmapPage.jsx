import { fmtPct } from "../helpers/formatters";

export default function HeatmapPage({ quotes, onSelectTicker }) {
  return (
    <div style={{ overflow: "auto", height: "100%" }}>
      <div style={{ padding: "12px 12px 4px", fontFamily: "'Syne',sans-serif", fontSize: 10, letterSpacing: 2, color: "#2a4060", textTransform: "uppercase" }}>
        Sector Heatmap
      </div>
      <div className="hm-grid">
        {Object.values(quotes)
          .sort((a, b) => b.change_pct - a.change_pct)
          .map((q) => {
            const intensity = Math.min(Math.abs(q.change_pct) / 5, 1);
            const bg =
              q.change_pct >= 0
                ? `rgba(0,${Math.floor(100 + 110 * intensity)},${Math.floor(80 * (1 - intensity))},${0.4 + 0.5 * intensity})`
                : `rgba(${Math.floor(150 + 105 * intensity)},${Math.floor(50 * (1 - intensity))},${Math.floor(40 * (1 - intensity))},${0.4 + 0.5 * intensity})`;
            return (
              <div
                key={q.ticker}
                className="hm-cell"
                style={{ width: 60, height: 60, background: bg }}
                onClick={() => onSelectTicker(q.ticker)}
              >
                <span className="hm-sym">{q.ticker.replace(".JK", "")}</span>
                <span className="hm-ch">{fmtPct(q.change_pct)}</span>
              </div>
            );
          })}
        {!Object.keys(quotes).length && <div style={{ color: "#2a4060", fontSize: 11, padding: 20 }}>Menunggu data...</div>}
      </div>
    </div>
  );
}