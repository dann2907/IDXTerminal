// src/components/TradeConfirmDialog.tsx
//
// Modal konfirmasi sebelum eksekusi manual BUY / SELL dari Quick Trade.
//
// Menampilkan:
//   BUY  → estimasi total, saldo kas sesudah, info modal
//   SELL → estimasi P&L (untung/rugi vs avg cost), lot tersedia vs terkunci
//
// Lock info diambil dari endpoint GET /api/portfolio/sell-availability/{ticker}
// yang baru ditambahkan di portfolio_service.py (Fix Masalah 1).
//
// UX considerations (designed for "user awam"):
//   - Warna hijau = untung / cukup; merah = rugi / kurang
//   - Semua angka dalam format Rupiah Indonesia
//   - Jika ada lot terkunci, tampilkan peringatan kuning yang jelas
//   - Tombol konfirmasi disabled jika lot diminta > available (untuk SELL)
//   - Escape + klik backdrop untuk tutup
//   - Loading state saat mengambil sell availability data

import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TradeConfirmPayload {
  action: "BUY" | "SELL";
  ticker: string;
  lots: number;
  price: number;
  /** hanya untuk SELL — avg cost dari holdings */
  avgCost?: number;
  /** kas saat ini — untuk BUY */
  currentCash?: number;
}

interface SellAvailability {
  ticker: string;
  total_lots: number;
  locked_lots: number;
  available_lots: number;
  locked_by_tp: number;
  locked_by_sl: number;
  avg_cost: number;
  current_price: number;
  pnl_pct: number;
  active_orders: { order_id: string; order_type: string; trigger_price: number; lots: number; status: string }[];
}

