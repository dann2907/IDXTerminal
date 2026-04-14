// src/components/portfolio/OrdersPanel.tsx
//
// Panel manajemen order TP/SL:
//   - Tabel order aktif (ACTIVE + PENDING_CONFIRM)
//   - Form tambah order baru
//   - Tombol cancel per order dengan inline confirmation
//
// UX Fixes:
//   - Cancel order: inline confirmation (tidak ada accidental delete)
//   - Lot explanation: "1 lot = 100 lembar saham"
//   - Price guidance: tampilkan kisaran harga yang valid
//   - Error message: persist sampai user dismiss
//   - Success: auto-clear setelah 6 detik
//   - Font sizes: min 11px untuk keterbacaan

import { useState, useEffect, useRef } from "react";
import { usePortfolioStore, type PortfolioOrder } from "../../stores/usePortfolioStore";
import { useMarketStore } from "../../stores/useMarketStore";

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width:        "100%",
  background:   "#040d1a",
  border:       "1px solid #0f2040",
  borderRadius: 3,
  color:        "#c8d8f0",
  fontFamily:   "'Space Mono', monospace",
  fontSize:     11,
  padding:      "6px 8px",
  outline:      "none",
  marginBottom: 6,
  boxSizing:    "border-box" as const,
};

const BADGE = (type: "TP" | "SL"): React.CSSProperties => ({
  display:      "inline-block",
  padding:      "2px 7px",
  borderRadius: 3,
  fontSize:     10,
  fontWeight:   700,
  background:   type === "TP" ? "rgba(0,214,143,0.15)" : "rgba(255,69,96,0.15)",
  color:        type === "TP" ? "#00d68f" : "#ff4560",
  border:       `1px solid ${type === "TP" ? "rgba(0,214,143,0.3)" : "rgba(255,69,96,0.3)"}`,
});

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:          "#4a6080",
  PENDING_CONFIRM: "#f59e0b",
  EXECUTED:        "#00d68f",
  CANCELLED:       "#2a4060",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:          "Aktif",
  PENDING_CONFIRM: "⚡ Menunggu Konfirmasi",
  EXECUTED:        "✅ Terlaksana",
  CANCELLED:       "Dibatalkan",
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

  // Cancel confirmation state: orderId yang sedang menunggu konfirmasi
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling]           = useState(false);

  // Filter state
  const [filterStatus, setFilterStatus] = useState<"active" | "all">("active");

  // Auto-clear success message setelah 6 detik; error tetap sampai dismiss
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (formMsg?.ok) {
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
      msgTimerRef.current = setTimeout(() => setFormMsg(null), 6000);
    }
    return () => { if (msgTimerRef.current) clearTimeout(msgTimerRef.current); };
  }, [formMsg]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = filterStatus === "active"
    ? orders.filter(o => o.status === "ACTIVE" || o.status === "PENDING_CONFIRM")
    : orders;

  // Holding yang dipilih di form
  const selectedHolding = holdings.find(h => h.ticker === formTicker);
  const currentQuote = quotes[formTicker];

  // Harga saran: TP harus di atas avg_cost, SL di bawah
  const avgCost = selectedHolding?.avg_cost ?? 0;
  const priceHint = formType === "TP"
    ? avgCost > 0 ? `Harus > ${fmtPrice(avgCost)} (avg cost)` : null
    : avgCost > 0 ? `Harus < ${fmtPrice(avgCost)} (avg cost)` : null;

  // Validasi harga sebelum submit
  const priceNum  = parseFloat(formPrice);
  const priceValid = !formPrice || !avgCost
    ? true
    : formType === "TP" ? priceNum > avgCost : priceNum < avgCost;

  // Estimasi nilai order
  const estimatedValue = formPrice && formLots
    ? parseFloat(formPrice) * parseInt(formLots, 10) * 100
    : null;

  const handleAddOrder = async () => {
    const price = parseFloat(formPrice);
    const lots  = parseInt(formLots, 10);
    if (!formTicker || !price || !lots) return;

    setSubmitting(true);
    const res = await addOrder(formTicker, formType, price, lots);
    setFormMsg(res);
    if (res.ok) {
      setFormPrice("");
      setFormLots("");
    }
    setSubmitting(false);
  };

  const handleCancelClick = (orderId: string) => {
    // Tampilkan inline confirmation
    setPendingCancelId(orderId);
  };

  const handleCancelConfirm = async () => {
    if (!pendingCancelId) return;
    setCancelling(true);
    await cancelOrder(pendingCancelId);
    setPendingCancelId(null);
    setCancelling(false);
  };

  const handleCancelAbort = () => {
    setPendingCancelId(null);
  };

  return (
    <div style={{ display: "flex", gap: 12, height: "100%", overflow: "hidden" }}>

      {/* ── Kiri: Tabel order ── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Filter bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#4a6080", letterSpacing: 1, fontFamily: "'Syne', sans-serif" }}>
            TAMPILKAN
          </span>
          {(["active", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)} style={{
              padding:    "4px 12px",
              fontSize:   11,
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
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#4a6080" }}>
            {filteredOrders.length} order
          </span>
        </div>

        {/* Tabel */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ color: "#4a6080", borderBottom: "1px solid #0f2040" }}>
              {["Ticker", "Tipe", "Harga Trigger", "Lot", "Status", "Dibuat", ""].map(h => (
                <th key={h} style={{
                  textAlign: "left", padding: "5px 8px",
                  fontWeight: 400, fontSize: 10, letterSpacing: 1,
                  fontFamily: "'Syne', sans-serif",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => {
              const isCancelPending = pendingCancelId === order.order_id;
              const canCancel = order.status === "ACTIVE" || order.status === "PENDING_CONFIRM";
              return (
                <tr key={order.order_id} style={{ borderBottom: "1px solid #0a1830" }}>
                  <td style={{ padding: "7px 8px", color: "#8aa8cc", fontWeight: 700 }}>
                    {order.ticker.replace(".JK", "")}
                  </td>
                  <td style={{ padding: "7px 8px" }}>
                    <span style={BADGE(order.order_type)}>{order.order_type}</span>
                  </td>
                  <td style={{ padding: "7px 8px", color: "#c8d8f0", fontFamily: "'Space Mono', monospace" }}>
                    {fmtPrice(order.trigger_price)}
                    {quotes[order.ticker] && (
                      <span style={{ color: "#4a6080", marginLeft: 4, fontSize: 10 }}>
                        / saat ini: {fmtPrice(quotes[order.ticker].price)}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "7px 8px", color: "#c8d8f0" }}>
                    {order.lots} lot
                    <span style={{ color: "#4a6080", fontSize: 10, marginLeft: 3 }}>
                      ({(order.lots * 100).toLocaleString()} lbr)
                    </span>
                  </td>
                  <td style={{ padding: "7px 8px" }}>
                    <span style={{ fontSize: 10, color: STATUS_COLOR[order.status] ?? "#4a6080" }}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </td>
                  <td style={{ padding: "7px 8px", color: "#4a6080", fontSize: 10 }}>
                    {fmtDate(order.created_at)}
                  </td>
                  <td style={{ padding: "7px 8px", minWidth: 150 }}>
                    {canCancel && !isCancelPending && (
                      <button onClick={() => handleCancelClick(order.order_id)} style={{
                        padding:    "3px 10px",
                        fontSize:   10,
                        fontFamily: "'Syne', sans-serif",
                        background: "rgba(255,69,96,0.08)",
                        color:      "#ff4560",
                        border:     "1px solid rgba(255,69,96,0.25)",
                        borderRadius: 3,
                        cursor:     "pointer",
                      }}>
                        Batalkan
                      </button>
                    )}

                    {/* Inline confirmation — no accidental delete */}
                    {canCancel && isCancelPending && (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: "#f59e0b", marginRight: 2 }}>Yakin?</span>
                        <button onClick={handleCancelConfirm} disabled={cancelling} style={{
                          padding:    "2px 8px",
                          fontSize:   10,
                          fontFamily: "'Syne', sans-serif",
                          background: "rgba(255,69,96,0.15)",
                          color:      "#ff4560",
                          border:     "1px solid rgba(255,69,96,0.4)",
                          borderRadius: 3,
                          cursor:     cancelling ? "not-allowed" : "pointer",
                          opacity:    cancelling ? 0.6 : 1,
                        }}>
                          {cancelling ? "..." : "Ya, Batalkan"}
                        </button>
                        <button onClick={handleCancelAbort} disabled={cancelling} style={{
                          padding:    "2px 8px",
                          fontSize:   10,
                          fontFamily: "'Syne', sans-serif",
                          background: "transparent",
                          color:      "#4a6080",
                          border:     "1px solid #0f2040",
                          borderRadius: 3,
                          cursor:     "pointer",
                        }}>
                          Tidak
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!filteredOrders.length && (
              <tr>
                <td colSpan={7} style={{ padding: "24px 8px", color: "#4a6080", textAlign: "center", fontSize: 11 }}>
                  {filterStatus === "active"
                    ? "Belum ada order aktif — pasang TP atau SL di panel kanan"
                    : "Belum ada riwayat order"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Kanan: Form tambah order ── */}
      <div style={{
        width:       240,
        flexShrink:  0,
        background:  "#070d1c",
        border:      "1px solid #0f2040",
        borderRadius: 6,
        padding:     14,
        alignSelf:   "flex-start",
      }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, letterSpacing: 1, color: "#4a6080", marginBottom: 12 }}>
          PASANG ORDER BARU
        </div>

        {/* Tipe TP/SL */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {(["TP", "SL"] as const).map(t => (
            <button key={t} onClick={() => setFormType(t)} style={{
              flex:       1,
              padding:    "7px 0",
              fontSize:   11,
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

        {/* Penjelasan singkat */}
        <div style={{
          background:   formType === "TP" ? "rgba(0,214,143,0.05)" : "rgba(255,69,96,0.05)",
          border:       `1px solid ${formType === "TP" ? "rgba(0,214,143,0.15)" : "rgba(255,69,96,0.15)"}`,
          borderRadius: 3,
          padding:      "6px 8px",
          fontSize:     10,
          color:        "#4a6080",
          marginBottom: 10,
          lineHeight:   1.5,
        }}>
          {formType === "TP"
            ? "📈 Take Profit: jual otomatis saat harga naik ke target."
            : "🛡️ Stop Loss: jual otomatis saat harga turun ke batas."}
        </div>

        {/* Ticker dari holdings */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: "#4a6080", marginBottom: 4, fontFamily: "'Syne', sans-serif" }}>
            PILIH SAHAM
          </div>
          <select
            value={formTicker}
            onChange={e => { setFormTicker(e.target.value); setFormPrice(""); }}
            style={{ ...INPUT, marginBottom: 0, cursor: "pointer" }}
          >
            <option value="">Pilih saham dari holdings...</option>
            {holdings.map(h => (
              <option key={h.ticker} value={h.ticker}>
                {h.ticker.replace(".JK", "")} · avg {fmtPrice(h.avg_cost)}
              </option>
            ))}
          </select>
          {holdings.length === 0 && (
            <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 4 }}>
              ⚠️ Belum punya holdings — beli saham dulu
            </div>
          )}
        </div>

        {/* Info konteks harga */}
        {formTicker && selectedHolding && (
          <div style={{
            background:   "#040d1a",
            border:       "1px solid #0f2040",
            borderRadius: 3,
            padding:      "7px 8px",
            fontSize:     10,
            color:        "#4a6080",
            marginBottom: 8,
            lineHeight:   1.6,
          }}>
            <div>Avg cost: <span style={{ color: "#c8d8f0", fontFamily: "'Space Mono', monospace" }}>{fmtPrice(selectedHolding.avg_cost)}</span></div>
            {currentQuote && (
              <div>
                Harga sekarang:{" "}
                <span style={{
                  color:      currentQuote.change_pct >= 0 ? "#00d68f" : "#ff4560",
                  fontFamily: "'Space Mono', monospace",
                }}>
                  {fmtPrice(currentQuote.price)}
                </span>
                <span style={{ marginLeft: 4 }}>
                  ({currentQuote.change_pct >= 0 ? "+" : ""}{currentQuote.change_pct.toFixed(2)}%)
                </span>
              </div>
            )}
            <div>Kepemilikan: <span style={{ color: "#c8d8f0" }}>{selectedHolding.lots ?? Math.floor(selectedHolding.shares / 100)} lot</span></div>
          </div>
        )}

        {/* Harga Trigger */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: "#4a6080", marginBottom: 4, fontFamily: "'Syne', sans-serif" }}>
            HARGA TRIGGER (RP)
          </div>
          <input
            type="number"
            placeholder={
              formType === "TP"
                ? avgCost ? `Di atas ${fmtPrice(avgCost)}` : "Harga jual target"
                : avgCost ? `Di bawah ${fmtPrice(avgCost)}` : "Harga cut-loss"
            }
            value={formPrice}
            onChange={e => setFormPrice(e.target.value)}
            style={{
              ...INPUT,
              borderColor: formPrice && !priceValid ? "#ff4560" : "#0f2040",
            }}
          />
          {/* Price hint dengan warna sesuai validitas */}
          {priceHint && (
            <div style={{
              fontSize:  10,
              color:     formPrice && !priceValid ? "#ff4560" : "#4a6080",
              marginTop: -4,
              marginBottom: 6,
            }}>
              {formPrice && !priceValid ? "⚠️ " : "💡 "}{priceHint}
            </div>
          )}
        </div>

        {/* Jumlah Lot */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "#4a6080", fontFamily: "'Syne', sans-serif" }}>JUMLAH LOT</span>
            {/* Tooltip penjelasan lot */}
            <span style={{ fontSize: 10, color: "#2e8fdf" }}>1 lot = 100 lembar</span>
          </div>
          <input
            type="number"
            placeholder="Jumlah lot (mis. 5)"
            min={1}
            value={formLots}
            onChange={e => setFormLots(e.target.value)}
            style={INPUT}
          />
        </div>

        {/* Estimasi nilai */}
        {estimatedValue !== null && (
          <div style={{
            background:   "#040d1a",
            border:       "1px solid #0f2040",
            borderRadius: 3,
            padding:      "6px 8px",
            fontSize:     10,
            color:        "#4a6080",
            marginBottom: 10,
          }}>
            Estimasi nilai:{" "}
            <span style={{ color: "#c8d8f0", fontFamily: "'Space Mono', monospace" }}>
              Rp{estimatedValue.toLocaleString("id")}
            </span>
            <span style={{ color: "#2a4060", marginLeft: 4 }}>
              ({formLots} lot × 100 × {fmtPrice(parseFloat(formPrice))})
            </span>
          </div>
        )}

        <button
          onClick={handleAddOrder}
          disabled={submitting || !formTicker || !formPrice || !formLots || !priceValid}
          style={{
            width:      "100%",
            padding:    "9px 0",
            fontSize:   11,
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            border:     "none",
            borderRadius: 3,
            cursor:     (submitting || !formTicker || !formPrice || !formLots || !priceValid)
              ? "not-allowed" : "pointer",
            background: formType === "TP" ? "#00d68f" : "#ff4560",
            color:      "#050a14",
            opacity:    (submitting || !formTicker || !formPrice || !formLots || !priceValid) ? 0.5 : 1,
          }}
        >
          {submitting ? "Memproses..." : `Pasang ${formType}`}
        </button>

        {/* Feedback message — error persist, success auto-clear */}
        {formMsg && (
          <div style={{
            marginTop:  8,
            padding:    "7px 10px",
            borderRadius: 3,
            fontSize:   11,
            background: formMsg.ok ? "#00d68f11" : "#ff456011",
            color:      formMsg.ok ? "#00d68f" : "#ff4560",
            border:     `1px solid ${formMsg.ok ? "#00d68f33" : "#ff456033"}`,
            display:    "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap:        6,
          }}>
            <span style={{ flex: 1 }}>{formMsg.message}</span>
            {/* Error harus dismiss manual */}
            {!formMsg.ok && (
              <button
                onClick={() => setFormMsg(null)}
                style={{
                  background: "transparent", border: "none",
                  color: "#ff4560", cursor: "pointer",
                  fontSize: 12, padding: "0 2px", flexShrink: 0,
                }}
              >✕</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}