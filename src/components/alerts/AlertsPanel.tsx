// src/components/alerts/AlertsPanel.tsx
//
// Panel price alerts — pasang, lihat, hapus.
// Toast notification muncul saat alert terpicu (via WS).
//
// UX Fixes:
//   - Export section dihapus (dipindah ke TradeHistory panel)
//   - Threshold unit label lebih jelas dengan badge satuan
//   - Font sizes minimum 11px
//   - Error message persist; success auto-clear 6s
//   - Empty state lebih informatif

import { useState, useEffect, useRef } from "react";
import { useAlertStore, type PriceAlert } from "../../stores/useAlertStore";
import { useMarketStore } from "../../stores/useMarketStore";

const C = {
  bg:      "#070d1c",
  surface: "#0a1222",
  border:  "#0f2040",
  muted:   "#2a4060",
  label:   "#4a6080",
  text:    "#c8d8f0",
  up:      "#00d68f",
  dn:      "#ff4560",
  accent:  "#2e8fdf",
  warn:    "#f59e0b",
};

const INPUT: React.CSSProperties = {
  background:   "#040d1a",
  border:       `1px solid ${C.border}`,
  borderRadius: 3,
  color:        C.text,
  fontFamily:   "'Space Mono', monospace",
  fontSize:     11,
  padding:      "5px 8px",
  outline:      "none",
  width:        "100%",
  boxSizing:    "border-box" as const,
};

const CONDITION_LABELS: Record<string, string> = {
  above:        "Harga naik ke ≥",
  below:        "Harga turun ke ≤",
  change_pct:   "Perubahan harga ≥",
  volume_spike: "Volume ≥",
};

const CONDITION_UNITS: Record<string, string> = {
  above:        "Rp",
  below:        "Rp",
  change_pct:   "%",
  volume_spike: "lembar",
};

const CONDITION_PLACEHOLDER: Record<string, string> = {
  above:        "mis. 10000",
  below:        "mis. 7500",
  change_pct:   "mis. 5 (untuk ±5%)",
  volume_spike: "mis. 1000000",
};

const CONDITION_COLORS: Record<string, string> = {
  above:        C.up,
  below:        C.dn,
  change_pct:   C.warn,
  volume_spike: C.accent,
};

