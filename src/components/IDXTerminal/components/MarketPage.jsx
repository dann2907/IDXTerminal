import { fmtPrice, fmtPct } from "../helpers/formatters";

export default function MarketPage({ gainers, losers, quotes, flashMap, onSelectTicker }) {
  return (
    <div style={{ padding: 12, overflow: "auto", height: "100%" }}>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, letterSpacing: 2, color: "#2a4060", marginBottom: 10, textTransform: "uppercase" }}>
        Market Overview
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { label: "GAINERS", items: gainers, color: "#00d68f" },
          { label: "LOSERS", items: losers, color: "#ff4560" },
        ].map((g) => (
          <div key={g.label} style={{ background: "#070d1c", border: "1px solid #0f2040", borderRadius: 6, padding: 10 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 8, letterSpacing: 2, color: "#2a4060", marginBottom: 8 }}>
              {g.label}
            </div>
            {g.items.map((q) => (
              <div
                key={q.ticker}
                style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #0a1830", cursor: "pointer" }}
                onClick={() => onSelectTicker(q.ticker)}
              >
                <span style={{ fontSize: 10, color: "#8aa8cc" }}>{q.ticker.replace(".JK", "")}</span>
                <span style={{ fontSize: 10, color: g.color, fontWeight: 700 }}>
                  {q.change_pct >= 0 ? "+" : ""}{q.change_pct.toFixed(2)}%
                  <span style={{ color: "#4a6080", marginLeft: 6 }}>{fmtPrice(q.price)}</span>
                </span>
              </div>
            ))}
            {!g.items.length && <div style={{ fontSize: 9, color: "#2a4060" }}>Menunggu data...</div>}
          </div>
        ))}
      </div>
      <div style={{ background: "#070d1c", border: "1px solid #0f2040", borderRadius: 6, padding: 10 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 8, letterSpacing: 2, color: "#2a4060", marginBottom: 8 }}>ALL QUOTES</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ color: "#2a4060", borderBottom: "1px solid #0f2040" }}>
              {["Symbol", "Last", "Change", "Volume", "High", "Low"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "4px 8px", fontWeight: 400, letterSpacing: 1, fontSize: 8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.values(quotes).map((q) => {
              const fl = flashMap[q.ticker];
              return (
                <tr
                  key={q.ticker}
                  className={fl ? `flash-${fl}` : ""}
                  style={{ borderBottom: "1px solid #0a1830", cursor: "pointer" }}
                  onClick={() => onSelectTicker(q.ticker)}
                >
                  <td style={{ padding: "5px 8px", color: "#8aa8cc", fontWeight: 700 }}>{q.ticker.replace(".JK", "")}</td>
                  <td style={{ padding: "5px 8px", color: "#c8d8f0" }}>{fmtPrice(q.price)}</td>
                  <td style={{ padding: "5px 8px" }} className={q.change_pct >= 0 ? "up" : "dn"}>{fmtPct(q.change_pct)}</td>
                  <td style={{ padding: "5px 8px", color: "#4a6080" }}>{(q.volume / 1_000_000).toFixed(1)}M</td>
                  <td style={{ padding: "5px 8px", color: "#4a6080" }}>{fmtPrice(q.high)}</td>
                  <td style={{ padding: "5px 8px", color: "#4a6080" }}>{fmtPrice(q.low)}</td>
                </tr>
              );
            })}
            {!Object.keys(quotes).length && (
              <tr><td colSpan={6} style={{ padding: "12px 8px", color: "#2a4060", textAlign: "center" }}>Menunggu data market...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}