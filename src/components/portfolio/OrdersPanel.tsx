// src/components/portfolio/OrdersPanel.tsx
//
// Panel manajemen order TP/SL:
//   - Tabel order aktif (ACTIVE + PENDING_CONFIRM)
//   - Form tambah order baru
//   - Tombol cancel per order

import { useState, useEffect } from "react";
import { usePortfolioStore, type PortfolioOrder } from "../../stores/usePortfolioStore";
import { useMarketStore } from "../../stores/useMarketStore";

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width:       "100%",
  background:  "#040d1a",
  border:      "1px solid #0f2040",
  borderRadius: 3,
  color:       "#c8d8f0",
  fontFamily:  "'Space Mono', monospace",
  fontSize:    10,
  padding:     "5px 8px",
  outline:     "none",
  marginBottom: 5,
};

const BADGE = (type: "TP" | "SL"): React.CSSProperties => ({
  display:    "inline-block",
  padding:    "1px 6px",
  borderRadius: 3,
  fontSize:   9,
  fontWeight: 700,
  background: type === "TP" ? "rgba(0,214,143,0.15)" : "rgba(255,69,96,0.15)",
  color:      type === "TP" ? "#00d68f" : "#ff4560",
  border:     `1px solid ${type === "TP" ? "rgba(0,214,143,0.3)" : "rgba(255,69,96,0.3)"}`,
});

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:          "#4a6080",
  PENDING_CONFIRM: "#f59e0b",
  EXECUTED:        "#00d68f",
  CANCELLED:       "#2a4060",
};

const fmtPrice = (v: number) => v >= 1000 ? v.toLocaleString("id") : v.toString();
const fmtDate  = (s: string) => s ? s.slice(0, 16).replace("T", " ") : "—";

// ── Component ─────────────────────────────────────────────────────────────────

