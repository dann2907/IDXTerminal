// src/components/OrderTriggeredDialog.tsx
//
// Modal dialog yang muncul otomatis saat backend mendeteksi TP/SL terpicu.
//
// BUG FIX:
//   - Sebelumnya: tidak ada cara escape saat dialog stuck (tidak ada X button,
//     tidak ada Escape key, tidak ada overlay click). Jika dismiss gagal (API
//     error), result.ok=false → tidak ada tombol apapun → dialog stuck selamanya.
//   - Sekarang:
//     1. Tombol ✕ selalu tampil di pojok kanan atas (bisa tutup kapan saja)
//     2. Escape key menutup dialog
//     3. Klik backdrop (overlay gelap) menutup dialog
//     4. Dismiss = menutup langsung tanpa menunggu result, karena "abaikan"
//        tidak perlu feedback sukses/gagal yang kompleks — cukup dialog hilang
//        dan order kembali ACTIVE.
//
// Flow:
//   Backend broadcast "order_triggered"
//     → useMarketStore.onmessage → usePortfolioStore.handleWsMessage()
//     → pendingOrderEvent terisi → dialog muncul
//   User klik "Eksekusi" → POST /orders/{id}/confirm → tampilkan hasil → tutup
//   User klik "Abaikan" / ✕ / Escape / backdrop → tutup langsung

import { useEffect, useRef, useState, useCallback } from "react";
import { usePortfolioStore } from "../stores/usePortfolioStore";
import type { OrderTriggeredEvent } from "../stores/usePortfolioStore";

// ── Styles ────────────────────────────────────────────────────────────────

const OVERLAY: React.CSSProperties = {
  position:        "fixed",
  inset:           0,
  zIndex:          9999,
  display:         "flex",
  alignItems:      "center",
  justifyContent:  "center",
  background:      "rgba(0,0,0,0.65)",
  backdropFilter:  "blur(3px)",
  animation:       "fadeIn 0.15s ease",
};

const CARD: React.CSSProperties = {
  position:      "relative",       // untuk tombol ✕ absolute
  background:    "#0f1c2e",
  border:        "1px solid #2e8fdf",
  borderRadius:  "12px",
  padding:       "28px 32px",
  minWidth:      "360px",
  maxWidth:      "440px",
  boxShadow:     "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(46,143,223,0.2)",
  animation:     "slideUp 0.2s ease",
};

const BADGE_TP: React.CSSProperties = {
  display:       "inline-block",
  padding:       "3px 10px",
  borderRadius:  "6px",
  fontSize:      "11px",
  fontWeight:    700,
  letterSpacing: "0.08em",
  background:    "rgba(0,201,138,0.15)",
  color:         "#00c98a",
  border:        "1px solid rgba(0,201,138,0.35)",
};

const BADGE_SL: React.CSSProperties = {
  ...BADGE_TP,
  background: "rgba(232,64,96,0.15)",
  color:      "#e84060",
  border:     "1px solid rgba(232,64,96,0.35)",
};

const ROW: React.CSSProperties = {
  display:        "flex",
  justifyContent: "space-between",
  alignItems:     "center",
  padding:        "6px 0",
  borderBottom:   "1px solid rgba(255,255,255,0.05)",
  fontSize:       "13px",
};

const LABEL: React.CSSProperties = { color: "#8ea4c8" };
const VALUE: React.CSSProperties = { color: "#eff6ff", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 };

const BTN_BASE: React.CSSProperties = {
  flex:          1,
  padding:       "10px 0",
  borderRadius:  "8px",
  border:        "none",
  fontSize:      "14px",
  fontWeight:    700,
  cursor:        "pointer",
  transition:    "opacity 0.15s",
  letterSpacing: "0.04em",
};

