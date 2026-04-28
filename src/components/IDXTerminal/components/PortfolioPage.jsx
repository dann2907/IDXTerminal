// src/components/IDXTerminal/components/PortfolioPage.jsx
//
// 
//
// Komponen child (OrdersPanel, TradeHistory, PerformancePanel) diimport
// dari "../../portfolio/..." (naik ke src/components/ dulu, lalu masuk portfolio/)

import { useState } from "react";
import { usePortfolioStore } from "../../../stores/usePortfolioStore";
import { fmtRp, fmtPrice, fmtPct } from "../helpers/formatters";
import OrdersPanel      from "../../portfolio/OrdersPanel";
import TradeHistory     from "../../portfolio/TradeHistory";
import PerformancePanel from "../../portfolio/PerformancePanel";

const TABS = [
  { key: "holdings",    label: "Holdings"      },
  { key: "orders",      label: "Orders TP/SL"  },
  { key: "history",     label: "Trade History" },
  { key: "performance", label: "Performance"   },
];

export default function PortfolioPage({ selectedTicker, onSelectTicker }) {
  const [tab, setTab] = useState("holdings");
  const summary  = usePortfolioStore(s => s.summary);
  const holdings = usePortfolioStore(s => s.holdings);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Tab bar */}
      <div style={{
        display:       "flex",
        gap:           2,
        padding:       "8px 12px 0",
        borderBottom:  "1px solid #0f2040",
        flexShrink:    0,
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding:       "5px 14px",
              fontSize:      9,
              fontFamily:    "'Syne', sans-serif",
              fontWeight:    700,
              letterSpacing: 1,
              border:        "none",
              borderBottom:  tab === t.key ? "2px solid #2e8fdf" : "2px solid transparent",
              background:    "transparent",
              color:         tab === t.key ? "#2e8fdf" : "#4a6080",
              cursor:        "pointer",
              textTransform: "uppercase",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>

        {tab === "holdings" && (
          <div>
            {/* Summary cards */}
            <div style={{
              display:             "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap:                 8,
              marginBottom:        12,
            }}>
              {[
                { label: "SALDO KAS",    val: summary ? fmtRp(summary.cash) : "—",          col: "#c8d8f0" },
                { label: "TOTAL NILAI",  val: summary ? fmtRp(summary.total_value) : "—",    col: "#c8d8f0" },
                { label: "FLOATING P&L", val: summary ? fmtRp(summary.floating_pnl) : "—",   col: summary && summary.floating_pnl >= 0 ? "#00d68f" : "#ff4560" },
                { label: "REALIZED P&L", val: summary ? fmtRp(summary.realized_pnl) : "—",   col: summary && summary.realized_pnl >= 0 ? "#00d68f" : "#ff4560" },
              ].map(c => (
                <div key={c.label} style={{
                  background:   "#070d1c",
                  border:       "1px solid #0f2040",
                  borderRadius: 6,
                  padding:      "10px 12px",
                }}>
                  <div style={{
                    fontSize:      8,
                    letterSpacing: 1,
                    color:         "#2a4060",
                    fontFamily:    "'Syne',sans-serif",
                    marginBottom:  4,
                  }}>
                    {c.label}
                  </div>
                  <div style={{ fontSize: 13, color: c.col, fontWeight: 700 }}>{c.val}</div>
                </div>
              ))}
            </div>

            {/* Holdings table */}
            <div style={{
              background:   "#070d1c",
              border:       "1px solid #0f2040",
              borderRadius: 6,
              padding:      10,
            }}>
              <div style={{
                fontFamily:    "'Syne',sans-serif",
                fontSize:      8,
                letterSpacing: 2,
                color:         "#2a4060",
                marginBottom:  8,
              }}>
                HOLDINGS
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr style={{ color: "#2a4060", borderBottom: "1px solid #0f2040" }}>
                    {["Ticker", "Lot", "Avg Cost", "Harga", "Nilai Pasar", "P&L", "%"].map(h => (
                      <th key={h} style={{
                        textAlign:  "left",
                        padding:    "4px 8px",
                        fontWeight: 400,
                        fontSize:   8,
                        letterSpacing: 1,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(h => (
                    <tr
                      key={h.ticker}
                      style={{ borderBottom: "1px solid #0a1830", cursor: "pointer" }}
                      onClick={() => onSelectTicker(h.ticker)}
                    >
                      <td style={{ padding: "5px 8px", color: "#8aa8cc", fontWeight: 700 }}>
                        {h.ticker.replace(".JK", "")}
                      </td>
                      <td style={{ padding: "5px 8px", color: "#c8d8f0" }}>
                        {h.lots ?? h.shares}
                      </td>
                      <td style={{ padding: "5px 8px", color: "#4a6080" }}>
                        {fmtPrice(h.avg_cost)}
                      </td>
                      <td style={{ padding: "5px 8px", color: "#c8d8f0" }}>
                        {fmtPrice(h.current_price)}
                      </td>
                      <td style={{ padding: "5px 8px", color: "#4a6080" }}>
                        {fmtRp(h.market_value)}
                      </td>
                      <td style={{ padding: "5px 8px" }} className={h.pnl_rp >= 0 ? "up" : "dn"}>
                        {fmtRp(h.pnl_rp)}
                      </td>
                      <td style={{ padding: "5px 8px" }} className={h.pnl_pct >= 0 ? "up" : "dn"}>
                        {fmtPct(h.pnl_pct)}
                      </td>
                    </tr>
                  ))}
                  {!holdings.length && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{ padding: "32px 8px", textAlign: "center", color: "#4a6080" }}
                      >
                        Belum ada holdings
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "orders"      && <OrdersPanel />}
        {tab === "history"     && <TradeHistory />}
        {tab === "performance" && <PerformancePanel />}
      </div>
    </div>
  );
}