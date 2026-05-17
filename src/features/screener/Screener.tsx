/**
 * Screener.tsx
 * 
 * Orchestrator component for the Stock Screener.
 * Responsibility: Wires Zustand stores (Market, Portfolio, Screener) to 
 * specialized sub-components and manages top-level table state (sort, page).
 */
import { useState, useMemo, useCallback, Fragment, memo } from "react";
import { useMarketStore } from "@/stores/market";
import { usePortfolioStore } from "@/stores/portfolio";
import { useScreenerStore } from "@/stores/screener";
import { C, PAGE_SIZE } from "./constants/tokens";
import "./screener.css";
import { useSparklines } from "./hooks/useSparklines";
import { useScreenerData, type SortKey, type Direction } from "./hooks/useScreenerData";
import ScreenerTableHeader from "./ScreenerTableHeader";
import ScreenerFilters from "./ScreenerFilters";
import ScreenerRow from "./ScreenerRow";

// ── Types ─────────────────────────────────────────────────────────────────

interface Props {
  onSelectTicker: (ticker: string) => void;
  activeWatchlistCategoryId?: number;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function Screener({ onSelectTicker, activeWatchlistCategoryId }: Readonly<Props>) {
  const quotes = useMarketStore(s => s.quotes);
  const indexData = useMarketStore(s => s.indexData);
  const addToWatchlist = usePortfolioStore(s => s.addToWatchlist);
  const watchlistCategories = usePortfolioStore(s => s.watchlistCategories);

  const { filters, activePreset, setPreset, setFilter, toggleGroupBySector, toggleColumn, resetFilters } = useScreenerStore();

  const [sort, setSort] = useState<{ key: SortKey; dir: Direction }>({ key: "volume", dir: "desc" });
  const [page, setPage] = useState(0);

  const sparkRef = useSparklines(quotes);

  const activeWatchlistTickers = useMemo(() => {
    const activeCategory = watchlistCategories.find(
      category => category.id === activeWatchlistCategoryId,
    ) ?? watchlistCategories[0];
    return new Set(activeCategory?.tickers.map(item => item.ticker) ?? []);
  }, [activeWatchlistCategoryId, watchlistCategories]);

  const {
    processed,
    grouped,
    rows,
    sectors,
    visibleCols,
    pageCount,
    activeFiltersCount
  } = useScreenerData({ quotes, indexData, filters, sort, page, pageSize: PAGE_SIZE });

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

  const renderRows = (quoteList: typeof rows) => quoteList.map(q => (
    <ScreenerRow 
      key={q.ticker} 
      q={q} 
      onSelectTicker={handleRowClick} 
      inWl={activeWatchlistTickers.has(q.ticker)}
      handleWatchlist={handleWatchlist}
      visibleColumns={visibleCols}
      spark={sparkRef.current[q.ticker] || []}
      isActive={activeTicker === q.ticker}
    />
  ));

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, overflow: "hidden", color: C.text }}>
      <ScreenerFilters 
        activePreset={activePreset}
        onSetPreset={setPreset}
        filters={filters}
        onSetFilter={setFilter}
        onToggleGroupBySector={toggleGroupBySector}
        onToggleColumn={toggleColumn}
        onResetFilters={resetFilters}
        activeFiltersCount={activeFiltersCount}
        sectors={sectors}
        stocksMatchedCount={processed.length}
      />

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
          <ScreenerTableHeader 
            visibleCols={visibleCols}
            sort={sort}
            onSort={toggleSort}
          />

          <tbody style={{ contentVisibility: "auto" } as any}>
            {filters.groupBySector && grouped ? (
              Object.entries(grouped).map(([sector, sectorQuotes]) => (
                <Fragment key={sector}>
                  <tr style={{ background: "rgba(0,168,255,0.08)" }}>
                    <td colSpan={visibleCols.length + 2} style={{ padding: "8px 16px", fontSize: 10, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${C.border}` }}>
                      {sector} — {sectorQuotes.length} stocks
                    </td>
                  </tr>
                  {renderRows(sectorQuotes as any)}
                </Fragment>
              ))
            ) : (
              renderRows(rows)
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

