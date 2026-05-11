import { memo, useMemo } from "react";
import { fmtPrice, fmtPct } from "./helpers/formatters";
import { QuoteData } from "../../types";

interface MarketPageProps {
  gainers: QuoteData[];
  losers: QuoteData[];
  quotes: Record<string, QuoteData>;
  flashMap: Record<string, "up" | "dn">;
  onSelectTicker: (ticker: string) => void;
}

const MarketPage = memo(function MarketPage({ gainers, losers, quotes, flashMap, onSelectTicker }: MarketPageProps) {
  const allQuotes = useMemo(() => Object.values(quotes), [quotes]);

  return (
    <div style={{ padding: 20, overflow: "auto", height: "100%" }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
        Market Overview
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Top Gainers", items: gainers, color: "var(--positive)" },
          { label: "Top Losers", items: losers, color: "var(--negative)" },
        ].map((g) => (
          <div key={g.label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase" }}>
              {g.label}
            </div>
            {g.items.length > 0 ? (
              g.items.map((q) => (
                <div
                  key={q.ticker}
                  style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.02)", cursor: "pointer" }}
                  onClick={() => onSelectTicker(q.ticker)}
                >
                  <span style={{ fontSize: 13, color: "var(--accent-primary)", fontWeight: 600 }}>{q.ticker.replace(".JK", "")}</span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 13, color: g.color, fontWeight: 700 }}>
                      {q.change_pct >= 0 ? "+" : ""}{q.change_pct.toFixed(2)}%
                    </span>
                    <span style={{ color: "var(--text-primary)", marginLeft: 8, fontSize: 13, fontFamily: "'Space Mono', monospace" }}>{fmtPrice(q.price)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Waiting for data...</div>
            )}
          </div>
        ))}
      </div>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase" }}>All Quotes</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Symbol", "Last", "Change", "Volume", "High", "Low"].map((h) => (
                <th key={h} style={{ textAlign: h === "Symbol" ? "left" : "right", padding: "8px 4px", fontSize: 11, color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allQuotes.length > 0 ? (
              allQuotes.map((q) => {
                const fl = flashMap[q.ticker];
                return (
                  <tr
                    key={q.ticker}
                    className={fl ? `flash-${fl}` : ""}
                    onClick={() => onSelectTicker(q.ticker)}
                    style={{ cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.02)" }}
                  >
                    <td style={{ color: "var(--accent-primary)", fontWeight: 700, padding: "10px 4px" }}>{q.ticker.replace(".JK", "")}</td>
                    <td style={{ color: "var(--text-primary)", fontFamily: "'Space Mono', monospace", textAlign: "right", padding: "10px 4px" }}>{fmtPrice(q.price)}</td>
                    <td className={q.change_pct >= 0 ? "up" : "dn"} style={{ fontWeight: 600, textAlign: "right", padding: "10px 4px" }}>{fmtPct(q.change_pct)}</td>
                    <td style={{ color: "var(--text-muted)", textAlign: "right", padding: "10px 4px" }}>{(q.volume / 1_000_000).toFixed(1)}M</td>
                    <td style={{ color: "var(--text-muted)", fontFamily: "'Space Mono', monospace", textAlign: "right", padding: "10px 4px" }}>{fmtPrice(q.high)}</td>
                    <td style={{ color: "var(--text-muted)", fontFamily: "'Space Mono', monospace", textAlign: "right", padding: "10px 4px" }}>{fmtPrice(q.low)}</td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={6} style={{ padding: "40px", color: "var(--text-muted)", textAlign: "center" }}>Waiting for market data...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default MarketPage;