export default function AlertsPanel() {
  const { alerts, toasts, loading, fetchAlerts, createAlert, deleteAlert, dismissToast } =
    useAlertStore();
  const quotes = useMarketStore(s => s.quotes);

  const [ticker,     setTicker]     = useState("");
  const [condition,  setCondition]  = useState("above");
  const [threshold,  setThreshold]  = useState("");
  const [note,       setNote]       = useState("");
  const [msg,        setMsg]        = useState<{ ok: boolean; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filter,     setFilter]     = useState<"all" | "active">("active");

  // Auto-clear success setelah 6s; error persist
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (msg?.ok) {
      if (msgTimer.current) clearTimeout(msgTimer.current);
      msgTimer.current = setTimeout(() => setMsg(null), 6000);
    }
    return () => { if (msgTimer.current) clearTimeout(msgTimer.current); };
  }, [msg]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const displayedAlerts = filter === "active"
    ? alerts.filter(a => a.is_active)
    : alerts;

  // Normalisasi ticker untuk lookup quote
  const normalizedTicker = ticker.toUpperCase().endsWith(".JK")
    ? ticker.toUpperCase()
    : `${ticker.toUpperCase()}.JK`;
  const currentPrice = quotes[normalizedTicker]?.price;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const thr = parseFloat(threshold);
    if (!ticker.trim()) {
      setMsg({ ok: false, text: "Masukkan kode saham (mis. BBCA)" });
      return;
    }
    if (isNaN(thr) || thr <= 0) {
      setMsg({ ok: false, text: "Threshold harus angka positif." });
      return;
    }
    setSubmitting(true);
    const res = await createAlert(ticker, condition, thr, note);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      setTicker("");
      setThreshold("");
      setNote("");
    }
    setSubmitting(false);
  }

  const unit       = CONDITION_UNITS[condition] ?? "";
  const accentColor = CONDITION_COLORS[condition] ?? C.accent;

  return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      height:         "100%",
      background:     C.bg,
      overflow:       "hidden",
    }}>

      {/* ── Toast notifications ──────────────────────────────────── */}
      {toasts.length > 0 && (
        <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          {toasts.map(t => (
            <div key={t.id} style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              padding:        "10px 14px",
              borderRadius:   5,
              gap:            8,
              background:     "rgba(245,158,11,0.12)",
              border:         `1px solid ${C.warn}44`,
              animation:      "slideDown 0.2s ease",
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ color: C.warn, fontWeight: 700, marginRight: 8, fontSize: 12 }}>
                  🔔 {t.ticker.replace(".JK", "")}
                </span>
                <span style={{ fontSize: 11, color: C.text }}>{t.message}</span>
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                title="Tutup notifikasi"
                style={{
                  background: "transparent",
                  border:     "none",
                  color:      C.muted,
                  cursor:     "pointer",
                  fontSize:   14,
                  padding:    "0 4px",
                  flexShrink: 0,
                }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Main area: form kiri + list kanan ─────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Form pasang alert ─────────────────────────────────── */}
        <div style={{
          width:      230,
          flexShrink: 0,
          borderRight: `1px solid ${C.border}`,
          padding:    14,
          overflowY:  "auto",
        }}>
          <div style={{
            fontFamily: "'Syne', sans-serif",
            fontSize:   11,
            letterSpacing: 1,
            color:      C.label,
            marginBottom: 12,
          }}>
            PASANG ALERT HARGA
          </div>

          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Ticker */}
            <div>
              <div style={{ fontSize: 10, color: C.label, fontFamily: "'Syne', sans-serif", letterSpacing: 1, marginBottom: 4 }}>
                KODE SAHAM
              </div>
              <input
                placeholder="mis. BBCA atau GOTO"
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                style={INPUT}
                required
              />
              {/* Tampilkan harga saat ini jika ticker dikenal */}
              {currentPrice ? (
                <div style={{ fontSize: 10, color: C.label, marginTop: 4 }}>
                  Harga sekarang:{" "}
                  <span style={{ color: C.text, fontFamily: "'Space Mono', monospace" }}>
                    Rp{currentPrice.toLocaleString("id")}
                  </span>
                </div>
              ) : ticker.length >= 2 ? (
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                  Harga belum tersedia (pastikan ticker benar)
                </div>
              ) : null}
            </div>

            {/* Kondisi */}
            <div>
              <div style={{ fontSize: 10, color: C.label, fontFamily: "'Syne', sans-serif", letterSpacing: 1, marginBottom: 4 }}>
                KONDISI ALERT
              </div>
              <select
                value={condition}
                onChange={e => { setCondition(e.target.value); setThreshold(""); }}
                style={{ ...INPUT, cursor: "pointer" }}
              >
                {Object.entries(CONDITION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* Threshold dengan unit badge */}
            <div>
              <div style={{ fontSize: 10, color: C.label, fontFamily: "'Syne', sans-serif", letterSpacing: 1, marginBottom: 4 }}>
                BATAS NILAI
              </div>
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder={CONDITION_PLACEHOLDER[condition] ?? "0"}
                  value={threshold}
                  onChange={e => setThreshold(e.target.value)}
                  style={{ ...INPUT, flex: 1, paddingRight: unit.length > 2 ? 12 : 8 }}
                  required
                />
                {/* Unit badge */}
                <span style={{
                  background:   `${accentColor}22`,
                  color:        accentColor,
                  border:       `1px solid ${accentColor}44`,
                  borderRadius: 3,
                  padding:      "3px 7px",
                  fontSize:     10,
                  fontFamily:   "'Space Mono', monospace",
                  whiteSpace:   "nowrap",
                  flexShrink:   0,
                }}>
                  {unit}
                </span>
              </div>
              {/* Preview kondisi dengan angka nyata */}
              {threshold && currentPrice && (
                <div style={{ fontSize: 10, color: C.label, marginTop: 4 }}>
                  {condition === "above" && `Alert jika harga ≥ Rp${parseFloat(threshold).toLocaleString("id")}`}
                  {condition === "below" && `Alert jika harga ≤ Rp${parseFloat(threshold).toLocaleString("id")}`}
                  {condition === "change_pct" && `Alert jika naik/turun ≥ ${threshold}%`}
                  {condition === "volume_spike" && `Alert jika volume ≥ ${parseInt(threshold).toLocaleString("id")} lembar`}
                </div>
              )}
            </div>

            {/* Catatan opsional */}
            <div>
              <div style={{ fontSize: 10, color: C.label, fontFamily: "'Syne', sans-serif", letterSpacing: 1, marginBottom: 4 }}>
                CATATAN <span style={{ color: C.muted, fontSize: 9 }}>(opsional)</span>
              </div>
              <input
                placeholder="mis. Target TP pertama BBCA"
                value={note}
                onChange={e => setNote(e.target.value)}
                style={INPUT}
                maxLength={200}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding:    "9px 0",
                fontSize:   11,
                fontWeight: 700,
                fontFamily: "'Syne', sans-serif",
                border:     "none",
                borderRadius: 3,
                background: accentColor,
                color:      condition === "change_pct" ? "#000" : "#fff",
                cursor:     submitting ? "not-allowed" : "pointer",
                opacity:    submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Memproses..." : "🔔 Pasang Alert"}
            </button>
          </form>

          {/* Feedback message */}
          {msg && (
            <div style={{
              marginTop:  10,
              padding:    "7px 10px",
              borderRadius: 3,
              fontSize:   11,
              background: msg.ok ? "rgba(0,214,143,0.1)" : "rgba(255,69,96,0.1)",
              color:      msg.ok ? C.up : C.dn,
              border:     `1px solid ${msg.ok ? "rgba(0,214,143,0.3)" : "rgba(255,69,96,0.3)"}`,
              display:    "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap:        6,
            }}>
              <span style={{ flex: 1 }}>{msg.text}</span>
              {!msg.ok && (
                <button
                  onClick={() => setMsg(null)}
                  style={{
                    background: "transparent",
                    border:     "none",
                    color:      C.dn,
                    cursor:     "pointer",
                    fontSize:   12,
                    padding:    "0 2px",
                    flexShrink: 0,
                  }}
                >✕</button>
              )}
            </div>
          )}

          {/* Panduan singkat */}
          <div style={{
            marginTop:  16,
            paddingTop: 12,
            borderTop:  `1px solid ${C.border}`,
            fontSize:   10,
            color:      C.muted,
            lineHeight: 1.7,
          }}>
            <div style={{ marginBottom: 4, color: C.label }}>Cara kerja alert:</div>
            <div>✅ Alert hanya aktif <strong style={{ color: C.label }}>sekali</strong> — setelah terpicu, tidak akan muncul lagi</div>
            <div>🔔 Notifikasi muncul di layar saat kondisi terpenuhi</div>
            <div>📝 Pasang alert baru jika ingin pantau ulang</div>
          </div>
        </div>

        {/* ── Alert list ───────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Filter bar */}
          <div style={{
            padding:      "8px 12px",
            borderBottom: `1px solid ${C.border}`,
            display:      "flex",
            gap:          6,
            alignItems:   "center",
            flexShrink:   0,
          }}>
            {(["active", "all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding:    "4px 12px",
                fontSize:   11,
                fontFamily: "'Syne', sans-serif",
                border:     `1px solid ${filter === f ? C.accent : "transparent"}`,
                borderRadius: 3,
                background: filter === f ? `${C.accent}22` : "transparent",
                color:      filter === f ? C.accent : C.label,
                cursor:     "pointer",
              }}>
                {f === "active" ? "Aktif" : "Semua"}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 11, color: C.label, fontFamily: "'Space Mono', monospace" }}>
              {displayedAlerts.length} alert
            </span>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 11 }}>
                Memuat alert...
              </div>
            ) : displayedAlerts.length === 0 ? (
              <div style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🔔</div>
                <div style={{ fontSize: 13, color: C.label, marginBottom: 6 }}>
                  {filter === "active" ? "Belum ada alert aktif" : "Belum ada alert"}
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {filter === "active"
                    ? "Pasang alert di panel kiri untuk mendapat notifikasi harga"
                    : "Belum pernah memasang alert"}
                </div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead style={{ position: "sticky", top: 0, background: C.surface }}>
                  <tr>
                    {["Saham", "Kondisi", "Threshold", "Catatan", "Dibuat", "Status", ""].map(h => (
                      <th key={h} style={{
                        padding:    "7px 10px",
                        textAlign:  "left",
                        fontFamily: "'Syne', sans-serif",
                        fontSize:   10,
                        letterSpacing: 1,
                        color:      C.label,
                        fontWeight: 400,
                        borderBottom: `1px solid ${C.border}`,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedAlerts.map(a => (
                    <AlertRow key={a.id} alert={a} onDelete={() => deleteAlert(a.id)} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertRow({ alert: a, onDelete }: { alert: PriceAlert; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const condColor = CONDITION_COLORS[a.condition] ?? C.accent;
  const condLabel = CONDITION_LABELS[a.condition] ?? a.condition;
  const unit      = CONDITION_UNITS[a.condition] ?? "";

  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{
        padding:    "6px 10px",
        color:      "#8aa8cc",
        fontWeight: 700,
        fontFamily: "'Space Mono', monospace",
      }}>
        {a.ticker.replace(".JK", "")}
      </td>
      <td style={{ padding: "6px 10px" }}>
        <span style={{ color: condColor, fontSize: 10, fontFamily: "'Space Mono', monospace" }}>
          {condLabel}
        </span>
      </td>
      <td style={{ padding: "6px 10px", color: C.text, fontFamily: "'Space Mono', monospace" }}>
        {a.threshold.toLocaleString("id")}
        <span style={{ color: C.label, marginLeft: 3, fontSize: 10 }}>{unit}</span>
      </td>
      <td style={{ padding: "6px 10px", color: C.label, fontSize: 10, maxWidth: 160 }}>
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.note || "—"}
        </span>
      </td>
      <td style={{ padding: "6px 10px", color: C.muted, fontSize: 10 }}>
        {a.created_at.slice(0, 16).replace("T", " ")}
      </td>
      <td style={{ padding: "6px 10px" }}>
        {a.is_active ? (
          <span style={{ color: C.up, fontSize: 10, fontFamily: "'Space Mono', monospace" }}>
            ● AKTIF
          </span>
        ) : (
          <span style={{ color: C.muted, fontSize: 10 }}>
            Terpicu {a.triggered_at ? a.triggered_at.slice(0, 10) : ""}
          </span>
        )}
      </td>
      <td style={{ padding: "6px 10px" }}>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              padding:    "3px 9px",
              fontSize:   10,
              fontFamily: "'Syne', sans-serif",
              background: "rgba(255,69,96,0.08)",
              border:     "1px solid rgba(255,69,96,0.25)",
              borderRadius: 3,
              color:      C.dn,
              cursor:     "pointer",
            }}
          >
            Hapus
          </button>
        ) : (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: C.warn }}>Yakin?</span>
            <button
              onClick={() => { onDelete(); setConfirmDelete(false); }}
              style={{
                padding:    "2px 7px",
                fontSize:   10,
                fontFamily: "'Syne', sans-serif",
                background: "rgba(255,69,96,0.15)",
                border:     "1px solid rgba(255,69,96,0.4)",
                borderRadius: 3,
                color:      C.dn,
                cursor:     "pointer",
              }}
            >
              Ya
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                padding:    "2px 7px",
                fontSize:   10,
                fontFamily: "'Syne', sans-serif",
                background: "transparent",
                border:     "1px solid #0f2040",
                borderRadius: 3,
                color:      C.label,
                cursor:     "pointer",
              }}
            >
              Tidak
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}