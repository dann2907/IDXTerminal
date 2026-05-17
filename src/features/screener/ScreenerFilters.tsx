import { memo } from "react";
import { C, LABEL_STYLE, INPUT_STYLE, RESET_BTN } from "./constants/tokens";
import ColumnPicker from "./ColumnPicker";
import type { PresetType } from "@/stores/screener";

interface Props {
  activePreset: PresetType;
  onSetPreset: (preset: PresetType) => void;
  filters: any;
  onSetFilter: (key: any, value: any) => void;
  onToggleGroupBySector: () => void;
  onToggleColumn: (columnId: string) => void;
  onResetFilters: () => void;
  activeFiltersCount: number;
  sectors: string[];
  stocksMatchedCount: number;
}

const ScreenerFilters = memo(function ScreenerFilters({
  activePreset,
  onSetPreset,
  filters,
  onSetFilter,
  onToggleGroupBySector,
  onToggleColumn,
  onResetFilters,
  activeFiltersCount,
  sectors,
  stocksMatchedCount
}: Props) {
  return (
    <>
      {/* ── Preset Bar ──────────────────────────────────────────────── */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, flexWrap: "wrap", background: C.surface, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, flex: 1 }}>
          <PresetItem active={activePreset === "all"} onClick={() => onSetPreset("all")}>Semua</PresetItem>
          <PresetItem active={activePreset === "top_gainer"} onClick={() => onSetPreset("top_gainer")} color={C.up}>Top Gainer</PresetItem>
          <PresetItem active={activePreset === "top_loser"} onClick={() => onSetPreset("top_loser")} color={C.dn}>Top Loser</PresetItem>
          <PresetItem active={activePreset === "breakout"} onClick={() => onSetPreset("breakout")} color={C.accent}>Breakout</PresetItem>
          <PresetItem active={activePreset === "high_vol"} onClick={() => onSetPreset("high_vol")} color={C.accent}>High Volume</PresetItem>
        </div>

        <ColumnPicker 
          visibleColumns={filters.visibleColumns || []}
          onToggle={onToggleColumn}
        />
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────── */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>

        {/* Search */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={LABEL_STYLE}>TICKER</label>
          <input
            placeholder="Cari..."
            value={filters.search}
            onChange={e => onSetFilter("search", e.target.value.toUpperCase())}
            style={{ ...INPUT_STYLE, width: 100 }}
          />
        </div>

        {/* Change% */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={LABEL_STYLE}>CHG% RANGE</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input placeholder="Min" value={filters.minChg} onChange={e => onSetFilter("minChg", e.target.value)} style={{ ...INPUT_STYLE, width: 55 }} />
            <span style={{ color: C.label, fontSize: 10 }}>—</span>
            <input placeholder="Max" value={filters.maxChg} onChange={e => onSetFilter("maxChg", e.target.value)} style={{ ...INPUT_STYLE, width: 55 }} />
          </div>
        </div>

        {/* Volume */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={LABEL_STYLE}>MIN VOL (JT)</label>
          <input placeholder="Juta" value={filters.minVol} onChange={e => onSetFilter("minVol", e.target.value)} style={{ ...INPUT_STYLE, width: 70 }} />
        </div>

        {/* Price */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={LABEL_STYLE}>PRICE RANGE</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input placeholder="Min" value={filters.minPrice} onChange={e => onSetFilter("minPrice", e.target.value)} style={{ ...INPUT_STYLE, width: 65 }} />
            <span style={{ color: C.label, fontSize: 10 }}>—</span>
            <input placeholder="Max" value={filters.maxPrice} onChange={e => onSetFilter("maxPrice", e.target.value)} style={{ ...INPUT_STYLE, width: 65 }} />
          </div>
        </div>

        {/* Sector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={LABEL_STYLE}>SECTOR</label>
          <select 
            value={filters.sector}
            onChange={e => onSetFilter("sector", e.target.value)}
            style={{ ...INPUT_STYLE, width: 140, height: 28, padding: "0 8px" }}>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Grouping Toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={LABEL_STYLE}>VIEW</label>
          <button 
            onClick={onToggleGroupBySector}
            style={{
              ...INPUT_STYLE, width: 110, cursor: "pointer",
              background: filters.groupBySector ? `${C.accent}22` : "#11141d",
              color: filters.groupBySector ? C.accent : C.text,
              border: `1px solid ${filters.groupBySector ? C.accent : C.border}`,
              fontWeight: 600
            }}>
            {filters.groupBySector ? "Sectorized" : "Flat List"}
          </button>
        </div>

        {/* Reset */}
        {activeFiltersCount > 0 && (
          <button onClick={onResetFilters} style={{ ...RESET_BTN, marginTop: 18 }}>Clear All</button>
        )}

        {/* Count */}
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 18, color: "#fff", fontWeight: 700, fontFamily: "'Space Mono',monospace", lineHeight: 1 }}>{stocksMatchedCount}</div>
          <div style={{ fontSize: 9, color: C.label, fontWeight: 700, letterSpacing: 0.5, marginTop: 4 }}>STOCKS MATCHED</div>
        </div>
      </div>
    </>
  );
});

const PresetItem = memo(function PresetItem({ children, active, color = C.accent, onClick }: {
  children: React.ReactNode; active: boolean; color?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", fontSize: 11, fontWeight: 700,
      fontFamily: "'Syne',sans-serif",
      background: active ? color : "transparent",
      color: active ? "#fff" : C.label,
      border: `1px solid ${active ? color : C.border}`,
      borderRadius: 6, cursor: "pointer", transition: "all 0.2s",
      textTransform: "uppercase", letterSpacing: 0.5
    }}>
      {children}
    </button>
  );
});

export default ScreenerFilters;
