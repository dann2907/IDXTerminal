// src/components/portfolio/PerformancePanel.tsx
//
// Panel performa portfolio:
//   - Period selector: Hari Ini | Minggu Ini | Bulan Ini | Semua
//   - Metrics cards: Realized P&L, Win Rate, Best Trade, Worst Trade
//   - Per-ticker breakdown table
//   - Equity curve dari trade history (SVG, no extra deps)
//
// Future Improvement(tandain "Done" kalau sudah diimplementasikan):
//   - upgrade equity curve
//   - detailed gain/loss perday,week,month,year (include pnl/floating pnl hari ke hari)

import { useState, useEffect, useMemo } from "react";
import { usePortfolioStore, type TradeRecord } from "../../stores/usePortfolioStore";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PerfData {
  period: string
  by_ticker: Record<string, TickerStat>

  floating_pnl: number
  total_realized: number

  win_rate: number
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtRp = (v: number) => {
  const sign = v < 0 ? "-" : "+";
  const abs  = Math.abs(v);
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000)     return `${sign}${(abs / 1_000_000).toFixed(2)}Jt`;
  return `${sign}Rp${abs.toLocaleString("id")}`;
};

const PERIODS = [
  { key: "day",   label: "Hari Ini" },
  { key: "week",  label: "Minggu" },
  { key: "month", label: "Bulan" },
  { key: "all",   label: "Semua" },
] as const;

// ── Equity Curve SVG ──────────────────────────────────────────────────────────

