// src/components/IDXTerminal/components/RightPanel.jsx
import { fmtPrice, fmtRp, fmtPct } from "../helpers/formatters";

export default function RightPanel({
  summary, holdings, gainers, losers,
  selectedTicker, selectedQuote, trade,
  onSelectTicker
}) {
  return (
    <div className="panel">
      {/* Portfolio summary */}
      <div className="panel-section">
        <div className="panel-title">Portfolio</div>
        <div style={{ marginBottom: 6 }}>
          <div className="summary-label">Saldo Kas</div>
          <div className="summary-val">{summary ? fmtRp(summary.cash) : "—"}</div>
        </div>
        <div style={{ marginBottom: 6 }}>
          <div className="summary-label">Total Nilai</div>
          <div className="summary-val">{summary ? fmtRp(summary.total_value) : "—"}</div>
        </div>
        <div>
          <div className="summary-label">Floating P&L</div>
          <div className={`summary-val ${summary && summary.floating_pnl >= 0 ? "up" : "dn"}`}>
            {summary ? fmtRp(summary.floating_pnl) : "—"}
          </div>
        </div>
      </div>
      {/* Holdings mini */}
      <div className="panel-section">
        <div className="panel-title">Holdings</div>
        {holdings.slice(0, 5).map(h => (
          <div key={h.ticker} className="holding-item" onClick={() => onSelectTicker(h.ticker)} style={{ cursor: "pointer" }}>
            <div>
              <div className="h-sym">{h.ticker.replace(".JK", "")}</div>
              <div className="h-lots">{h.lots ?? h.shares} {h.lots ? "lot" : "shs"}</div>
            </div>
            <span className={h.pnl_pct >= 0 ? "up" : "dn"} style={{ fontSize: 10, fontWeight: 700 }}>
              {fmtPct(h.pnl_pct)}
            </span>
          </div>
        ))}
        {!holdings.length && <div style={{ fontSize: 9, color: "#2a4060" }}>Tidak ada holdings</div>}
      </div>
      {/* Top Gainers */}
      <div className="panel-section">
        <div className="panel-title">Top Gainers</div>
        {gainers.map(q => (
          <div key={q.ticker} className="mover-item" style={{ cursor: "pointer" }} onClick={() => onSelectTicker(q.ticker)}>
            <span className="mv-sym">{q.ticker.replace(".JK", "")}</span>
            <div className="mv-bar" style={{ background: `linear-gradient(to right,#00d68f88,transparent)` }} />
            <span className="mv-ch up">+{q.change_pct.toFixed(2)}%</span>
          </div>
        ))}
      </div>
      {/* Top Losers */}
      <div className="panel-section">
        <div className="panel-title">Top Losers</div>
        {losers.map(q => (
          <div key={q.ticker} className="mover-item" style={{ cursor: "pointer" }} onClick={() => onSelectTicker(q.ticker)}>
            <span className="mv-sym">{q.ticker.replace(".JK", "")}</span>
            <div className="mv-bar" style={{ background: `linear-gradient(to right,#ff456088,transparent)` }} />
            <span className="mv-ch dn">{q.change_pct.toFixed(2)}%</span>
          </div>
        ))}
      </div>
      {/* Quick Trade */}
      <div className="panel-section">
        <div className="panel-title">Quick Trade — {selectedTicker.replace(".JK", "")}</div>
        {/* Action toggle */}
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {["BUY", "SELL"].map(a => (
            <button key={a} onClick={() => trade.setAction(a)} style={{
              flex: 1, padding: "7px 0", fontSize: 10, fontFamily: "'Syne',sans-serif",
              fontWeight: 700, border: "none", borderRadius: 3, cursor: "pointer",
              background: trade.action === a ? (a === "BUY" ? "#00d68f33" : "#ff456033") : "#0a1628",
              color: trade.action === a ? (a === "BUY" ? "#00d68f" : "#ff4560") : "#4a6080",
              borderTop: `2px solid ${trade.action === a ? (a === "BUY" ? "#00d68f" : "#ff4560") : "transparent"}`,
            }}>{a}</button>
          ))}
        </div>
        {selectedQuote && (
          <div style={{ background: "#040d1a", border: "1px solid #0f2040", borderRadius: 3, padding: "6px 8px", marginBottom: 8, fontSize: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#4a6080" }}>Harga sekarang</span>
              <span style={{ color: "#c8d8f0", fontFamily: "'Space Mono',monospace" }}>{fmtPrice(selectedQuote.price)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
              <span style={{ color: "#4a6080", fontSize: 10 }}>Perubahan</span>
              <span style={{ fontSize: 10 }} className={selectedQuote.change_pct >= 0 ? "up" : "dn"}>
                {selectedQuote.change_pct >= 0 ? "+" : ""}{selectedQuote.change_pct.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "#4a6080", fontFamily: "'Syne',sans-serif" }}>JUMLAH LOT</span>
            <span style={{ fontSize: 10, color: "#2e8fdf" }}>1 lot = 100 lembar</span>
          </div>
          <input className="trade-input" type="number" placeholder="Jumlah lot (mis. 5)" min={1}
            value={trade.lots} onChange={e => trade.setLots(e.target.value)}
            onKeyDown={e => e.key === "Enter" && trade.handleOpenConfirm()} />
        </div>
        {selectedQuote && trade.lots && (
          <div style={{ background: "#040d1a", border: "1px solid #0f2040", borderRadius: 3, padding: "6px 8px", marginBottom: 8, fontSize: 10, color: "#4a6080" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Estimasi nilai</span>
              <span style={{ color: "#c8d8f0", fontFamily: "'Space Mono',monospace" }}>
                ≈ {fmtRp(parseInt(trade.lots, 10) * 100 * selectedQuote.price)}
              </span>
            </div>
            <div style={{ color: "#2a4060", marginTop: 2 }}>
              {trade.lots} lot × 100 lembar × {fmtPrice(selectedQuote.price)}
            </div>
          </div>
        )}
        <button onClick={trade.handleOpenConfirm} style={{
          width: "100%", padding: "8px 0", fontSize: 11, fontFamily: "'Syne',sans-serif",
          fontWeight: 700, letterSpacing: 1, border: "none", borderRadius: 3, cursor: "pointer",
          background: trade.action === "BUY" ? "#00d68f" : "#ff4560",
          color: "#050a14", opacity: !trade.lots ? 0.6 : 1,
        }}>{trade.action === "BUY" ? "▲ BUY" : "▼ SELL"}</button>
        {trade.message && (
          <div style={{ marginTop: 7, padding: "6px 9px", borderRadius: 3, fontSize: 11,
            background: trade.message.ok ? "#00d68f11" : "#ff456011",
            color: trade.message.ok ? "#00d68f" : "#ff4560",
            border: `1px solid ${trade.message.ok ? "#00d68f33" : "#ff456033"}`,
            display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
            <span style={{ flex: 1 }}>{trade.message.message}</span>
            {!trade.message.ok && (
              <button onClick={() => trade.setMessage(null)} style={{ background: "transparent", border: "none", color: "#ff4560", cursor: "pointer", fontSize: 12, padding: 0, flexShrink: 0 }}>✕</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}