// src/components/portfolio/TradeHistory.tsx
//
// Tabel riwayat transaksi BUY/SELL.
// Filter optional per ticker, sortir terbaru di atas.

import { useState, useEffect } from "react";
import { usePortfolioStore, type TradeRecord } from "../../stores/usePortfolioStore";

const fmtPrice  = (v: number) => v >= 1000 ? v.toLocaleString("id") : v.toString();
const fmtRp     = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000)     return `${(v / 1_000_000).toFixed(2)}Jt`;
  return `Rp${v.toLocaleString("id")}`;
};
const fmtDate   = (s: string) => s ? s.slice(0, 16).replace("T", " ") : "—";

const PAGE_SIZE = 25;

export default function TradeHistory() {
  const history     = usePortfolioStore(s => s.history);
  const holdings    = usePortfolioStore(s => s.holdings);
  const fetchHistory = usePortfolioStore(s => s.fetchHistory);

  const [filterTicker, setFilterTicker] = useState("");
  const [filterAction, setFilterAction] = useState<"" | "BUY" | "SELL">("");
  const [page, setPage]                 = useState(1);

  useEffect(() => {
    fetchHistory(filterTicker || undefined);
    setPage(1);
  }, [filterTicker, fetchHistory]);

  const filtered = history.filter(t => {
    if (filterAction && t.action !== filterAction) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allTickers = Array.from(new Set(history.map(t => t.ticker))).sort();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>

      {/* ── Filter bar ── */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: "#4a6080", letterSpacing: 2, fontFamily: "'Syne', sans-serif" }}>FILTER</span>

        <select
          value={filterTicker}
          onChange={e => setFilterTicker(e.target.value)}
          style={{
            background: "#040d1a", border: "1px solid #0f2040", borderRadius: 3,
            color: "#c8d8f0", fontSize: 10, padding: "4px 8px",
            fontFamily: "'Space Mono', monospace", cursor: "pointer",
          }}
        >
          <option value="">Semua ticker</option>
          {allTickers.map(t => <option key={t} value={t}>{t.replace(".JK", "")}</option>)}
        </select>

        <div style={{ display: "flex", gap: 4 }}>
          {(["", "BUY", "SELL"] as const).map(a => (
            <button key={a} onClick={() => { setFilterAction(a); setPage(1); }} style={{
              padding:    "3px 10px",
              fontSize:   9,
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              border:     "1px solid #0f2040",
              borderRadius: 3,
              cursor:     "pointer",
              background: filterAction === a ? (a === "BUY" ? "#00d68f22" : a === "SELL" ? "#ff456022" : "#2e8fdf22") : "transparent",
              color:      filterAction === a ? (a === "BUY" ? "#00d68f" : a === "SELL" ? "#ff4560" : "#2e8fdf") : "#4a6080",
            }}>
              {a || "Semua"}
            </button>
          ))}
        </div>

        <span style={{ marginLeft: "auto", fontSize: 9, color: "#4a6080" }}>
          {filtered.length} transaksi
        </span>
      </div>

      {/* ── Tabel ── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead style={{ position: "sticky", top: 0, background: "#0c1520" }}>
            <tr style={{ color: "#2a4060", borderBottom: "1px solid #0f2040" }}>
              {["Tanggal", "Aksi", "Ticker", "Lot", "Harga", "Total", "Sumber"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "5px 8px", fontWeight: 400, fontSize: 8, letterSpacing: 1, fontFamily: "'Syne', sans-serif" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map(t => (
              <tr key={t.id} style={{ borderBottom: "1px solid #0a1830" }}>
                <td style={{ padding: "5px 8px", color: "#4a6080", fontSize: 9 }}>
                  {fmtDate(t.traded_at)}
                </td>
                <td style={{ padding: "5px 8px" }}>
                  <span style={{
                    display:    "inline-block",
                    padding:    "1px 7px",
                    borderRadius: 3,
                    fontSize:   9,
                    fontWeight: 700,
                    fontFamily: "'Syne', sans-serif",
                    background: t.action === "BUY" ? "rgba(0,214,143,0.15)" : "rgba(255,69,96,0.15)",
                    color:      t.action === "BUY" ? "#00d68f" : "#ff4560",
                  }}>
                    {t.action === "BUY" ? "▲ BUY" : "▼ SELL"}
                  </span>
                </td>
                <td style={{ padding: "5px 8px", color: "#8aa8cc", fontWeight: 700 }}>
                  {t.ticker.replace(".JK", "")}
                </td>
                <td style={{ padding: "5px 8px", color: "#c8d8f0" }}>
                  {t.lots ?? Math.round(t.shares / 100)}
                </td>
                <td style={{ padding: "5px 8px", color: "#c8d8f0", fontFamily: "'Space Mono', monospace" }}>
                  {fmtPrice(t.price)}
                </td>
                <td style={{ padding: "5px 8px", color: t.action === "BUY" ? "#ff4560" : "#00d68f", fontFamily: "'Space Mono', monospace" }}>
                  {t.action === "SELL" ? "+" : "-"}{fmtRp(t.total)}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 9, color: "#2a4060" }}>
                  {t.source || "MANUAL"}
                </td>
              </tr>
            ))}
            {!pageData.length && (
              <tr>
                <td colSpan={7} style={{ padding: "16px 8px", color: "#2a4060", textAlign: "center" }}>
                  Tidak ada transaksi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexShrink: 0, paddingTop: 4 }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            style={{
              padding: "3px 10px", fontSize: 9, cursor: page === 1 ? "default" : "pointer",
              background: "transparent", border: "1px solid #0f2040", borderRadius: 3,
              color: page === 1 ? "#2a4060" : "#8aa8cc",
            }}
          >← Prev</button>
          <span style={{ fontSize: 9, color: "#4a6080", alignSelf: "center" }}>
            {page} / {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{
              padding: "3px 10px", fontSize: 9, cursor: page === totalPages ? "default" : "pointer",
              background: "transparent", border: "1px solid #0f2040", borderRadius: 3,
              color: page === totalPages ? "#2a4060" : "#8aa8cc",
            }}
          >Next →</button>
        </div>
      )}
    </div>
  );
}