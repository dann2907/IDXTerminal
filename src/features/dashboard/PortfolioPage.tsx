import { useState, memo } from "react";
import { usePortfolioStore } from "../../stores/usePortfolioStore";
import { fmtRp, fmtPrice, fmtPct } from "./helpers/formatters";
import OrdersPanel      from "../../components/portfolio/OrdersPanel";
import TradeHistory     from "../../components/portfolio/TradeHistory";
import PerformancePanel from "../../components/portfolio/PerformancePanel";

const TABS = [
  { key: "holdings",    label: "Holdings"      },
  { key: "orders",      label: "Orders TP/SL"  },
  { key: "history",     label: "Trade History" },
  { key: "performance", label: "Performance"   },
];

interface PortfolioPageProps {
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
}

const PortfolioPage = memo(function PortfolioPage({ selectedTicker, onSelectTicker }: PortfolioPageProps) {
  const [tab, setTab] = useState("holdings");
  const summary  = usePortfolioStore(s => s.summary);
  const holdings = usePortfolioStore(s => s.holdings);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Tab bar */}
      <nav style={{
        display:       "flex",
        gap:           2,
        padding:       "8px 12px 0",
        borderBottom:  "1px solid var(--border-color)",
        flexShrink:    0,
      }} aria-label="Portfolio tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            style={{
              padding:       "5px 14px",
              fontSize:      9,
              fontFamily:    "var(--font-main)",
              fontWeight:    700,
              letterSpacing: 1,
              border:        "none",
              borderBottom:  tab === t.key ? "2px solid var(--accent-primary)" : "2px solid transparent",
              background:    "transparent",
              color:         tab === t.key ? "var(--accent-primary)" : "var(--text-muted)",
              cursor:        "pointer",
              textTransform: "uppercase",
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>

        {tab === "holdings" ? (
          <div>
            {/* KPI Cards with Hierarchy */}
            <div style={{
              display:             "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap:                 12,
              marginBottom:        20,
            }}>
              {[
                { label: "Floating P&L", val: summary ? fmtRp(summary.floating_pnl) : "—",   col: summary && summary.floating_pnl >= 0 ? "var(--positive)" : "var(--negative)", primary: true },
                { label: "Realized P&L", val: summary ? fmtRp(summary.realized_pnl) : "—",   col: summary && summary.realized_pnl >= 0 ? "var(--positive)" : "var(--negative)", primary: true },
                { label: "Cash Balance", val: summary ? fmtRp(summary.cash) : "—",          col: "var(--text-primary)" },
                { label: "Total Value",  val: summary ? fmtRp(summary.total_value) : "—",    col: "var(--text-primary)" },
              ].map(c => (
                <div key={c.label} style={{
                  background:   c.primary ? "rgba(0, 194, 255, 0.03)" : "var(--bg-surface)",
                  border:       "1px solid var(--border-color)",
                  borderRadius: 8,
                  padding:      c.primary ? "16px 20px" : "12px 16px",
                }}>
                  <div style={{
                    fontSize:      11,
                    fontWeight:    600,
                    color:         "var(--text-muted)",
                    marginBottom:  c.primary ? 8 : 4,
                  }}>
                    {c.label}
                  </div>
                  <div style={{ 
                    fontSize: c.primary ? 24 : 18, 
                    color: c.col, 
                    fontWeight: 700,
                    fontFamily: "'Space Mono', monospace"
                  }}>{c.val}</div>
                </div>
              ))}
            </div>

            {/* Holdings table */}
            <div style={{
              background:   "var(--bg-surface)",
              border:       "1px solid var(--border-color)",
              borderRadius: 8,
              padding:      16,
            }}>
              <div style={{
                fontSize:      14,
                fontWeight:    600,
                color:         "var(--text-primary)",
                marginBottom:  12,
              }}>
                Holdings
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Ticker</th>
                    <th style={{ textAlign: "center" }}>Lot</th>
                    <th style={{ textAlign: "right" }}>Avg Cost</th>
                    <th style={{ textAlign: "right" }}>Current</th>
                    <th style={{ textAlign: "right" }}>Market Value</th>
                    <th style={{ textAlign: "right" }}>P&L</th>
                    <th style={{ textAlign: "right" }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.length > 0 ? (
                    holdings.map(h => (
                      <tr
                        key={h.ticker}
                        onClick={() => onSelectTicker(h.ticker)}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ color: "var(--accent-primary)", fontWeight: 600 }}>
                          {h.ticker.replace(".JK", "")}
                        </td>
                        <td style={{ textAlign: "center", color: "var(--text-primary)" }}>
                          {h.lots ?? h.shares}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "'Space Mono', monospace" }}>
                          {fmtPrice(h.avg_cost)}
                        </td>
                        <td style={{ textAlign: "right", color: "var(--text-primary)", fontFamily: "'Space Mono', monospace" }}>
                          {fmtPrice(h.current_price)}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "'Space Mono', monospace" }}>
                          {fmtRp(h.market_value)}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "'Space Mono', monospace" }} className={h.pnl_rp >= 0 ? "up" : "dn"}>
                          {fmtRp(h.pnl_rp)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }} className={h.pnl_pct >= 0 ? "up" : "dn"}>
                          {fmtPct(h.pnl_pct)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}
                      >
                        No holdings in portfolio
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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

export default PortfolioPage;