// Tombol ✕ — selalu tampil di pojok kanan atas card
const CLOSE_BTN: React.CSSProperties = {
  position:   "absolute",
  top:        "14px",
  right:      "16px",
  background: "rgba(255,255,255,0.06)",
  border:     "1px solid rgba(255,255,255,0.12)",
  borderRadius: "6px",
  color:      "#8ea4c8",
  cursor:     "pointer",
  fontSize:   "15px",
  lineHeight: 1,
  padding:    "4px 8px",
  transition: "all 0.15s",
  zIndex:     1,
};

// ── Component ─────────────────────────────────────────────────────────────

export default function OrderTriggeredDialog() {
  const event        = usePortfolioStore(s => s.pendingOrderEvent);
  const confirmOrder = usePortfolioStore(s => s.confirmOrder);
  const dismissOrder = usePortfolioStore(s => s.dismissOrder);
  const clearPending = usePortfolioStore(s => s.clearPendingOrderEvent);

  const [loading, setLoading] = useState<"confirm" | "dismiss" | null>(null);
  const [result,  setResult]  = useState<{ ok: boolean; message: string } | null>(null);

  // Reset local state setiap kali event baru masuk
  const prevEventId = useRef<string | null>(null);
  useEffect(() => {
    if (event && event.order_id !== prevEventId.current) {
      prevEventId.current = event.order_id;
      setResult(null);
      setLoading(null);
    }
  }, [event]);

  // FIX: Escape key untuk menutup dialog
  const handleClose = useCallback(() => {
    if (loading) return; // Jangan tutup saat sedang proses API
    clearPending();
    setResult(null);
  }, [loading, clearPending]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  if (!event) return null;

  const isTP    = event.order_type === "TP";
  const badge   = isTP ? BADGE_TP : BADGE_SL;
  const icon    = isTP ? "📈" : "🛡️";
  const accentC = isTP ? "#00c98a" : "#e84060";

  const fmt = (n: number) =>
    `Rp${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;

  async function handleConfirm() {
    setLoading("confirm");
    const res = await confirmOrder(event!.order_id, event!.current_price);
    setResult(res);
    setLoading(null);
    // Auto-close setelah konfirmasi berhasil (1.5 detik beri user baca feedback)
    if (res.ok) {
      setTimeout(() => {
        clearPending();
        setResult(null);
      }, 1500);
    }
  }

  // FIX: Dismiss langsung tutup dialog — tidak perlu state result yang rumit.
  // "Abaikan" = user pilih untuk tidak eksekusi sekarang, dialog hilang,
  // order kembali ACTIVE. Tidak ada feedback sukses/gagal yang membingungkan.
  async function handleDismiss() {
    setLoading("dismiss");
    await dismissOrder(event!.order_id);
    // dismissOrder di store sudah set pendingOrderEvent=null
    // Jika gagal pun, kita tetap close agar user tidak stuck
    setLoading(null);
    clearPending();
    setResult(null);
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(12px); opacity:0 } to { transform:translateY(0); opacity:1 } }
        .order-close-btn:hover { background: rgba(255,255,255,0.12) !important; color: #c8d8f0 !important; }
        .order-dismiss-btn:hover { background: rgba(255,255,255,0.1) !important; }
      `}</style>

      {/* Backdrop — klik untuk tutup (FIX) */}
      <div
        style={OVERLAY}
        onClick={handleClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${event.order_type} terpicu untuk ${event.ticker}`}
      >
        {/* Card — stopPropagation agar klik di dalam tidak tutup dialog */}
        <div style={CARD} onClick={e => e.stopPropagation()}>

          {/* Tombol ✕ — SELALU tampil (FIX utama Bug-2) */}
          <button
            className="order-close-btn"
            style={CLOSE_BTN}
            onClick={handleClose}
            disabled={!!loading}
            title="Tutup (Escape)"
            aria-label="Tutup dialog"
          >
            ✕
          </button>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <span style={{ fontSize: "22px" }}>{icon}</span>
            <div>
              <div style={{ color: "#eff6ff", fontWeight: 700, fontSize: "16px" }}>
                Order Terpicu
              </div>
              <div style={{ color: "#8ea4c8", fontSize: "12px", marginTop: "2px" }}>
                Konfirmasi diperlukan sebelum eksekusi
              </div>
            </div>
            <span style={{ ...badge, marginLeft: "auto" }}>{event.order_type}</span>
          </div>

          {/* Detail rows */}
          <div style={{ marginBottom: "20px" }}>
            <div style={ROW}>
              <span style={LABEL}>Ticker</span>
              <span style={{ ...VALUE, color: accentC }}>{event.ticker.replace(".JK", "")}</span>
            </div>
            <div style={ROW}>
              <span style={LABEL}>Kuantitas</span>
              <span style={VALUE}>{event.lots} lot ({event.shares.toLocaleString("id")} lembar)</span>
            </div>
            <div style={ROW}>
              <span style={LABEL}>Harga target</span>
              <span style={VALUE}>{fmt(event.trigger_price)}</span>
            </div>
            <div style={{ ...ROW, borderBottom: "none" }}>
              <span style={LABEL}>Harga sekarang</span>
              <span style={{ ...VALUE, color: accentC }}>{fmt(event.current_price)}</span>
            </div>
          </div>

          {/* Estimasi proceeds */}
          <div style={{
            background:   "rgba(46,143,223,0.08)",
            border:       "1px solid rgba(46,143,223,0.2)",
            borderRadius: "8px",
            padding:      "10px 14px",
            marginBottom: "20px",
            fontSize:     "13px",
            color:        "#8ea4c8",
          }}>
            Estimasi hasil jual:{" "}
            <span style={{ color: "#eff6ff", fontWeight: 700 }}>
              {fmt(event.current_price * event.shares)}
            </span>
          </div>

          {/* Feedback setelah konfirmasi */}
          {result && (
            <div style={{
              padding:      "8px 12px",
              borderRadius: "6px",
              marginBottom: "14px",
              fontSize:     "13px",
              background:   result.ok ? "rgba(0,201,138,0.1)" : "rgba(232,64,96,0.1)",
              color:        result.ok ? "#00c98a" : "#e84060",
              border:       `1px solid ${result.ok ? "rgba(0,201,138,0.3)" : "rgba(232,64,96,0.3)"}`,
            }}>
              {result.message}
            </div>
          )}

          {/* Tombol aksi — tampil saat belum ada result, ATAU saat result error */}
          {(!result || !result.ok) && (
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                style={{
                  ...BTN_BASE,
                  background: accentC,
                  color:      "#0c1520",
                  opacity:    loading ? 0.6 : 1,
                }}
                disabled={!!loading}
                onClick={handleConfirm}
              >
                {loading === "confirm" ? "Memproses..." : "✅ Eksekusi Sekarang"}
              </button>

              {/* Abaikan — langsung tutup, tidak perlu feedback rumit */}
              <button
                className="order-dismiss-btn"
                style={{
                  ...BTN_BASE,
                  background: "rgba(255,255,255,0.06)",
                  color:      "#8ea4c8",
                  border:     "1px solid rgba(255,255,255,0.1)",
                  opacity:    loading ? 0.6 : 1,
                }}
                disabled={!!loading}
                onClick={handleDismiss}
                title="Abaikan — order tetap aktif dan bisa terpicu lagi"
              >
                {loading === "dismiss" ? "..." : "Abaikan"}
              </button>
            </div>
          )}

          {/* Hint Escape untuk user */}
          <div style={{
            textAlign:  "center",
            marginTop:  "12px",
            fontSize:   "11px",
            color:      "#3a506a",
          }}>
            Tekan <kbd style={{
              background: "rgba(255,255,255,0.06)",
              border:     "1px solid rgba(255,255,255,0.12)",
              borderRadius: "3px",
              padding:    "1px 5px",
              fontSize:   "10px",
              fontFamily: "monospace",
            }}>Esc</kbd> atau klik di luar untuk menutup
          </div>

        </div>
      </div>
    </>
  );
}