export default function OrdersPanel() {
  const orders      = usePortfolioStore(s => s.orders);
  const holdings    = usePortfolioStore(s => s.holdings);
  const fetchOrders = usePortfolioStore(s => s.fetchOrders);
  const addOrder    = usePortfolioStore(s => s.addOrder);
  const cancelOrder = usePortfolioStore(s => s.cancelOrder);
  const quotes      = useMarketStore(s => s.quotes);

  // Form state
  const [formTicker, setFormTicker]   = useState("");
  const [formType, setFormType]       = useState<"TP" | "SL">("TP");
  const [formPrice, setFormPrice]     = useState("");
  const [formLots, setFormLots]       = useState("");
  const [formMsg, setFormMsg]         = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  // Filter state
  const [filterStatus, setFilterStatus] = useState<"active" | "all">("active");

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = filterStatus === "active"
    ? orders.filter(o => o.status === "ACTIVE" || o.status === "PENDING_CONFIRM")
    : orders;

  const currentQuote = quotes[formTicker?.toUpperCase().endsWith(".JK")
    ? formTicker.toUpperCase()
    : `${formTicker?.toUpperCase()}.JK`];

  const handleAddOrder = async () => {
    const price = parseFloat(formPrice);
    const lots  = parseInt(formLots, 10);
    if (!formTicker || !price || !lots) return;

    setSubmitting(true);
    const res = await addOrder(
      formTicker,
      formType,
      price,
      lots,
    );
    setFormMsg(res);
    if (res.ok) {
      setFormPrice("");
      setFormLots("");
    }
    setSubmitting(false);
    setTimeout(() => setFormMsg(null), 4000);
  };

  const handleCancel = async (orderId: string) => {
    await cancelOrder(orderId);
  };

  return (
    <div style={{ display: "flex", gap: 12, height: "100%", overflow: "hidden" }}>

      {/* ── Kiri: Tabel order ── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Filter bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
          <span style={{ fontSize: 8, color: "#4a6080", letterSpacing: 2, fontFamily: "'Syne', sans-serif" }}>TAMPILKAN</span>
          {(["active", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)} style={{
              padding:    "3px 10px",
              fontSize:   9,
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              border:     "1px solid #0f2040",
              borderRadius: 3,
              cursor:     "pointer",
              background: filterStatus === f ? "#2e8fdf22" : "transparent",
              color:      filterStatus === f ? "#2e8fdf" : "#4a6080",
            }}>
              {f === "active" ? "Aktif" : "Semua"}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 9, color: "#4a6080" }}>
            {filteredOrders.length} order
          </span>
        </div>

        {/* Tabel */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ color: "#2a4060", borderBottom: "1px solid #0f2040" }}>
              {["Ticker", "Tipe", "Trigger", "Lot", "Status", "Dibuat", ""].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "4px 8px", fontWeight: 400, fontSize: 8, letterSpacing: 1, fontFamily: "'Syne', sans-serif" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => (
              <tr key={order.order_id} style={{ borderBottom: "1px solid #0a1830" }}>
                <td style={{ padding: "6px 8px", color: "#8aa8cc", fontWeight: 700 }}>
                  {order.ticker.replace(".JK", "")}
                </td>
                <td style={{ padding: "6px 8px" }}>
                  <span style={BADGE(order.order_type)}>{order.order_type}</span>
                </td>
                <td style={{ padding: "6px 8px", color: "#c8d8f0", fontFamily: "'Space Mono', monospace" }}>
                  {fmtPrice(order.trigger_price)}
                  {quotes[order.ticker] && (
                    <span style={{ color: "#4a6080", marginLeft: 4, fontSize: 9 }}>
                      / {fmtPrice(quotes[order.ticker].price)}
                    </span>
                  )}
                </td>
                <td style={{ padding: "6px 8px", color: "#c8d8f0" }}>{order.lots}</td>
                <td style={{ padding: "6px 8px" }}>
                  <span style={{ fontSize: 9, color: STATUS_COLOR[order.status] ?? "#4a6080" }}>
                    {order.status === "PENDING_CONFIRM" ? "⚡ PENDING" : order.status}
                  </span>
                </td>
                <td style={{ padding: "6px 8px", color: "#4a6080", fontSize: 9 }}>
                  {fmtDate(order.created_at)}
                </td>
                <td style={{ padding: "6px 8px" }}>
                  {(order.status === "ACTIVE" || order.status === "PENDING_CONFIRM") && (
                    <button onClick={() => handleCancel(order.order_id)} style={{
                      padding:    "2px 8px",
                      fontSize:   8,
                      fontFamily: "'Syne', sans-serif",
                      background: "rgba(255,69,96,0.1)",
                      color:      "#ff4560",
                      border:     "1px solid rgba(255,69,96,0.3)",
                      borderRadius: 3,
                      cursor:     "pointer",
                    }}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!filteredOrders.length && (
              <tr>
                <td colSpan={7} style={{ padding: "16px 8px", color: "#2a4060", textAlign: "center" }}>
                  Tidak ada order
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Kanan: Form tambah order ── */}
      <div style={{
        width:       220,
        flexShrink:  0,
        background:  "#070d1c",
        border:      "1px solid #0f2040",
        borderRadius: 6,
        padding:     12,
        alignSelf:   "flex-start",
      }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 8, letterSpacing: 2, color: "#2a4060", marginBottom: 10 }}>
          PASANG ORDER BARU
        </div>

        {/* Tipe TP/SL */}
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {(["TP", "SL"] as const).map(t => (
            <button key={t} onClick={() => setFormType(t)} style={{
              flex:       1,
              padding:    "5px 0",
              fontSize:   9,
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              border:     "none",
              borderRadius: 3,
              cursor:     "pointer",
              background: formType === t
                ? (t === "TP" ? "#00d68f33" : "#ff456033")
                : "#0a1628",
              color: formType === t
                ? (t === "TP" ? "#00d68f" : "#ff4560")
                : "#4a6080",
              borderTop: `2px solid ${formType === t ? (t === "TP" ? "#00d68f" : "#ff4560") : "transparent"}`,
            }}>
              {t === "TP" ? "📈 Take Profit" : "🛡️ Stop Loss"}
            </button>
          ))}
        </div>

        {/* Ticker selector dari holdings */}
        <div style={{ marginBottom: 5 }}>
          <div style={{ fontSize: 8, color: "#4a6080", marginBottom: 3, fontFamily: "'Syne', sans-serif" }}>TICKER</div>
          <select
            value={formTicker}
            onChange={e => setFormTicker(e.target.value)}
            style={{ ...INPUT, marginBottom: 0, cursor: "pointer" }}
          >
            <option value="">Pilih ticker...</option>
            {holdings.map(h => (
              <option key={h.ticker} value={h.ticker}>
                {h.ticker.replace(".JK", "")} — avg {fmtPrice(h.avg_cost)}
              </option>
            ))}
          </select>
        </div>

        {/* Info avg cost jika ada */}
        {formTicker && (() => {
          const h = holdings.find(hh => hh.ticker === formTicker);
          const q = currentQuote;
          if (!h) return null;
          return (
            <div style={{ fontSize: 9, color: "#4a6080", marginBottom: 6, lineHeight: 1.5 }}>
              Avg cost: <span style={{ color: "#c8d8f0" }}>{fmtPrice(h.avg_cost)}</span>
              {q && <> · Now: <span style={{ color: q.change_pct >= 0 ? "#00d68f" : "#ff4560" }}>{fmtPrice(q.price)}</span></>}
            </div>
          );
        })()}

        <div style={{ fontSize: 8, color: "#4a6080", marginBottom: 3, fontFamily: "'Syne', sans-serif" }}>HARGA TRIGGER</div>
        <input
          type="number"
          placeholder={formType === "TP" ? "Harga jual target" : "Harga cut-loss"}
          value={formPrice}
          onChange={e => setFormPrice(e.target.value)}
          style={INPUT}
        />

        <div style={{ fontSize: 8, color: "#4a6080", marginBottom: 3, fontFamily: "'Syne', sans-serif" }}>JUMLAH LOT</div>
        <input
          type="number"
          placeholder="Lot"
          value={formLots}
          onChange={e => setFormLots(e.target.value)}
          style={INPUT}
        />

        {/* Estimasi nilai */}
        {formPrice && formLots && (
          <div style={{ fontSize: 9, color: "#4a6080", marginBottom: 8 }}>
            Estimasi: Rp{(parseFloat(formPrice) * parseInt(formLots, 10) * 100).toLocaleString("id")}
          </div>
        )}

        <button
          onClick={handleAddOrder}
          disabled={submitting || !formTicker || !formPrice || !formLots}
          style={{
            width:      "100%",
            padding:    "7px 0",
            fontSize:   9,
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            border:     "none",
            borderRadius: 3,
            cursor:     submitting ? "not-allowed" : "pointer",
            background: formType === "TP" ? "#00d68f" : "#ff4560",
            color:      "#050a14",
            opacity:    (submitting || !formTicker || !formPrice || !formLots) ? 0.5 : 1,
          }}
        >
          {submitting ? "Memproses..." : `Pasang ${formType}`}
        </button>

        {formMsg && (
          <div style={{
            marginTop:  6,
            padding:    "5px 8px",
            borderRadius: 3,
            fontSize:   9,
            background: formMsg.ok ? "#00d68f11" : "#ff456011",
            color:      formMsg.ok ? "#00d68f" : "#ff4560",
            border:     `1px solid ${formMsg.ok ? "#00d68f33" : "#ff456033"}`,
          }}>
            {formMsg.message}
          </div>
        )}

        {/* Panduan */}
        <div style={{ marginTop: 10, fontSize: 8, color: "#2a4060", lineHeight: 1.6 }}>
          <div>📈 <b style={{ color: "#4a6080" }}>TP</b> — jual otomatis saat harga ≥ target</div>
          <div>🛡️ <b style={{ color: "#4a6080" }}>SL</b> — jual otomatis saat harga ≤ batas</div>
          <div style={{ marginTop: 4 }}>Setelah terpicu, muncul konfirmasi sebelum eksekusi.</div>
        </div>
      </div>

    </div>
  );
}