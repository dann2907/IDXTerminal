import { memo } from "react";
import type { QuoteData } from "@/stores/market";
import Sparkline from "@/shared/ui/Sparkline";
import { C } from "./constants/tokens";
import { fmt, fmtV, fmtRp, fmtPct } from "@/lib/formatters";
import { getVolColor, getRangePos, getSignal } from "./utils/calculations";

interface Props {
  q: QuoteData & { rvol: number, rs_rank: number };
  onSelectTicker: (ticker: string) => void;
  inWl: boolean;
  handleWatchlist: (e: React.MouseEvent, ticker: string) => void;
  visibleColumns: string[];
  spark: number[];
  isActive: boolean;
}

const ScreenerRow = memo(function ScreenerRow({ 
  q, 
  onSelectTicker, 
  inWl, 
  handleWatchlist, 
  visibleColumns,
  spark,
  isActive
}: Props) {
  const sym = q.ticker.replace(".JK", "");
  const signal = getSignal(q);
  
  // Range calculation
  const pos = getRangePos(q.price, q.low, q.high);

  // Vol bar color
  const volColor = getVolColor(q.rvol);

  return (
    <tr
      className={`screener-row ${isActive ? 'active' : ''}`}
      onClick={() => onSelectTicker(q.ticker)}
      style={{ 
        height: 52,
        borderBottom: `1px solid ${C.border}`, 
        cursor: "pointer",
        transition: "all 150ms ease",
        position: "relative"
      }}>

      <td style={{ padding: "0 16px", width: 110 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <span className="ticker-sym" style={{ 
            color: C.white, 
            fontWeight: 600, 
            fontFamily: "'Space Mono',monospace", 
            fontSize: 16,
            lineHeight: 1.2
          }}>{sym}</span>
          <span style={{ color: C.label, fontSize: 11 }}>{q.name && q.name !== "N/A" ? q.name : "IDX Equity"}</span>
        </div>
      </td>

      {visibleColumns.includes("price") && (
        <td style={{ padding: "0 16px", textAlign: "right", color: C.text, fontFamily: "'Space Mono',monospace", fontSize: 14, fontWeight: 500 }}>
          {fmt(q.price)}
        </td>
      )}

      {visibleColumns.includes("sparkline") && (
        <td style={{ padding: "0 16px", textAlign: "center", width: 90 }}>
          <div style={{ width: 80, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {spark.length >= 2 ? (
              <Sparkline data={spark} color={q.change_pct >= 0 ? C.up : C.dn} width={80} height={24} />
            ) : (
              <div style={{ fontSize: 9, color: C.muted }}>Waiting...</div>
            )}
          </div>
        </td>
      )}

      {visibleColumns.includes("change_pct") && (
        <td style={{ padding: "0 16px", textAlign: "right", width: 80 }}>
          <span style={{
            fontSize: 16, fontWeight: 600, fontFamily: "'Space Mono',monospace",
            color: q.change_pct >= 0 ? C.up : C.dn,
          }}>
            {fmtPct(q.change_pct)}
          </span>
        </td>
      )}

      {visibleColumns.includes("volume") && (
        <td style={{ padding: "0 16px", textAlign: "right", width: 120 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ color: C.text, fontFamily: "'Space Mono',monospace", fontSize: 14, fontWeight: 500 }}>{fmtV(q.volume)}</span>
            <div style={{ width: 60, height: 3, background: "#333", borderRadius: 1.5, marginTop: 4, overflow: "hidden" }}>
              <div style={{ 
                width: `${Math.min((q.rvol || 0) * 30, 100)}%`, 
                height: "100%", 
                background: volColor,
                transition: "width 0.3s ease"
              }} />
            </div>
          </div>
        </td>
      )}

      {visibleColumns.includes("range") && (
        <td style={{ padding: "0 16px", width: 130 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.label, fontSize: 11, fontFamily: "'Space Mono',monospace" }}>
            <span style={{ width: 35, textAlign: "right" }}>{fmt(q.low)}</span>
            <div style={{ flex: 1, height: 2, background: C.border, position: "relative", minWidth: 40 }}>
              <div style={{ 
                position: "absolute", left: `${pos}%`, top: -3, width: 8, height: 8, 
                borderRadius: "50%", background: C.white, border: `2px solid ${C.bg}`,
                transform: "translateX(-50%)", zIndex: 2
              }} />
            </div>
            <span style={{ width: 35, textAlign: "left" }}>{fmt(q.high)}</span>
          </div>
        </td>
      )}

      {visibleColumns.includes("rvol") && (
        <td style={{ padding: "0 16px", textAlign: "right", color: q.rvol > 1.5 ? C.accent : C.label, fontFamily: "'Space Mono',monospace", fontSize: 13, width: 60 }}>
          {q.rvol ? q.rvol.toFixed(1) : "—"}x
        </td>
      )}

      {visibleColumns.includes("rs_rank") && (
        <td style={{ padding: "0 16px", textAlign: "right", color: q.rs_rank > 70 ? C.up : C.text, fontFamily: "'Space Mono',monospace", fontSize: 13, width: 60 }}>
          {q.rs_rank || "—"}
        </td>
      )}

      {visibleColumns.includes("signals") && (
        <td style={{ padding: "0 16px", width: 130 }}>
          {signal && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 4,
              background: `${signal.color}18`, color: signal.color, border: `1px solid ${signal.color}44`,
              opacity: 0.9, textTransform: "uppercase"
            }}>
              {signal.label}
            </span>
          )}
        </td>
      )}

      {visibleColumns.includes("market_cap") && (
        <td style={{ padding: "0 16px", textAlign: "right", color: C.label, fontFamily: "'Space Mono',monospace", fontSize: 13, width: 90 }}>{fmtRp(q.market_cap)}</td>
      )}
      {visibleColumns.includes("pe_ratio") && (
        <td style={{ padding: "0 16px", textAlign: "right", color: C.label, fontFamily: "'Space Mono',monospace", fontSize: 13, width: 60 }}>{q.pe_ratio ? q.pe_ratio.toFixed(1) : "—"}</td>
      )}
      {visibleColumns.includes("pbv_ratio") && (
        <td style={{ padding: "0 16px", textAlign: "right", color: C.label, fontFamily: "'Space Mono',monospace", fontSize: 13, width: 60 }}>{q.pbv_ratio ? q.pbv_ratio.toFixed(1) : "—"}</td>
      )}

      <td style={{ padding: "0 16px", textAlign: "center", width: 50 }}>
        <button
          className="watchlist-btn"
          onClick={e => handleWatchlist(e, q.ticker)}
          style={{
            padding: "3px 8px", fontSize: 12,
            background: inWl ? `${C.accent}22` : "transparent",
            border: `1px solid ${inWl ? C.accent : C.muted}`,
            borderRadius: 3, color: inWl ? C.accent : C.muted,
            transition: "all 0.1s"
          }}>
          {inWl ? "★" : "☆"}
        </button>
      </td>
    </tr>
  );
});

export default ScreenerRow;