function EquityCurve({ history }: { history: TradeRecord[] }) {
  // Hitung running equity dari sell transactions saja
  const points = useMemo(() => {
    let equity = 0;
    return history
      .filter(t => t.action === "SELL")
      .slice(-50) // max 50 titik
      .map(t => {
        equity += t.total;
        return equity;
      });
  }, [history]);

  if (points.length < 2) {
    return (
      <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: "#2a4060", fontSize: 10 }}>
        Belum ada transaksi SELL untuk grafik
      </div>
    );
  }

  const W = 600, H = 80;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const pts = points.map((v, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 8) - 4;
    return `${x},${y}`;
  }).join(" ");

  const isUp  = points[points.length - 1] >= points[0];
  const color = isUp ? "#00d68f" : "#ff4560";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 80 }}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={0} y1={H * f} x2={W} y2={H * f}
          stroke="#0f2040" strokeWidth={1} />
      ))}
      {/* Zero line */}
      <line x1={0} y1={H} x2={W} y2={H} stroke="#0f2040" strokeWidth={1} />
      {/* Area fill */}
      <polyline
        points={`0,${H} ${pts} ${W},${H}`}
        fill={`${color}18`}
        stroke="none"
      />
      {/* Line */}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PerformancePanel() {
  const performance    = usePortfolioStore(s => s.performance) as PerfData | null;
  const history        = usePortfolioStore(s => s.history);
  const fetchPerformance = usePortfolioStore(s => s.fetchPerformance);
  const fetchHistory   = usePortfolioStore(s => s.fetchHistory);

  const [period, setPeriod] = useState<"day" | "week" | "month" | "all">("all");

  useEffect(() => {
    fetchPerformance(period);
    fetchHistory();
  }, [period, fetchPerformance, fetchHistory]);

  const perf = performance as PerfData | null;

  const MetricCard = ({ label, value, color = "#c8d8f0", sub = "" }: {
    label: string; value: string; color?: string; sub?: string;
  }) => (
    <div style={{
      background:   "#070d1c",
      border:       "1px solid #0f2040",
      borderRadius: 6,
      padding:      "10px 14px",
    }}>
      <div style={{ fontSize: 8, letterSpacing: 1, color: "#4a6080", fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: "'Space Mono', monospace" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 9, color: "#4a6080", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "auto", height: "100%" }}>

      {/* ── Period selector ── */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: "#4a6080", letterSpacing: 2, fontFamily: "'Syne', sans-serif" }}>PERIODE</span>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)} style={{
            padding:    "4px 14px",
            fontSize:   9,
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            border:     "1px solid #0f2040",
            borderRadius: 3,
            cursor:     "pointer",
            background: period === p.key ? "#2e8fdf22" : "transparent",
            color:      period === p.key ? "#2e8fdf" : "#4a6080",
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Metric cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, flexShrink: 0 }}>
        <MetricCard
          label="REALIZED P&L"
          value={perf ? fmtRp(perf.total_realized) : "—"}
          color={perf ? (perf.total_realized >= 0 ? "#00d68f" : "#ff4560") : "#c8d8f0"}
        />
        <MetricCard
            label="WIN RATE"
            value={perf ? `${perf.win_rate.toFixed(1)}%` : "—"}
            color={perf && perf.win_rate >= 50 ? "#00d68f" : "#ff4560"}
            sub={perf ? `${perf.total_trades} trades` : ""}
        />
        <MetricCard
          label="BEST TRADE"
          value={perf && perf.best_trade !== undefined ? fmtRp(perf.best_trade) : "—"}
          color="#00d68f"
        />
        <MetricCard
          label="WORST TRADE"
          value={perf && perf.worst_trade !== undefined ? fmtRp(perf.worst_trade) : "—"}
          color="#ff4560"
        />
      </div>

      {/* ── Equity curve ── */}
      <div style={{
        background:   "#070d1c",
        border:       "1px solid #0f2040",
        borderRadius: 6,
        padding:      "10px 12px",
        flexShrink:   0,
      }}>
        <div style={{ fontSize: 8, letterSpacing: 2, color: "#4a6080", fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>
          EQUITY CURVE — KUMULATIF HASIL SELL
        </div>
        <EquityCurve history={history} />
      </div>

      {/* ── Per-ticker table ── */}
      {perf && perf.by_ticker && Object.keys(perf.by_ticker).length > 0 && (
        <div style={{
          background:   "#070d1c",
          border:       "1px solid #0f2040",
          borderRadius: 6,
          overflow:     "auto",
        }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #0f2040" }}>
            <span style={{ fontSize: 8, letterSpacing: 2, color: "#4a6080", fontFamily: "'Syne', sans-serif" }}>
              PERFORMA PER SAHAM
            </span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead>
              <tr style={{ color: "#2a4060" }}>
                {["Ticker", "Realized P&L", "Trades", "Win Rate"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "5px 12px", fontWeight: 400, fontSize: 8, letterSpacing: 1, fontFamily: "'Syne', sans-serif" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(perf.by_ticker)
                    .sort(([, a], [, b]) => b.pnl_rp - a.pnl_rp)
                    .map(([ticker, stat]) => (
                  <tr key={ticker} style={{ borderTop: "1px solid #0a1830" }}>
                    <td style={{ padding: "6px 12px", color: "#8aa8cc", fontWeight: 700 }}>
                      {ticker.replace(".JK", "")}
                    </td>
                    <td style={{
                        padding: "6px 12px",
                        color: stat.pnl_rp >= 0 ? "#00d68f" : "#ff4560",
                        fontFamily: "'Space Mono', monospace",
                    }}>
                        {fmtRp(stat.pnl_rp)}
                    </td>
                    <td style={{ padding: "6px 12px", color: "#c8d8f0" }}>
                      {stat.trades}
                    </td>
                    <td style={{ padding: "6px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{
                          height:       6,
                          width:        `${Math.max(4, Math.abs(stat.pnl_pct))}%`,
                          maxWidth:     80,
                          background:   stat.pnl_pct >= 50 ? "#00d68f" : "#ff4560",
                          borderRadius: 3,
                        }} />
                        <span style={{ color: stat.pnl_pct >= 50 ? "#00d68f" : "#ff4560", fontSize: 9 }}>
                          {stat.pnl_pct.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {!perf && (
        <div style={{ textAlign: "center", color: "#2a4060", fontSize: 11, padding: 20 }}>
          Memuat data performa...
        </div>
      )}
    </div>
  );
}