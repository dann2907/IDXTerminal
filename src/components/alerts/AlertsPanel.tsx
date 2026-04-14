// src/components/alerts/AlertsPanel.tsx
//
// FIX UX: toast auto-dismiss setelah 6 detik agar tidak menumpuk.

import { useState, useEffect } from "react";
import { useAlertStore, type PriceAlert } from "../../stores/useAlertStore";
import { useMarketStore } from "../../stores/useMarketStore";

const C = {
  bg: "#070d1c", surface: "#0a1222", border: "#0f2040",
  muted: "#2a4060", label: "#4a6080", text: "#c8d8f0",
  up: "#00d68f", dn: "#ff4560", accent: "#2e8fdf", warn: "#f59e0b",
};

const INPUT: React.CSSProperties = {
  background: "#040d1a", border: `1px solid ${C.border}`, borderRadius: 3,
  color: C.text, fontFamily: "'Space Mono',monospace", fontSize: 11,
  padding: "5px 8px", outline: "none", width: "100%", boxSizing: "border-box" as const,
};

const CONDITION_LABELS: Record<string, string> = {
  above:        "Harga ≥",
  below:        "Harga ≤",
  change_pct:   "|Chg%| ≥",
  volume_spike: "Volume ≥",
};

const CONDITION_COLORS: Record<string, string> = {
  above: C.up, below: C.dn, change_pct: C.warn, volume_spike: C.accent,
};

