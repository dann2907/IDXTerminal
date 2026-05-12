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
  bg:      "#070d1c",
  surface: "#0a1222",
  border:  "#0f2040",
  muted:   "#2a4060",
  label:   "#4a6080",
  text:    "#c8d8f0",
  up:      "#00d68f",
  dn:      "#ff4560",
  accent:  "#2e8fdf",
  warning: "#facc15",
};

const ALL_COLUMNS = [
  { id: "price",      label: "Last",    align: "right",  w: 80 },
  { id: "change_pct", label: "Chg%",    align: "right",  w: 80 },
  { id: "volume",     label: "Volume",  align: "right",  w: 90 },
  { id: "rvol",       label: "RVOL",    align: "right",  w: 60 },
  { id: "rs_rank",    label: "RS Rank", align: "right",  w: 60 },
  { id: "signals",    label: "Signals", align: "left",   w: 150 },
  { id: "high",       label: "High",    align: "right",  w: 72 },
  { id: "low",        label: "Low",     align: "right",  w: 72 },
  { id: "market_cap", label: "Mkt Cap", align: "right",  w: 90 },
  { id: "pe_ratio",   label: "P/E",     align: "right",  w: 60 },
  { id: "pbv_ratio",  label: "PBV",     align: "right",  w: 60 },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt  = (v: number) => v >= 1000 ? v.toLocaleString("id") : String(v);
const fmtV = (v: number) => {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(0)}Jt`;
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
  getSignals
}: { 
  q: QuoteData & { rvol: number, rs_rank: number }, 
  onSelectTicker: (ticker: string) => void,
  inWl: boolean,
  handleWatchlist: (e: React.MouseEvent, ticker: string) => void,
  visibleColumns: string[],
  spark: number[],
  getSignals: (q: any) => { label: string, color: string }[]
}) {
  const sym = q.ticker.replace(".JK", "");
  const signals = getSignals(q);
  
  return (
    <tr
      onClick={() => onSelectTicker(q.ticker)}
      style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#0d1a2e")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

      <td style={{ padding: "8px 12px", width: 110 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 60 }}>
            <span style={{ color: "#fff", fontWeight: 700, fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{sym}</span>
            <span style={{ color: C.label, fontSize: 8 }}>{q.name || "N/A"}</span>
          </div>
          <div style={{ width: 40, height: 16, opacity: 0.6 }}>
            <Sparkline data={spark} color={q.change_pct >= 0 ? C.up : C.dn} width={40} height={16} />
          </div>
        </div>
      </td>

      {visibleColumns.includes("price") && (
        <td style={{ padding: "8px 12px", textAlign: "right", color: C.text, fontFamily: "'Space Mono',monospace", width: 80 }}>{fmt(q.price)}</td>
      )}

      {visibleColumns.includes("change_pct") && (
        <td style={{ padding: "8px 12px", textAlign: "right", width: 80 }}>
          <span style={{
            display: "inline-block", padding: "2px 6px", borderRadius: 3,
            fontSize: 10, fontWeight: 700, fontFamily: "'Space Mono',monospace",
            background: q.change_pct >= 0 ? "rgba(0,214,143,0.12)" : "rgba(255,69,96,0.12)",
            color:      q.change_pct >= 0 ? C.up : C.dn,
          }}>
            {fmtPct(q.change_pct)}
          </span>
        </td>
      )}

      {visibleColumns.includes("volume") && (
        <td style={{ padding: "8px 12px", textAlign: "right", color: C.label, fontFamily: "'Space Mono',monospace", width: 90 }}>{fmtV(q.volume)}</td>
      )}

      {visibleColumns.includes("rvol") && (
        <td style={{ padding: "8px 12px", textAlign: "right", color: q.rvol > 1.5 ? C.warning : C.label, fontFamily: "'Space Mono',monospace", width: 60 }}>
          {q.rvol ? q.rvol.toFixed(1) : "—"}x
        </td>
      )}

      {visibleColumns.includes("rs_rank") && (
        <td style={{ padding: "8px 12px", textAlign: "right", color: q.rs_rank > 70 ? C.up : C.text, fontFamily: "'Space Mono',monospace", width: 60 }}>
          {q.rs_rank || "—"}
        </td>
      )}

      {visibleColumns.includes("signals") && (
        <td style={{ padding: "8px 12px", width: 150 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {signals.map(s => (
              <span key={s.label} style={{
                fontSize: 8, fontWeight: 800, padding: "1px 4px", borderRadius: 2,
                background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}44`
              }}>
                {s.label}
              </span>
            ))}
          </div>
        </td>
      )}

      {visibleColumns.includes("high") && (
        <td style={{ padding: "8px 12px", textAlign: "right", color: "#4a7050", fontFamily: "'Space Mono',monospace", width: 72 }}>{fmt(q.high)}</td>
      )}
      {visibleColumns.includes("low") && (
        <td style={{ padding: "8px 12px", textAlign: "right", color: "#704a4a", fontFamily: "'Space Mono',monospace", width: 72 }}>{fmt(q.low)}</td>
      )}

      {visibleColumns.includes("market_cap") && (
        <td style={{ padding: "8px 12px", textAlign: "right", color: C.label, fontFamily: "'Space Mono',monospace", width: 90 }}>{fmtRp(q.market_cap)}</td>
      )}
      {visibleColumns.includes("pe_ratio") && (
        <td style={{ padding: "8px 12px", textAlign: "right", color: C.text, fontFamily: "'Space Mono',monospace", width: 60 }}>{q.pe_ratio ? q.pe_ratio.toFixed(1) : "—"}</td>
      )}
      {visibleColumns.includes("pbv_ratio") && (
        <td style={{ padding: "8px 12px", textAlign: "right", color: C.text, fontFamily: "'Space Mono',monospace", width: 60 }}>{q.pbv_ratio ? q.pbv_ratio.toFixed(1) : "—"}</td>
      )}

      <td style={{ padding: "8px 12px", textAlign: "center", width: 50 }}>
        <button
          onClick={e => handleWatchlist(e, q.ticker)}
          style={{
            padding: "3px 8px", fontSize: 10,
            background: inWl ? `${C.accent}22` : "transparent",
            border: `1px solid ${inWl ? C.accent : C.muted}`,
            borderRadius: 3, color: inWl ? C.accent : C.muted,
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
      if (history[history.length - 1] !== q.price) {
        history.push(q.price);
        if (history.length > 20) history.shift();
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

    // Combined loop for efficiency (js-combine-iterations)
    const withMetrics = allQuotes.map(q => {
      const rvol = q.avg_volume ? q.volume / q.avg_volume : 0;
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
        if (search && !q.ticker.replace(".JK", "").includes(search)) return false;
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
  const toggleSort = useCallback((key: SortKey) => {
    setSort(s => s.key === key
      ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
      : { key, dir: key === "ticker" ? "asc" : "desc" }
    );
    setPage(0);
  }, []);

  const handleWatchlist = useCallback(async (e: React.MouseEvent, ticker: string) => {
    e.stopPropagation();
    await addToWatchlist(ticker, activeWatchlistCategoryId);
  }, [activeWatchlistCategoryId, addToWatchlist]);

  const getSignals = useCallback((q: typeof processed[0]) => {
    const signals = [];
    if (q.change_pct > 3 && q.volume > 5_000_000) signals.push({ label: "BREAKOUT", color: C.up });
    if (q.fifty_two_week_high && q.price >= q.fifty_two_week_high * 0.98) signals.push({ label: "NEAR ATH", color: C.accent });
    if (q.volume > 20_000_000) signals.push({ label: "HIGH VOL", color: C.warning });
    if (q.change_pct < -5) signals.push({ label: "OVERSOLD", color: C.dn });
    if (q.rvol > 2) signals.push({ label: "UNUSUAL VOL", color: C.warning });
    if (q.rs_rank > 80) signals.push({ label: "STRONG RS", color: C.up });
    return signals;
  }, []);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    Object.values(quotes).forEach(q => {
      if (q.sector) s.add(q.sector);
    });
    return ["All", ...Array.from(s).sort()];
  }, [quotes]);

  const visibleCols = useMemo(() => 
    ALL_COLUMNS.filter(c => (filters.visibleColumns || []).includes(c.id)).map(c => c.id),
  [filters.visibleColumns]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, overflow: "hidden" }}>

      {/* ── Preset Bar ──────────────────────────────────────────────── */}
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 6, flexWrap: "wrap", background: C.surface, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, flex: 1 }}>
          <PresetItem active={activePreset === "all"} onClick={() => setPreset("all")}>Semua</PresetItem>
          <PresetItem active={activePreset === "top_gainer"} onClick={() => setPreset("top_gainer")} color={C.up}>Top Gainer</PresetItem>
          <PresetItem active={activePreset === "top_loser"} onClick={() => setPreset("top_loser")} color={C.dn}>Top Loser</PresetItem>
          <PresetItem active={activePreset === "breakout"} onClick={() => setPreset("breakout")} color={C.up}>Breakout</PresetItem>
          <PresetItem active={activePreset === "high_vol"} onClick={() => setPreset("high_vol")} color={C.warning}>High Volume</PresetItem>
          <PresetItem active={activePreset === "near_ath"} onClick={() => setPreset("near_ath")} color={C.accent}>Near ATH</PresetItem>
        </div>

        <div style={{ position: "relative" }}>
          <button 
            onClick={() => setShowColPicker(!showColPicker)}
            style={{ padding: "4px 8px", borderRadius: 4, background: showColPicker ? C.accent : "transparent", border: `1px solid ${C.border}`, color: showColPicker ? "#fff" : C.label, cursor: "pointer" }}>
            <Settings2 size={14} />
          </button>
          
          {showColPicker && (
            <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 8, zIndex: 10, width: 140, boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: C.label, marginBottom: 6, textTransform: "uppercase" }}>Columns</div>
              {ALL_COLUMNS.map(col => (
                <div key={col.id} 
                  onClick={() => toggleColumn(col.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", cursor: "pointer", borderRadius: 3, background: (filters.visibleColumns || []).includes(col.id) ? "rgba(255,255,255,0.05)" : "transparent" }}>
                  <div style={{ width: 12, height: 12, border: `1px solid ${C.border}`, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", background: (filters.visibleColumns || []).includes(col.id) ? C.accent : "transparent" }}>
                    {(filters.visibleColumns || []).includes(col.id) && <Check size={10} color="#fff" />}
                  </div>
                  <span style={{ fontSize: 10, color: (filters.visibleColumns || []).includes(col.id) ? C.text : C.label }}>{col.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────── */}
      <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>

        {/* Search */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={LABEL_STYLE}>TICKER</label>
          <input
            placeholder="Cari..."
            value={filters.search}
            onChange={e => setFilter("search", e.target.value.toUpperCase())}
            style={{ ...INPUT_STYLE, width: 80 }}
          />
        </div>

        {/* Change% */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={LABEL_STYLE}>CHG%</label>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input placeholder="Min" value={filters.minChg} onChange={e => setFilter("minChg", e.target.value)} style={{ ...INPUT_STYLE, width: 45 }} />
            <input placeholder="Max" value={filters.maxChg} onChange={e => setFilter("maxChg", e.target.value)} style={{ ...INPUT_STYLE, width: 45 }} />
          </div>
        </div>

        {/* Volume */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={LABEL_STYLE}>VOL ≥ (JT)</label>
          <input placeholder="Juta" value={filters.minVol} onChange={e => setFilter("minVol", e.target.value)} style={{ ...INPUT_STYLE, width: 60 }} />
        </div>

        {/* Price */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={LABEL_STYLE}>PRICE</label>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input placeholder="Min" value={filters.minPrice} onChange={e => setFilter("minPrice", e.target.value)} style={{ ...INPUT_STYLE, width: 55 }} />
            <input placeholder="Max" value={filters.maxPrice} onChange={e => setFilter("maxPrice", e.target.value)} style={{ ...INPUT_STYLE, width: 55 }} />
          </div>
        </div>

        {/* Sector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={LABEL_STYLE}>SECTOR</label>
          <select 
            value={filters.sector}
            onChange={e => setFilter("sector", e.target.value)}
            style={{ ...INPUT_STYLE, width: 120, height: 23, padding: "0 4px" }}>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Grouping Toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={LABEL_STYLE}>GROUPING</label>
          <button 
            onClick={toggleGroupBySector}
            style={{
              ...INPUT_STYLE, width: 90, cursor: "pointer",
              background: filters.groupBySector ? `${C.accent}22` : "#040d1a",
              color: filters.groupBySector ? C.accent : C.text,
              border: `1px solid ${filters.groupBySector ? C.accent : C.border}`
            }}>
            {filters.groupBySector ? "ON (Sector)" : "OFF"}
          </button>
        </div>

        {/* Reset */}
        <button onClick={resetFilters} style={{ ...RESET_BTN, marginTop: 14 }}>Reset</button>

        {/* Count */}
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 14, color: C.text, fontWeight: 700, fontFamily: "'Space Mono',monospace" }}>{processed.length}</div>
          <div style={{ fontSize: 8, color: C.label }}>MATCHES</div>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1, background: C.surface }}>
            <tr>
              <th onClick={() => toggleSort("ticker")}
                style={{
                  padding: "8px 12px", textAlign: "left",
                  fontFamily: "'Syne',sans-serif", fontSize: 9, letterSpacing: 1,
                  color: sort.key === "ticker" ? C.accent : C.label,
                  fontWeight: 600, whiteSpace: "nowrap",
                  cursor: "pointer",
                  borderBottom: `1px solid ${C.border}`,
                  width: 110, minWidth: 110,
                  userSelect: "none",
                }}>
                Symbol
                {sort.key === "ticker" && <span style={{ marginLeft: 3 }}>{sort.dir === "asc" ? "▲" : "▼"}</span>}
              </th>

              {ALL_COLUMNS.filter(c => (filters.visibleColumns || []).includes(c.id)).map(col => (
                <th key={col.id}
                  onClick={() => toggleSort(col.id as SortKey)}
                  style={{
                    padding: "8px 12px", textAlign: col.align as any,
                    fontFamily: "'Syne',sans-serif", fontSize: 9, letterSpacing: 1,
                    color: sort.key === col.id ? C.accent : C.label,
                    fontWeight: 600, whiteSpace: "nowrap",
                    cursor: "pointer",
                    borderBottom: `1px solid ${C.border}`,
                    width: col.w, minWidth: col.w,
                    userSelect: "none",
                  }}>
                  {col.label}
                  {sort.key === col.id && <span style={{ marginLeft: 3 }}>{sort.dir === "asc" ? "▲" : "▼"}</span>}
                </th>
              ))}

              <th style={{
                padding: "8px 12px", textAlign: "center",
                fontFamily: "'Syne',sans-serif", fontSize: 9, letterSpacing: 1,
                color: C.label,
                fontWeight: 600, whiteSpace: "nowrap",
                borderBottom: `1px solid ${C.border}`,
                width: 50, minWidth: 50,
                userSelect: "none",
              }}>
                Action
              </th>
            </tr>
          </thead>

          <tbody style={{ contentVisibility: "auto" } as any}>
            {filters.groupBySector && grouped ? (
              Object.entries(grouped).map(([sector, sectorQuotes]) => (
                <Fragment key={sector}>
                  <tr style={{ background: "rgba(46,143,223,0.05)" }}>
                    <td colSpan={visibleCols.length + 2} style={{ padding: "4px 12px", fontSize: 8, fontWeight: 800, color: C.accent, textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>
                      {sector} ({sectorQuotes.length})
                    </td>
                  </tr>
                  {sectorQuotes.map(q => (
                    <ScreenerRow 
                      key={q.ticker} 
                      q={q} 
                      onSelectTicker={onSelectTicker} 
                      inWl={activeWatchlistTickers.has(q.ticker)}
                      handleWatchlist={handleWatchlist}
                      visibleColumns={visibleCols}
                      spark={sparkRef.current[q.ticker] || []}
                      getSignals={getSignals}
                    />
                  ))}
                </Fragment>
              ))
            ) : (
              rows.map(q => (
                <ScreenerRow 
                  key={q.ticker} 
                  q={q} 
                  onSelectTicker={onSelectTicker} 
                  inWl={activeWatchlistTickers.has(q.ticker)}
                  handleWatchlist={handleWatchlist}
                  visibleColumns={visibleCols}
                  spark={sparkRef.current[q.ticker] || []}
                  getSignals={getSignals}
                />
              ))
            )}
            
            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length + 2} style={{ padding: "40px 16px", textAlign: "center", color: C.muted, fontSize: 11 }}>
                  {Object.keys(quotes).length === 0
                    ? "Menunggu data WS..."
                    : "Tidak ada saham yang cocok dengan filter"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {pageCount > 1 && (
        <div style={{ padding: "8px 12px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 6, alignItems: "center", background: C.surface }}>
          <span style={{ fontSize: 9, color: C.label }}>HAL {page + 1} DARI {pageCount}</span>
          <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>
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

const PresetItem = memo(function PresetItem({ children, active, color = C.label, onClick }: {
  children: React.ReactNode; active: boolean; color?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 12px", fontSize: 10, fontWeight: 700,
      fontFamily: "'Syne',sans-serif",
      background: active ? `${color}22` : "transparent",
      color: active ? color : C.label,
      border: `1px solid ${active ? color : C.border}`,
      borderRadius: 4, cursor: "pointer", transition: "all .2s"
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
      padding: "4px 10px", fontSize: 8, fontWeight: 700,
      fontFamily: "'Space Mono',monospace",
      border: `1px solid ${C.border}`,
      borderRadius: 3, background: "transparent",
      color: disabled ? C.muted : C.text,
      cursor: disabled ? "default" : "pointer",
    }}>
      {children}
    </button>
  );
});

// ── Inline styles ──────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background:   "#040d1a",
  border:       `1px solid ${C.border}`,
  borderRadius: 3,
  color:        C.text,
  fontFamily:   "'Space Mono',monospace",
  fontSize:     11,
  padding:      "4px 8px",
  outline:      "none",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize:   8,
  color:      C.label,
  fontFamily: "'Syne',sans-serif",
  letterSpacing: 1,
  fontWeight: 700,
};

const RESET_BTN: React.CSSProperties = {
  padding:    "4px 12px", fontSize: 9,
  fontFamily: "'Syne',sans-serif",
  fontWeight: 700,
  border:     `1px solid ${C.border}`,
  borderRadius: 3, background: "transparent",
  color:      C.label, cursor: "pointer",
};
