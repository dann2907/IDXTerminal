import { useMemo } from "react";
import type { QuoteData } from "../../../../stores/useMarketStore";
import { ALL_COLUMNS } from "../constants/tokens";
import { parseNum } from "../utils/formatters";

export type SortKey = "ticker" | "price" | "change" | "change_pct" | "volume" | "high" | "low" | "market_cap" | "pe_ratio" | "pbv_ratio" | "rvol" | "rs_rank";
export type Direction = "asc" | "desc";

interface UseScreenerDataProps {
  quotes: Record<string, QuoteData>;
  indexData: { change_pct: number } | null;
  filters: any;
  sort: { key: SortKey; dir: Direction };
  page: number;
  pageSize: number;
}

export function useScreenerData({ quotes, indexData, filters, sort, page, pageSize }: UseScreenerDataProps) {
  const processed = useMemo(() => {
    const allQuotes = Object.values(quotes);
    const ihsgPct = indexData?.change_pct ?? 0;

    // Combined loop for efficiency
    const withMetrics = allQuotes.map(q => {
      const rvol = q.avg_volume && q.avg_volume > 0 ? q.volume / q.avg_volume : 1;
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

  const sectors = useMemo(() => {
    const s = new Set<string>();
    Object.values(quotes).forEach(q => {
      if (q.sector) s.add(q.sector);
    });
    return ["All", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
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

  const pageCount = Math.ceil(sorted.length / pageSize);
  const rows      = sorted.slice(page * pageSize, (page + 1) * pageSize);

  return {
    processed,
    sorted,
    grouped,
    sectors,
    visibleCols,
    activeFiltersCount,
    pageCount,
    rows
  };
}