export default function AlertsPanel() {
  const { alerts, toasts, loading, fetchAlerts, createAlert, deleteAlert, dismissToast } = useAlertStore();
  const quotes = useMarketStore(s => s.quotes);

  const [ticker,     setTicker]     = useState("");
  const [condition,  setCondition]  = useState("above");
  const [threshold,  setThreshold]  = useState("");
  const [note,       setNote]       = useState("");
  const [msg,        setMsg]        = useState<{ ok: boolean; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filter,     setFilter]     = useState<"all" | "active">("active");

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // FIX: auto-dismiss toast tertua setelah 6 detik
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      dismissToast(toasts[0].id);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toasts, dismissToast]);

  const displayedAlerts = filter === "active"
    ? alerts.filter(a => a.is_active)
    : alerts;

  const currentPrice = quotes[ticker.toUpperCase().endsWith(".JK")
    ? ticker.toUpperCase()
    : `${ticker.toUpperCase()}.JK`]?.price;

  // Panduan harga untuk input threshold
  const thresholdHint = (() => {
    if (!currentPrice) return null;
    if (condition === "above") return `Harga saat ini: ${currentPrice.toLocaleString("id")} — isi angka di atas ini`;
    if (condition === "below") return `Harga saat ini: ${currentPrice.toLocaleString("id")} — isi angka di bawah ini`;
    if (condition === "change_pct") return `Contoh: 3 = alert saat naik/turun 3%`;
    if (condition === "volume_spike") return `Contoh: 10000000 = 10 juta lembar`;
    return null;
  })();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const thr = parseFloat(threshold);
    if (isNaN(thr) || thr <= 0) { setMsg({ ok: false, text: "Threshold harus angka positif." }); return; }
    setSubmitting(true);
    const res = await createAlert(ticker, condition, thr, note);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) { setTicker(""); setThreshold(""); setNote(""); }
    setSubmitting(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, overflow: "hidden" }}>

      {/* ── Toast notifications (auto-dismiss) ──────────────────────── */}
      {toasts.length > 0 && (
        <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          {toasts.map((t, i) => (
            <div key={t.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 12px", borderRadius: 5, gap: 8,
              background: "rgba(245,158,11,0.12)", border: `1px solid ${C.warn}44`,
            }}>
              <span style={{ fontSize: 11, color: C.text, flex: 1 }}>
                <span style={{ color: C.warn, fontWeight: 700, marginRight: 6 }}>
                  {t.ticker.replace(".JK", "")}
                </span>
                {t.message}
              </span>
              {/* Hint kapan auto-dismiss */}
              {i === 0 && (
                <span style={{ fontSize: 10, color: C.muted, flexShrink: 0, marginRight: 4 }}>
                  hilang otomatis
                </span>
              )}
              <button onClick={() => dismissToast(t.id)} style={{
                background: "transparent", border: "none",
                color: C.muted, cursor: "pointer", fontSize: 14, padding: "0 4px",
                lineHeight: 1,
              }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Main area: split form + list ────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", gap: 0 }}>

        {/* ── Form pasang alert ──────────────────────────────────── */}
        <div style={{ width: 230, flexShrink: 0, borderRight: `1px solid ${C.border}`, padding: 14, overflowY: "auto" }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 12 }}>
            PASANG ALERT HARGA
          </div>

          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Ticker */}
            <div>
              <div style={{ fontSize: 10, color: C.label, fontFamily: "'Syne',sans-serif", letterSpacing: 1, marginBottom: 4 }}>TICKER</div>
              <input placeholder="mis. BBCA" value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())} style={INPUT} required />
              {currentPrice && (
                <div style={{ fontSize: 11, color: C.up, marginTop: 3 }}>
                  Harga sekarang: {currentPrice.toLocaleString("id")}
                </div>
              )}
            </div>

            {/* Kondisi */}
            <div>
              <div style={{ fontSize: 10, color: C.label, fontFamily: "'Syne',sans-serif", letterSpacing: 1, marginBottom: 4 }}>KONDISI TRIGGER</div>
              <select value={condition} onChange={e => setCondition(e.target.value)}
                style={{ ...INPUT, cursor: "pointer" }}>
                {Object.entries(CONDITION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* Threshold dengan hint */}
            <div>
              <div style={{ fontSize: 10, color: C.label, fontFamily: "'Syne',sans-serif", letterSpacing: 1, marginBottom: 4 }}>
                {condition === "change_pct" ? "THRESHOLD (%)" : condition === "volume_spike" ? "VOLUME (LEMBAR)" : "HARGA TARGET (RP)"}
              </div>
              <input type="number" min="0" step="any" placeholder="0"
                value={threshold} onChange={e => setThreshold(e.target.value)}
                style={INPUT} required />
              {thresholdHint && (
                <div style={{ fontSize: 10, color: C.label, marginTop: 3, lineHeight: 1.5 }}>
                  {thresholdHint}
                </div>
              )}
            </div>

            {/* Catatan opsional */}
            <div>
              <div style={{ fontSize: 10, color: C.label, fontFamily: "'Syne',sans-serif", letterSpacing: 1, marginBottom: 4 }}>CATATAN (OPSIONAL)</div>
              <input placeholder="mis. Target TP pertama"
                value={note} onChange={e => setNote(e.target.value)}
                style={INPUT} maxLength={200} />
            </div>

            <button type="submit" disabled={submitting || !ticker || !threshold}
              style={{
                padding: "8px 0", fontSize: 11, fontWeight: 700,
                fontFamily: "'Syne',sans-serif", border: "none", borderRadius: 3,
                background: CONDITION_COLORS[condition] ?? C.accent,
                color: condition === "change_pct" ? "#000" : "#fff",
                cursor: (submitting || !ticker || !threshold) ? "not-allowed" : "pointer",
                opacity: (submitting || !ticker || !threshold) ? 0.5 : 1,
                marginTop: 2,
              }}>
              {submitting ? "Memproses..." : "Pasang Alert"}
            </button>
          </form>

          {msg && (
            <div style={{
              marginTop: 8, padding: "6px 10px", borderRadius: 3, fontSize: 11,
              background: msg.ok ? "rgba(0,214,143,0.1)" : "rgba(255,69,96,0.1)",
              color:      msg.ok ? C.up : C.dn,
              border:     `1px solid ${msg.ok ? "rgba(0,214,143,0.3)" : "rgba(255,69,96,0.3)"}`,
            }}>{msg.text}</div>
          )}

          {/* Export links */}
          <div style={{ marginTop: 20, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 8 }}>EXPORT DATA</div>
            <a href="http://127.0.0.1:8765/api/export/history.csv" download
              style={{ display: "block", fontSize: 11, color: C.accent, textDecoration: "none", marginBottom: 6 }}>
              Riwayat Transaksi (.csv)
            </a>
            <a href="http://127.0.0.1:8765/api/export/holdings.csv" download
              style={{ display: "block", fontSize: 11, color: C.accent, textDecoration: "none" }}>
              Holdings Saat Ini (.csv)
            </a>
          </div>
        </div>

        {/* ── Alert list ─────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Filter bar */}
          <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            {(["active", "all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "3px 10px", fontSize: 10, fontFamily: "'Syne',sans-serif",
                border:  `1px solid ${filter === f ? C.accent : "transparent"}`,
                borderRadius: 3, background: filter === f ? `${C.accent}22` : "transparent",
                color:   filter === f ? C.accent : C.label, cursor: "pointer",
              }}>
                {f === "active" ? "Aktif" : "Semua"}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 11, color: C.label, fontFamily: "'Space Mono',monospace" }}>
              {displayedAlerts.length} alert
            </span>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {displayedAlerts.length === 0 && !loading ? (
              <div style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
                <div style={{ fontSize: 14, color: C.text, marginBottom: 6 }}>
                  {filter === "active" ? "Belum ada alert aktif" : "Belum ada alert"}
                </div>
                <div style={{ fontSize: 12, color: C.label, lineHeight: 1.6 }}>
                  Pasang alert agar dapat notifikasi<br/>saat harga saham menyentuh target kamu.
                </div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead style={{ position: "sticky", top: 0, background: C.surface }}>
                  <tr>
                    {["Ticker", "Kondisi", "Target", "Catatan", "Dibuat", "Status", ""].map(h => (
                      <th key={h} style={{ padding: "7px 10px", textAlign: "left",
                        fontFamily: "'Syne',sans-serif", fontSize: 10, letterSpacing: 1,
                        color: C.label, fontWeight: 400, borderBottom: `1px solid ${C.border}` }}>
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
  const condColor = CONDITION_COLORS[a.condition] ?? C.accent;
  const condLabel = CONDITION_LABELS[a.condition] ?? a.condition;
  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{ padding: "6px 10px", color: "#8aa8cc", fontWeight: 700, fontFamily: "'Space Mono',monospace" }}>
        {a.ticker.replace(".JK", "")}
      </td>
      <td style={{ padding: "6px 10px" }}>
        <span style={{ color: condColor, fontSize: 11, fontFamily: "'Space Mono',monospace" }}>{condLabel}</span>
      </td>
      <td style={{ padding: "6px 10px", color: C.text, fontFamily: "'Space Mono',monospace" }}>
        {a.threshold.toLocaleString("id")}
      </td>
      <td style={{ padding: "6px 10px", color: C.label, fontSize: 11, maxWidth: 160 }}>
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.note || "—"}
        </span>
      </td>
      <td style={{ padding: "6px 10px", color: C.muted, fontSize: 11 }}>
        {a.created_at.slice(0, 16).replace("T", " ")}
      </td>
      <td style={{ padding: "6px 10px" }}>
        {a.is_active
          ? <span style={{ color: C.up, fontSize: 11, fontFamily: "'Space Mono',monospace" }}>AKTIF</span>
          : <span style={{ color: C.muted, fontSize: 11 }}>
              Terpicu {a.triggered_at ? a.triggered_at.slice(0, 16).replace("T", " ") : ""}
            </span>
        }
      </td>
      <td style={{ padding: "6px 10px" }}>
        <button onClick={onDelete} style={{
          padding: "3px 8px", fontSize: 10, fontFamily: "'Syne',sans-serif",
          background: "rgba(255,69,96,0.08)", border: "1px solid rgba(255,69,96,0.25)",
          borderRadius: 3, color: C.dn, cursor: "pointer",
        }}>Hapus</button>
      </td>
    </tr>
  );
}