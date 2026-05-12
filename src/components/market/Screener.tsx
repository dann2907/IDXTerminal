import { useState, useMemo, useCallback, useRef, useEffect, Fragment, memo } from "react";
import { useMarketStore, type QuoteData } from "../../stores/useMarketStore";
import { usePortfolioStore } from "../../stores/usePortfolioStore";
import { useScreenerStore, type PresetType } from "../../stores/useScreenerStore";
import Sparkline from "../../features/dashboard/Sparkline";
import { Settings2, Check } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

type SortKey = "ticker" | "price" | "change" | "change_pct" | "volume" | "high" | "low" | "market_cap" | "pe_ratio" | "pbv_ratio" | "rvol" | "rs_rank";
type Direction = "asc" | "desc";

interface Props {
  onSelectTicker: (ticker: string) => void;
  activeWatchlistCategoryId?: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const C = {
  bg:      "#1A1D29",
  surface: "#242736",
  border:  "#2d3142",
  muted:   "#4a6080",
  label:   "#A0A0A0",
  text:    "#E5E5E5",
  up:      "#00D66F",
  dn:      "#FF4D4D",
  accent:  "#00A8FF",
  warning: "#facc15",
  white:   "#FFFFFF",
};

const ALL_COLUMNS = [
  { id: "price",      label: "Last",      align: "right",  w: 90 },
  { id: "sparkline",  label: "Trend",     align: "center", w: 90 },
  { id: "change_pct", label: "Chg%",      align: "right",  w: 80 },
  { id: "volume",     label: "Volume",    align: "right",  w: 120 },
  { id: "range",      label: "Day Range", align: "center", w: 130 },
  { id: "rvol",       label: "RVOL",      align: "right",  w: 60 },
  { id: "rs_rank",    label: "RS Rank",   align: "right",  w: 60 },
  { id: "signals",    label: "Signals",   align: "left",   w: 130 },
  { id: "market_cap", label: "Mkt Cap",   align: "right",  w: 90 },
  { id: "pe_ratio",   label: "P/E",       align: "right",  w: 60 },
  { id: "pbv_ratio",  label: "PBV",       align: "right",  w: 60 },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt  = (v: number) => v >= 1000 ? v.toLocaleString("id") : String(v);
const fmtV = (v: number) => {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}Jt`;
  if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}Rb`;
  return String(v);
};
const fmtRp = (v: number | undefined): string => {
  if (v === undefined || v === 0) return "—";
  if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}T`;
  if (v >= 1_000_000_000)     return `${(v / 1_000_000_000).toFixed(1)}M`;
  return fmt(v);
};
const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

function parseNum(s: string): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : n;
}

// ── Sub-components (Extracted for performance) ─────────────────────────────

const ScreenerRow = memo(function ScreenerRow({ 
  q, 
  onSelectTicker, 
  inWl, 
  handleWatchlist, 
  visibleColumns,
  spark,
  getSignals,
  isActive
}: { 
  q: QuoteData & { rvol: number, rs_rank: number }, 
  onSelectTicker: (ticker: string) => void,
  inWl: boolean,
  handleWatchlist: (e: React.MouseEvent, ticker: string) => void,
  visibleColumns: string[],
  spark: number[],
  getSignals: (q: any) => { label: string, color: string } | null,
  isActive: boolean
}) {
  const sym = q.ticker.replace(".JK", "");
  const signal = getSignals(q);
  
  // Range calculation
  const range = q.high - q.low;
  const pos = range > 0 ? ((q.price - q.low) / range) * 100 : 50;

  // Vol bar color
  const volColor = q.rvol >= 1.5 ? C.up : (q.rvol < 0.5 ? C.dn : C.label);

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

// ── Component ──────────────────────────────────────────────────────────────

export default function Screener({ onSelectTicker, activeWatchlistCategoryId }: Props) {
  const quotes = useMarketStore(s => s.quotes);
  const indexData = useMarketStore(s => s.indexData);
  const addToWatchlist = usePortfolioStore(s => s.addToWatchlist);
  const watchlistCategories = usePortfolioStore(s => s.watchlistCategories);

  const { filters, activePreset, setPreset, setFilter, toggleGroupBySector, toggleColumn, resetFilters } = useScreenerStore();

  const [sort, setSort] = useState<{ key: SortKey; dir: Direction }>({ key: "volume", dir: "desc" });
  const [page, setPage] = useState(0);
  const [showColPicker, setShowColPicker] = useState(false);

  const sparkRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    Object.keys(quotes).forEach(ticker => {
      const q = quotes[ticker];
      if (!q) return;
      if (!sparkRef.current[ticker]) sparkRef.current[ticker] = [];
      const history = sparkRef.current[ticker];
      if (history.length === 0 || history[history.length - 1] !== q.price) {
        history.push(q.price);
        if (history.length > 30) history.shift();
      }
    });
  }, [quotes]);

  const activeWatchlistTickers = useMemo(() => {
    const activeCategory = watchlistCategories.find(
      category => category.id === activeWatchlistCategoryId,
    ) ?? watchlistCategories[0];
    return new Set(activeCategory?.tickers.map(item => item.ticker) ?? []);
  }, [activeWatchlistCategoryId, watchlistCategories]);

  // ── Advanced Metrics + Filter + Sort ──────────────────────────────
  const processed = useMemo(() => {
    const allQuotes = Object.values(quotes);
    const ihsgPct = indexData?.change_pct ?? 0;

    // Combined loop for efficiency
    const withMetrics = allQuotes.map(q => {
      const rvol = q.avg_volume && q.avg_volume > 0 ? q.volume / q.avg_volume : 1.0;
      const rs_score = q.change_pct - ihsgPct;
      return { ...q, rvol, rs_score };
    });

    // RS Ranking needs full dataset sort
    const ranked = [...withMetrics].sort((a, b) => b.rs_score - a.rs_score);
    const rsRankMap = new Map<string, number>();
    const total = ranked.length || 1;
    ranked.forEach((q, i) => {
      rsRankMap.set(q.ticker, Math.round(((total - i) / total) * 100));
    });

    const minChg   = parseNum(filters.minChg);
    const maxChg   = parseNum(filters.maxChg);
    const minVol   = parseNum(filters.minVol);
    const minPrice = parseNum(filters.minPrice);
    const maxPrice = parseNum(filters.maxPrice);
    const minPE    = parseNum(filters.minPE);
    const maxPE    = parseNum(filters.maxPE);
    const search   = filters.search.trim().toUpperCase();

    // Final filter pass
    return withMetrics
      .map(q => ({ ...q, rs_rank: rsRankMap.get(q.ticker) ?? 0 }))
      .filter(q => {
        const sym = q.ticker.replace(".JK", "");
        if (search && !sym.includes(search)) return false;
        if (filters.liveOnly && !q.is_live) return false;
        if (minChg !== null && q.change_pct < minChg) return false;
        if (maxChg !== null && q.change_pct > maxChg) return false;
        if (minVol !== null && q.volume < minVol * 1_000_000) return false;
        if (minPrice !== null && q.price < minPrice) return false;
        if (maxPrice !== null && q.price > maxPrice) return false;
        if (filters.sector !== "All" && q.sector !== filters.sector) return false;
        if (minPE !== null && (q.pe_ratio === undefined || q.pe_ratio < minPE)) return false;
        if (maxPE !== null && (q.pe_ratio === undefined || q.pe_ratio > maxPE)) return false;
        return true;
      });
  }, [quotes, filters, indexData]);

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    return [...processed].sort((a, b) => {
      const va = key === "ticker" ? a.ticker : ((a[key as keyof typeof a] as number) ?? 0);
      const vb = key === "ticker" ? b.ticker : ((b[key as keyof typeof b] as number) ?? 0);
      if (va < vb) return dir === "asc" ? -1 : 1;
      if (va > vb) return dir === "asc" ?  1 : -1;
      return 0;
    });
  }, [processed, sort]);

  // ── Grouping Logic ─────────────────────────────────────────────────
  const grouped = useMemo(() => {
    if (!filters.groupBySector) return null;
    const groups: Record<string, typeof processed[0][]> = {};
    sorted.forEach(q => {
      const s = q.sector || "Unknown";
      if (!groups[s]) groups[s] = [];
      groups[s].push(q);
    });
    return groups;
  }, [sorted, filters.groupBySector]);

  const pageCount = Math.ceil(sorted.length / PAGE_SIZE);
  const rows      = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Handlers ─────────────────────────────────────────────────────────
  const [activeTicker, setActiveTicker] = useState<string | null>(null);

  const toggleSort = useCallback((key: SortKey) => {
    setSort(s => s.key === key
      ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
      : { key, dir: key === "ticker" ? "asc" : "desc" }
    );
    setPage(0);
  }, []);

  const handleRowClick = useCallback((ticker: string) => {
    setActiveTicker(ticker);
    onSelectTicker(ticker);
  }, [onSelectTicker]);

  const handleWatchlist = useCallback(async (e: React.MouseEvent, ticker: string) => {
    e.stopPropagation();
    await addToWatchlist(ticker, activeWatchlistCategoryId);
  }, [activeWatchlistCategoryId, addToWatchlist]);

  const getSignals = useCallback((q: typeof processed[0]) => {
    if (q.change_pct < -5) return { label: "OVERSOLD", color: C.dn };
    if (q.rvol > 2.0) return { label: "UNUSUAL VOL", color: C.accent };
    if (q.change_pct > 3 && q.volume > 5_000_000) return { label: "BREAKOUT", color: C.accent };
    if (q.rs_rank > 85) return { label: "STRONG RS", color: C.accent };
    if (q.fifty_two_week_high && q.price >= q.fifty_two_week_high * 0.98) return { label: "NEAR ATH", color: C.accent };
    return null;
  }, []);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    Object.values(quotes).forEach(q => {
      if (q.sector) s.add(q.sector);
    });
    return ["All", ...Array.from(s).sort()];
  }, [quotes]);

  const visibleCols = useMemo(() => {
    return ALL_COLUMNS.filter(c => (filters.visibleColumns || []).includes(c.id)).map(c => c.id);
  }, [filters.visibleColumns]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.minChg || filters.maxChg) count++;
    if (filters.minVol) count++;
    if (filters.minPrice || filters.maxPrice) count++;
    if (filters.sector !== "All") count++;
    return count;
  }, [filters]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, overflow: "hidden", color: C.text }}>
      <style>{`
        .screener-row:hover {
          background: rgba(255,255,255, 0.05) !important;
        }
        .screener-row:hover .ticker-sym {
          color: ${C.accent} !important;
        }
        .screener-row.active {
          background: rgba(0,168,255, 0.15) !important;
          border-left: 3px solid ${C.accent} !important;
        }
        .screener-row.active .ticker-sym {
          font-weight: 700 !important;
          color: ${C.white} !important;
        }
        .screener-row .watchlist-btn {
          visibility: hidden;
        }
        .screener-row:hover .watchlist-btn, .screener-row.active .watchlist-btn {
          visibility: visible;
        }
        .watchlist-btn:hover {
          border-color: ${C.accent} !important;
          color: ${C.accent} !important;
        }
      `}</style>

      {/* ── Preset Bar ──────────────────────────────────────────────── */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, flexWrap: "wrap", background: C.surface, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, flex: 1 }}>
          <PresetItem active={activePreset === "all"} onClick={() => setPreset("all")}>Semua</PresetItem>
          <PresetItem active={activePreset === "top_gainer"} onClick={() => setPreset("top_gainer")} color={C.up}>Top Gainer</PresetItem>
          <PresetItem active={activePreset === "top_loser"} onClick={() => setPreset("top_loser")} color={C.dn}>Top Loser</PresetItem>
          <PresetItem active={activePreset === "breakout"} onClick={() => setPreset("breakout")} color={C.accent}>Breakout</PresetItem>
          <PresetItem active={activePreset === "high_vol"} onClick={() => setPreset("high_vol")} color={C.accent}>High Volume</PresetItem>
        </div>

        <div style={{ position: "relative" }}>
          <button 
            onClick={() => setShowColPicker(!showColPicker)}
            style={{ 
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 10px", borderRadius: 4, 
              background: showColPicker ? C.accent : "transparent", 
              border: `1px solid ${C.border}`, 
              color: showColPicker ? "#fff" : C.label, 
              cursor: "pointer",
              fontSize: 11, fontWeight: 600
            }}>
            <Settings2 size={14} />
            COLUMNS
          </button>
          
          {showColPicker && (
            <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 8, background: "#1f222f", border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, zIndex: 20, width: 160, boxShadow: "0 15px 35px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: C.label, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Display Columns</div>
              {ALL_COLUMNS.map(col => (
                <div key={col.id} 
                  onClick={() => toggleColumn(col.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", cursor: "pointer", borderRadius: 4, transition: "background 0.2s", background: (filters.visibleColumns || []).includes(col.id) ? "rgba(255,255,255,0.05)" : "transparent" }}>
                  <div style={{ width: 14, height: 14, border: `1px solid ${C.border}`, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", background: (filters.visibleColumns || []).includes(col.id) ? C.accent : "transparent" }}>
                    {(filters.visibleColumns || []).includes(col.id) && <Check size={10} color="#fff" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: 12, color: (filters.visibleColumns || []).includes(col.id) ? "#fff" : C.label, fontWeight: (filters.visibleColumns || []).includes(col.id) ? 600 : 400 }}>{col.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────── */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>

        {/* Search */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={LABEL_STYLE}>TICKER</label>
          <input
            placeholder="Cari..."
            value={filters.search}
            onChange={e => setFilter("search", e.target.value.toUpperCase())}
            style={{ ...INPUT_STYLE, width: 100 }}
          />
        </div>

        {/* Change% */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={LABEL_STYLE}>CHG% RANGE</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input placeholder="Min" value={filters.minChg} onChange={e => setFilter("minChg", e.target.value)} style={{ ...INPUT_STYLE, width: 55 }} />
            <span style={{ color: C.label, fontSize: 10 }}>—</span>
            <input placeholder="Max" value={filters.maxChg} onChange={e => setFilter("maxChg", e.target.value)} style={{ ...INPUT_STYLE, width: 55 }} />
          </div>
        </div>

        {/* Volume */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={LABEL_STYLE}>MIN VOL (JT)</label>
          <input placeholder="Juta" value={filters.minVol} onChange={e => setFilter("minVol", e.target.value)} style={{ ...INPUT_STYLE, width: 70 }} />
        </div>

        {/* Price */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={LABEL_STYLE}>PRICE RANGE</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input placeholder="Min" value={filters.minPrice} onChange={e => setFilter("minPrice", e.target.value)} style={{ ...INPUT_STYLE, width: 65 }} />
            <span style={{ color: C.label, fontSize: 10 }}>—</span>
            <input placeholder="Max" value={filters.maxPrice} onChange={e => setFilter("maxPrice", e.target.value)} style={{ ...INPUT_STYLE, width: 65 }} />
          </div>
        </div>

        {/* Sector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={LABEL_STYLE}>SECTOR</label>
          <select 
            value={filters.sector}
            onChange={e => setFilter("sector", e.target.value)}
            style={{ ...INPUT_STYLE, width: 140, height: 28, padding: "0 8px" }}>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Grouping Toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={LABEL_STYLE}>VIEW</label>
          <button 
            onClick={toggleGroupBySector}
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
          <button onClick={resetFilters} style={{ ...RESET_BTN, marginTop: 18 }}>Clear All</button>
        )}

        {/* Count */}
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 18, color: "#fff", fontWeight: 700, fontFamily: "'Space Mono',monospace", lineHeight: 1 }}>{processed.length}</div>
          <div style={{ fontSize: 9, color: C.label, fontWeight: 700, letterSpacing: 0.5, marginTop: 4 }}>STOCKS MATCHED</div>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 10, background: C.surface, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
            <tr>
              <th onClick={() => toggleSort("ticker")}
                style={{
                  padding: "12px 16px", textAlign: "left",
                  fontFamily: "'Syne',sans-serif", fontSize: 11, letterSpacing: 1,
                  color: sort.key === "ticker" ? C.accent : C.label,
                  fontWeight: 700, whiteSpace: "nowrap",
                  cursor: "pointer",
                  borderBottom: `2px solid ${C.border}`,
                  width: 110, minWidth: 110,
                  userSelect: "none",
                  textTransform: "uppercase"
                }}>
                Symbol
                {sort.key === "ticker" && <span style={{ marginLeft: 6 }}>{sort.dir === "asc" ? "▲" : "▼"}</span>}
              </th>

              {ALL_COLUMNS.filter(c => (filters.visibleColumns || []).includes(c.id)).map(col => (
                <th key={col.id}
                  onClick={() => toggleSort(col.id as SortKey)}
                  style={{
                    padding: "12px 16px", textAlign: col.align as any,
                    fontFamily: "'Syne',sans-serif", fontSize: 11, letterSpacing: 1,
                    color: sort.key === col.id ? C.accent : C.label,
                    fontWeight: 700, whiteSpace: "nowrap",
                    cursor: "pointer",
                    borderBottom: `2px solid ${C.border}`,
                    width: col.w, minWidth: col.w,
                    userSelect: "none",
                    textTransform: "uppercase"
                  }}>
                  {col.label}
                  {sort.key === col.id && <span style={{ marginLeft: 6 }}>{sort.dir === "asc" ? "▲" : "▼"}</span>}
                </th>
              ))}

              <th style={{
                padding: "12px 16px", textAlign: "center",
                fontFamily: "'Syne',sans-serif", fontSize: 11, letterSpacing: 1,
                color: C.label,
                fontWeight: 700, whiteSpace: "nowrap",
                borderBottom: `2px solid ${C.border}`,
                width: 50, minWidth: 50,
                userSelect: "none",
                textTransform: "uppercase"
              }}>
                Action
              </th>
            </tr>
          </thead>

          <tbody style={{ contentVisibility: "auto" } as any}>
            {filters.groupBySector && grouped ? (
              Object.entries(grouped).map(([sector, sectorQuotes]) => (
                <Fragment key={sector}>
                  <tr style={{ background: "rgba(0,168,255,0.08)" }}>
                    <td colSpan={visibleCols.length + 2} style={{ padding: "8px 16px", fontSize: 10, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${C.border}` }}>
                      {sector} — {sectorQuotes.length} stocks
                    </td>
                  </tr>
                  {sectorQuotes.map(q => (
                    <ScreenerRow 
                      key={q.ticker} 
                      q={q} 
                      onSelectTicker={handleRowClick} 
                      inWl={activeWatchlistTickers.has(q.ticker)}
                      handleWatchlist={handleWatchlist}
                      visibleColumns={visibleCols}
                      spark={sparkRef.current[q.ticker] || []}
                      getSignals={getSignals}
                      isActive={activeTicker === q.ticker}
                    />
                  ))}
                </Fragment>
              ))
            ) : (
              rows.map(q => (
                <ScreenerRow 
                  key={q.ticker} 
                  q={q} 
                  onSelectTicker={handleRowClick} 
                  inWl={activeWatchlistTickers.has(q.ticker)}
                  handleWatchlist={handleWatchlist}
                  visibleColumns={visibleCols}
                  spark={sparkRef.current[q.ticker] || []}
                  getSignals={getSignals}
                  isActive={activeTicker === q.ticker}
                />
              ))
            )}
            
            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length + 2} style={{ padding: "80px 16px", textAlign: "center", color: C.muted, fontSize: 14 }}>
                  <div style={{ fontWeight: 600, color: C.label, marginBottom: 8 }}>
                    {Object.keys(quotes).length === 0
                      ? "Waiting for WebSocket data stream..."
                      : "No matching stocks found for current criteria"}
                  </div>
                  <button onClick={resetFilters} style={{ color: C.accent, background: "transparent", border: "none", textDecoration: "underline", cursor: "pointer", fontSize: 12 }}>Reset all filters</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {pageCount > 1 && (
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 12, alignItems: "center", background: C.surface }}>
          <span style={{ fontSize: 11, color: C.label, fontWeight: 600, letterSpacing: 0.5 }}>PAGE {page + 1} OF {pageCount}</span>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <PageBtn disabled={page === 0} onClick={() => setPage(0)}>FIRST</PageBtn>
            <PageBtn disabled={page === 0} onClick={() => setPage(p => p - 1)}>PREV</PageBtn>
            <PageBtn disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>NEXT</PageBtn>
            <PageBtn disabled={page >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>LAST</PageBtn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared UI Sub-components ───────────────────────────────────────────────

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

const PageBtn = memo(function PageBtn({ children, onClick, disabled = false }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "6px 12px", fontSize: 10, fontWeight: 700,
      fontFamily: "'Space Mono',monospace",
      border: `1px solid ${C.border}`,
      borderRadius: 4, background: "#11141d",
      color: disabled ? C.muted : C.text,
      cursor: disabled ? "default" : "pointer",
      transition: "border-color 0.2s"
    }}
    onMouseEnter={e => !disabled && (e.currentTarget.style.borderColor = C.accent)}
    onMouseLeave={e => !disabled && (e.currentTarget.style.borderColor = C.border)}>
      {children}
    </button>
  );
});

// ── Inline styles ──────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background:   "#11141d",
  border:       `1px solid ${C.border}`,
  borderRadius: 4,
  color:        "#fff",
  fontFamily:   "'Space Mono',monospace",
  fontSize:     12,
  padding:      "6px 10px",
  outline:      "none",
  transition:   "border-color 0.2s",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize:   9,
  color:      "#A0A0A0",
  fontFamily: "'Syne',sans-serif",
  letterSpacing: 1,
  fontWeight: 800,
  textTransform: "uppercase"
};

const RESET_BTN: React.CSSProperties = {
  padding:    "6px 14px", fontSize: 11,
  fontFamily: "'Syne',sans-serif",
  fontWeight: 700,
  border:     `1px solid ${C.border}`,
  borderRadius: 4, background: "transparent",
  color:      C.accent, cursor: "pointer",
  textTransform: "uppercase"
};