interface Props {
  payload: TradeConfirmPayload | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const fmtRp = (v: number) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}Rp${(abs / 1_000_000_000).toFixed(2)}M`;
  if (abs >= 1_000_000)     return `${sign}Rp${(abs / 1_000_000).toFixed(2)}Jt`;
  return `${sign}Rp${abs.toLocaleString("id")}`;
};

const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

const API = "http://127.0.0.1:8765";

// ── Styles ─────────────────────────────────────────────────────────────────

const C = {
  bg:      "#0a1628",
  card:    "#0f1e35",
  border:  "#1a3050",
  muted:   "#2a4060",
  label:   "#4a6080",
  text:    "#c8d8f0",
  up:      "#00d68f",
  dn:      "#ff4560",
  accent:  "#2e8fdf",
  warn:    "#f59e0b",
};

// ── Component ──────────────────────────────────────────────────────────────

export default function TradeConfirmDialog({ payload, onConfirm, onCancel }: Props) {
  const [loading,      setLoading]      = useState(false);
  const [confirming,   setConfirming]   = useState(false);
  const [sellInfo,     setSellInfo]     = useState<SellAvailability | null>(null);
  const [fetchError,   setFetchError]   = useState<string | null>(null);
  const prevTicker = useRef<string | null>(null);

  // Fetch sell availability saat SELL dialog dibuka
  useEffect(() => {
    if (!payload || payload.action !== "SELL") {
      setSellInfo(null);
      setFetchError(null);
      return;
    }
    // Jangan re-fetch jika ticker sama
    if (prevTicker.current === payload.ticker && sellInfo) return;
    prevTicker.current = payload.ticker;

    setLoading(true);
    setFetchError(null);
    fetch(`${API}/api/portfolio/sell-availability/${payload.ticker}`)
      .then(r => r.json())
      .then((d: SellAvailability) => { setSellInfo(d); setLoading(false); })
      .catch(() => { setFetchError("Gagal memuat info saham"); setLoading(false); });
  }, [payload]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset saat dialog ditutup
  useEffect(() => {
    if (!payload) {
      setSellInfo(null);
      setFetchError(null);
      setConfirming(false);
      prevTicker.current = null;
    }
  }, [payload]);

  // Escape key
  const handleClose = useCallback(() => {
    if (confirming) return;
    onCancel();
  }, [confirming, onCancel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClose]);

  if (!payload) return null;

  const { action, ticker, lots, price, currentCash } = payload;
  const sym     = ticker.replace(".JK", "");
  const shares  = lots * 100;
  const total   = shares * price;
  const isBuy   = action === "BUY";

  // BUY calculations
  const cashAfter   = (currentCash ?? 0) - total;
  const cashOk      = isBuy ? cashAfter >= 0 : true;

  // SELL calculations
  const avgCost     = sellInfo?.avg_cost ?? payload.avgCost ?? price;
  const pnlRp       = (price - avgCost) * shares;
  const pnlPct      = avgCost > 0 ? ((price - avgCost) / avgCost) * 100 : 0;
  const availLots   = sellInfo?.available_lots ?? lots;
  const lockedLots  = sellInfo?.locked_lots ?? 0;
  const sellBlocked = !isBuy && lots > availLots;

  const canConfirm  = !confirming && !loading && (isBuy ? cashOk : !sellBlocked);

  async function handleConfirm() {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  }

  const accentColor = isBuy ? C.up : C.dn;

  return (
    <>
      <style>{`
        @keyframes cfadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes cslideUp { from{transform:translateY(10px);opacity:0} to{transform:translateY(0);opacity:1} }
        .tcd-overlay { animation: cfadeIn 0.15s ease; }
        .tcd-card    { animation: cslideUp 0.18s ease; }
        .tcd-confirm:hover:not(:disabled) { filter: brightness(1.1); }
        .tcd-cancel:hover:not(:disabled)  { background: rgba(255,255,255,0.08) !important; }
        .tcd-close:hover { color: #c8d8f0 !important; background: rgba(255,255,255,0.1) !important; }
      `}</style>

      {/* Backdrop */}
      <div
        className="tcd-overlay"
        onClick={handleClose}
        style={{
          position:       "fixed",
          inset:          0,
          zIndex:         9998,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          background:     "rgba(0,0,0,0.7)",
          backdropFilter: "blur(4px)",
        }}
      >
        {/* Card */}
        <div
          className="tcd-card"
          onClick={e => e.stopPropagation()}
          style={{
            position:     "relative",
            background:   C.card,
            border:       `1px solid ${accentColor}55`,
            borderRadius: 12,
            padding:      "24px 28px",
            width:        360,
            boxShadow:    `0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px ${accentColor}22`,
          }}
        >
          {/* Close button */}
          <button
            className="tcd-close"
            onClick={handleClose}
            disabled={confirming}
            style={{
              position:   "absolute",
              top:        12,
              right:      14,
              background: "rgba(255,255,255,0.05)",
              border:     "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              color:      C.label,
              cursor:     "pointer",
              fontSize:   14,
              lineHeight: 1,
              padding:    "4px 7px",
              transition: "all 0.15s",
            }}
            title="Tutup (Esc)"
          >✕</button>

          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>{isBuy ? "🛒" : "💸"}</span>
              <div style={{
                fontFamily:    "'Syne', sans-serif",
                fontSize:      16,
                fontWeight:    800,
                color:         C.text,
                letterSpacing: 1,
              }}>
                Konfirmasi {action}
              </div>
              <span style={{
                marginLeft:    "auto",
                background:    `${accentColor}22`,
                border:        `1px solid ${accentColor}55`,
                borderRadius:  4,
                color:         accentColor,
                fontSize:      11,
                fontWeight:    700,
                padding:       "2px 9px",
                fontFamily:    "'Syne', sans-serif",
                letterSpacing: 1,
              }}>
                {action}
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.label }}>
              Periksa detail transaksi sebelum melanjutkan
            </div>
          </div>

          {/* Detail rows */}
          <div style={{
            background:   C.bg,
            border:       `1px solid ${C.border}`,
            borderRadius: 8,
            padding:      "12px 14px",
            marginBottom: 14,
          }}>
            <Row label="Saham">
              <span style={{ color: accentColor, fontWeight: 700, fontFamily: "'Space Mono', monospace", fontSize: 13 }}>
                {sym}
              </span>
            </Row>
            <Row label="Jumlah">
              <span style={{ color: C.text, fontFamily: "'Space Mono', monospace" }}>
                {lots} lot
                <span style={{ color: C.label, fontSize: 11, marginLeft: 6 }}>
                  ({shares.toLocaleString("id")} lembar)
                </span>
              </span>
            </Row>
            <Row label="Harga per lembar">
              <span style={{ color: C.text, fontFamily: "'Space Mono', monospace" }}>
                {fmtRp(price)}
              </span>
            </Row>
            <Row label="Total transaksi" last>
              <span style={{
                color:      accentColor,
                fontWeight: 700,
                fontFamily: "'Space Mono', monospace",
                fontSize:   14,
              }}>
                {fmtRp(total)}
              </span>
            </Row>
          </div>

          {/* BUY: info saldo */}
          {isBuy && (
            <div style={{
              background:   cashOk ? "rgba(0,214,143,0.06)" : "rgba(255,69,96,0.08)",
              border:       `1px solid ${cashOk ? C.up + "33" : C.dn + "55"}`,
              borderRadius: 8,
              padding:      "10px 14px",
              marginBottom: 14,
              fontSize:     12,
            }}>
              {cashOk ? (
                <>
                  <div style={{ color: C.label, marginBottom: 4 }}>Saldo kas setelah beli</div>
                  <div style={{ color: C.up, fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>
                    {fmtRp(cashAfter)}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color: C.dn, fontWeight: 700, marginBottom: 2 }}>
                    ⚠️ Dana tidak cukup
                  </div>
                  <div style={{ color: C.label }}>
                    Butuh {fmtRp(total)}, saldo {fmtRp(currentCash ?? 0)}
                  </div>
                </>
              )}
            </div>
          )}

          {/* SELL: info P&L + lock */}
          {!isBuy && (
            <>
              {loading && (
                <div style={{
                  background:   C.bg,
                  border:       `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding:      "12px 14px",
                  marginBottom: 14,
                  color:        C.label,
                  fontSize:     12,
                  display:      "flex",
                  alignItems:   "center",
                  gap:          8,
                }}>
                  <span style={{ color: C.accent }}>⟳</span> Memuat info saham...
                </div>
              )}

              {fetchError && (
                <div style={{
                  background:   "rgba(255,69,96,0.08)",
                  border:       `1px solid ${C.dn}33`,
                  borderRadius: 8,
                  padding:      "10px 14px",
                  marginBottom: 14,
                  fontSize:     12,
                  color:        C.dn,
                }}>
                  {fetchError}
                </div>
              )}

              {sellInfo && !loading && (
                <>
                  {/* P&L estimasi */}
                  <div style={{
                    background:   pnlRp >= 0 ? "rgba(0,214,143,0.06)" : "rgba(255,69,96,0.08)",
                    border:       `1px solid ${pnlRp >= 0 ? C.up + "33" : C.dn + "44"}`,
                    borderRadius: 8,
                    padding:      "10px 14px",
                    marginBottom: 10,
                    fontSize:     12,
                  }}>
                    <div style={{ color: C.label, marginBottom: 4 }}>
                      Estimasi P&amp;L dari penjualan ini
                    </div>
                    <div style={{
                      display:    "flex",
                      alignItems: "baseline",
                      gap:        8,
                    }}>
                      <span style={{
                        color:      pnlRp >= 0 ? C.up : C.dn,
                        fontWeight: 700,
                        fontFamily: "'Space Mono', monospace",
                        fontSize:   15,
                      }}>
                        {pnlRp >= 0 ? "+" : ""}{fmtRp(pnlRp)}
                      </span>
                      <span style={{
                        color:    pnlRp >= 0 ? C.up : C.dn,
                        fontSize: 11,
                        fontFamily: "'Space Mono', monospace",
                      }}>
                        ({fmtPct(pnlPct)})
                      </span>
                    </div>
                    <div style={{ color: C.label, fontSize: 10, marginTop: 4 }}>
                      Avg cost {fmtRp(avgCost)} → jual {fmtRp(price)}
                    </div>
                  </div>

                  {/* Peringatan lock jika ada */}
                  {lockedLots > 0 && (
                    <div style={{
                      background:   "rgba(245,158,11,0.08)",
                      border:       `1px solid ${C.warn}44`,
                      borderRadius: 8,
                      padding:      "10px 14px",
                      marginBottom: 10,
                      fontSize:     12,
                    }}>
                      <div style={{ color: C.warn, fontWeight: 700, marginBottom: 4 }}>
                        ⚠️ {lockedLots} lot sedang terkunci order TP/SL
                      </div>
                      <div style={{ color: C.label, lineHeight: 1.5 }}>
                        Tersedia untuk dijual: <strong style={{ color: C.text }}>{availLots} lot</strong>
                        {sellInfo.locked_by_tp > 0 && ` · TP: ${sellInfo.locked_by_tp} lot`}
                        {sellInfo.locked_by_sl > 0 && ` · SL: ${sellInfo.locked_by_sl} lot`}
                      </div>
                      {lots > availLots && (
                        <div style={{ color: C.dn, marginTop: 6, fontWeight: 600 }}>
                          Kamu meminta {lots} lot, tapi hanya {availLots} lot yang bisa dijual.
                          Kurangi jumlah atau cancel order TP/SL terlebih dahulu.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Tombol aksi */}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              className="tcd-cancel"
              onClick={handleClose}
              disabled={confirming}
              style={{
                flex:         1,
                padding:      "10px 0",
                borderRadius: 8,
                border:       `1px solid ${C.border}`,
                background:   "rgba(255,255,255,0.04)",
                color:        C.label,
                fontSize:     13,
                fontWeight:   700,
                fontFamily:   "'Syne', sans-serif",
                cursor:       confirming ? "not-allowed" : "pointer",
                transition:   "all 0.15s",
                opacity:      confirming ? 0.5 : 1,
              }}
            >
              Batal
            </button>
            <button
              className="tcd-confirm"
              onClick={handleConfirm}
              disabled={!canConfirm}
              title={
                !cashOk      ? "Dana tidak cukup" :
                sellBlocked  ? `Hanya ${availLots} lot tersedia` :
                undefined
              }
              style={{
                flex:         2,
                padding:      "10px 0",
                borderRadius: 8,
                border:       "none",
                background:   canConfirm ? accentColor : C.muted,
                color:        canConfirm ? "#050a14" : C.label,
                fontSize:     13,
                fontWeight:   700,
                fontFamily:   "'Syne', sans-serif",
                cursor:       canConfirm ? "pointer" : "not-allowed",
                transition:   "all 0.15s",
                letterSpacing: 1,
              }}
            >
              {confirming
                ? "Memproses..."
                : isBuy
                  ? `✅ Beli ${lots} lot ${sym}`
                  : `✅ Jual ${lots} lot ${sym}`}
            </button>
          </div>

          {/* Escape hint */}
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 10, color: C.muted }}>
            Tekan <kbd style={{
              background:   "rgba(255,255,255,0.06)",
              border:       "1px solid rgba(255,255,255,0.12)",
              borderRadius: 3,
              padding:      "1px 5px",
              fontSize:     9,
              fontFamily:   "monospace",
            }}>Esc</kbd> atau klik di luar untuk batal
          </div>

        </div>
      </div>
    </>
  );
}

// ── Row helper ─────────────────────────────────────────────────────────────

function Row({ label, children, last = false }: {
  label: string; children: React.ReactNode; last?: boolean;
}) {
  return (
    <div style={{
      display:       "flex",
      justifyContent: "space-between",
      alignItems:    "center",
      padding:       "5px 0",
      borderBottom:  last ? "none" : "1px solid rgba(255,255,255,0.04)",
      fontSize:      12,
    }}>
      <span style={{ color: "#4a6080" }}>{label}</span>
      {children}
    </div>
  );
}