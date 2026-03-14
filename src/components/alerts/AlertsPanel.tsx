// src/components/alerts/AlertsPanel.tsx
//
// Panel price alerts — pasang, lihat, hapus.
// Toast notification muncul saat alert terpicu (via WS).

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
  color: C.text, fontFamily: "'Space Mono',monospace", fontSize: 10,
  padding: "4px 8px", outline: "none", width: "100%", boxSizing: "border-box" as const,
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

  const [ticker,    setTicker]    = useState("");
  const [condition, setCondition] = useState("above");
  const [threshold, setThreshold] = useState("");
  const [note,      setNote]      = useState("");
  const [msg,       setMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [submitting,setSubmitting]= useState(false);
  const [filter,    setFilter]    = useState<"all" | "active">("active");

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const displayedAlerts = filter === "active"
    ? alerts.filter(a => a.is_active)
    : alerts;

  const currentPrice = quotes[ticker.toUpperCase().endsWith(".JK")
    ? ticker.toUpperCase()
    : `${ticker.toUpperCase()}.JK`]?.price;

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

      {/* ── Toast notifications ──────────────────────────────────── */}
      {toasts.length > 0 && (
        <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          {toasts.map(t => (
            <div key={t.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", borderRadius: 5, gap: 8,
              background: "rgba(245,158,11,0.12)", border: `1px solid ${C.warn}44`,
            }}>
              <span style={{ fontSize: 10, color: C.text, flex: 1 }}>
                <span style={{ color: C.warn, fontWeight: 700, marginRight: 6 }}>{t.ticker.replace(".JK","")}</span>
                {t.message}
              </span>
              <button onClick={() => dismissToast(t.id)} style={{
                background: "transparent", border: "none",
                color: C.muted, cursor: "pointer", fontSize: 12, padding: "0 4px",
              }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Main area: split form + list ────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", gap: 0 }}>

        {/* ── Form pasang alert ──────────────────────────────────── */}
        <div style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${C.border}`, padding: 12, overflowY: "auto" }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 8, letterSpacing: 2, color: C.muted, marginBottom: 10 }}>
            PASANG ALERT
          </div>

          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Ticker */}
            <div>
              <div style={{ fontSize: 8, color: C.label, fontFamily: "'Syne',sans-serif", letterSpacing: 1, marginBottom: 3 }}>TICKER</div>
              <input placeholder="mis. BBCA" value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())} style={INPUT} required />
              {currentPrice && (
                <div style={{ fontSize: 9, color: C.label, marginTop: 2 }}>
                  Harga saat ini: <span style={{ color: C.text }}>{currentPrice.toLocaleString("id")}</span>
                </div>
              )}
            </div>

            {/* Kondisi */}
            <div>
              <div style={{ fontSize: 8, color: C.label, fontFamily: "'Syne',sans-serif", letterSpacing: 1, marginBottom: 3 }}>KONDISI</div>
              <select value={condition} onChange={e => setCondition(e.target.value)}
                style={{ ...INPUT, cursor: "pointer" }}>
                {Object.entries(CONDITION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* Threshold */}
            <div>
              <div style={{ fontSize: 8, color: C.label, fontFamily: "'Syne',sans-serif", letterSpacing: 1, marginBottom: 3 }}>
                {condition === "change_pct" ? "THRESHOLD (%)" : condition === "volume_spike" ? "VOLUME (LEMBAR)" : "HARGA (RP)"}
              </div>
              <input type="number" min="0" step="any" placeholder="0"
                value={threshold} onChange={e => setThreshold(e.target.value)}
                style={INPUT} required />
            </div>

            {/* Catatan opsional */}
            <div>
              <div style={{ fontSize: 8, color: C.label, fontFamily: "'Syne',sans-serif", letterSpacing: 1, marginBottom: 3 }}>CATATAN (OPSIONAL)</div>
              <input placeholder="mis. Target TP pertama"
                value={note} onChange={e => setNote(e.target.value)}
                style={INPUT} maxLength={200} />
            </div>

            <button type="submit" disabled={submitting}
              style={{
                padding: "7px 0", fontSize: 9, fontWeight: 700,
                fontFamily: "'Syne',sans-serif", border: "none", borderRadius: 3,
                background: CONDITION_COLORS[condition] ?? C.accent,
                color: condition === "change_pct" ? "#000" : "#fff",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.6 : 1, marginTop: 2,
              }}>
              {submitting ? "Memproses..." : "Pasang Alert"}
            </button>
          </form>

          {msg && (
            <div style={{
              marginTop: 8, padding: "5px 8px", borderRadius: 3, fontSize: 9,
              background: msg.ok ? "rgba(0,214,143,0.1)" : "rgba(255,69,96,0.1)",
              color:      msg.ok ? C.up : C.dn,
              border:     `1px solid ${msg.ok ? "rgba(0,214,143,0.3)" : "rgba(255,69,96,0.3)"}`,
            }}>{msg.text}</div>
          )}

          {/* Export links */}
          <div style={{ marginTop: 20, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 8, letterSpacing: 2, color: C.muted, marginBottom: 8 }}>EXPORT</div>
            <a href="http://127.0.0.1:8765/api/export/history.csv" download
              style={{ display: "block", fontSize: 9, color: C.accent, textDecoration: "none", marginBottom: 4 }}>
              ↓ Riwayat Transaksi (.csv)
            </a>
            <a href="http://127.0.0.1:8765/api/export/holdings.csv" download
              style={{ display: "block", fontSize: 9, color: C.accent, textDecoration: "none" }}>
              ↓ Holdings Saat Ini (.csv)
            </a>
          </div>
        </div>

        {/* ── Alert list ─────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Filter bar */}
          <div style={{ padding: "6px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            {(["active", "all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "2px 8px", fontSize: 9, fontFamily: "'Syne',sans-serif",
                border:  `1px solid ${filter === f ? C.accent : "transparent"}`,
                borderRadius: 3, background: filter === f ? `${C.accent}22` : "transparent",
                color:   filter === f ? C.accent : C.label, cursor: "pointer",
              }}>
                {f === "active" ? "Aktif" : "Semua"}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 9, color: C.label, fontFamily: "'Space Mono',monospace" }}>
              {displayedAlerts.length} alert
            </span>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead style={{ position: "sticky", top: 0, background: C.surface }}>
                <tr>
                  {["Ticker", "Kondisi", "Threshold", "Catatan", "Dibuat", "Status", ""].map(h => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left",
                      fontFamily: "'Syne',sans-serif", fontSize: 8, letterSpacing: 1,
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
                {displayedAlerts.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} style={{ padding: "32px 12px", textAlign: "center", color: C.muted, fontSize: 11 }}>
                      {filter === "active" ? "Tidak ada alert aktif" : "Belum ada alert"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
      <td style={{ padding: "5px 10px", color: "#8aa8cc", fontWeight: 700, fontFamily: "'Space Mono',monospace" }}>
        {a.ticker.replace(".JK", "")}
      </td>
      <td style={{ padding: "5px 10px" }}>
        <span style={{ color: condColor, fontSize: 9, fontFamily: "'Space Mono',monospace" }}>{condLabel}</span>
      </td>
      <td style={{ padding: "5px 10px", color: C.text, fontFamily: "'Space Mono',monospace" }}>
        {a.threshold.toLocaleString("id")}
      </td>
      <td style={{ padding: "5px 10px", color: C.label, fontSize: 9, maxWidth: 160 }}>
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.note || "—"}
        </span>
      </td>
      <td style={{ padding: "5px 10px", color: C.muted, fontSize: 9 }}>
        {a.created_at.slice(0, 16).replace("T", " ")}
      </td>
      <td style={{ padding: "5px 10px" }}>
        {a.is_active
          ? <span style={{ color: C.up, fontSize: 9, fontFamily: "'Space Mono',monospace" }}>AKTIF</span>
          : <span style={{ color: C.muted, fontSize: 9 }}>
              terpicu {a.triggered_at ? a.triggered_at.slice(0, 16).replace("T", " ") : ""}
            </span>
        }
      </td>
      <td style={{ padding: "5px 10px" }}>
        <button onClick={onDelete} style={{
          padding: "2px 7px", fontSize: 8, fontFamily: "'Syne',sans-serif",
          background: "rgba(255,69,96,0.08)", border: "1px solid rgba(255,69,96,0.25)",
          borderRadius: 3, color: C.dn, cursor: "pointer",
        }}>Hapus</button>
      </td>
    </tr>
  );
}