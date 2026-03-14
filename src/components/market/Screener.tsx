// src/components/market/Screener.tsx
//
// Stock Screener — filter & sort seluruh quotes dari WS cache.
// Tidak ada fetch ke backend; data dari useMarketStore(quotes).
//
// Filter:
//   - Ticker search (substring)
//   - Preset arah: All / Gainer / Loser / Flat
//   - Min change%  / Max change%
//   - Min volume (juta lembar)
//   - Min price   / Max price
//   - Hanya live (is_live)
//
// Sort: klik header kolom, klik lagi untuk balik arah.
//
// Hasil > 200 baris dipaginasi 50/halaman agar DOM tidak terlalu besar.
//
// Props:
//   onSelectTicker — callback saat user klik baris (navigasi ke chart)

import { useState, useMemo, useCallback } from "react";
import { useMarketStore, type QuoteData } from "../../stores/useMarketStore";
import { usePortfolioStore } from "../../stores/usePortfolioStore";

// ── Types ─────────────────────────────────────────────────────────────────

type SortKey = "ticker" | "price" | "change" | "change_pct" | "volume" | "high" | "low";
type Direction = "asc" | "desc";
type Preset = "all" | "gainer" | "loser" | "flat";

interface Filters {
  search:    string;
  preset:    Preset;
  minChg:    string;
  maxChg:    string;
  minVol:    string;   // dalam juta lembar
  minPrice:  string;
  maxPrice:  string;
  liveOnly:  boolean;
}

interface Props {
  onSelectTicker: (ticker: string) => void;
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
};

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt  = (v: number) => v >= 1000 ? v.toLocaleString("id") : String(v);
const fmtV = (v: number) => {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(0)}Jt`;
  if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}Rb`;
  return String(v);
};
const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : n;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function Screener({ onSelectTicker }: Props) {
  const quotes         = useMarketStore(s => s.quotes);
  const addToWatchlist = usePortfolioStore(s => s.addToWatchlist);
  const watchlist      = usePortfolioStore(s => s.watchlist);

  const [sort, setSort]       = useState<{ key: SortKey; dir: Direction }>({ key: "volume", dir: "desc" });
  const [page, setPage]       = useState(0);
  const [filters, setFilters] = useState<Filters>({
    search: "", preset: "all",
    minChg: "", maxChg: "",
    minVol: "", minPrice: "", maxPrice: "",
    liveOnly: false,
  });

  // ── Filter + Sort (useMemo — bisa 700+ baris) ────────────────────────
  const filtered = useMemo(() => {
    const minChg   = parseNum(filters.minChg);
    const maxChg   = parseNum(filters.maxChg);
    const minVol   = parseNum(filters.minVol);   // juta lembar
    const minPrice = parseNum(filters.minPrice);
    const maxPrice = parseNum(filters.maxPrice);
    const search   = filters.search.trim().toUpperCase();

    return Object.values(quotes).filter(q => {
      if (search && !q.ticker.replace(".JK", "").includes(search)) return false;
      if (filters.liveOnly && !q.is_live) return false;
      if (filters.preset === "gainer" && q.change_pct <= 0) return false;
      if (filters.preset === "loser"  && q.change_pct >= 0) return false;
      if (filters.preset === "flat"   && q.change_pct !== 0) return false;
      if (minChg   !== null && q.change_pct < minChg)           return false;
      if (maxChg   !== null && q.change_pct > maxChg)           return false;
      if (minVol   !== null && q.volume < minVol * 1_000_000)   return false;
      if (minPrice !== null && q.price < minPrice)               return false;
      if (maxPrice !== null && q.price > maxPrice)               return false;
      return true;
    });
  }, [quotes, filters]);

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    return [...filtered].sort((a, b) => {
      const va = key === "ticker" ? a.ticker : (a[key] as number);
      const vb = key === "ticker" ? b.ticker : (b[key] as number);
      if (va < vb) return dir === "asc" ? -1 : 1;
      if (va > vb) return dir === "asc" ?  1 : -1;
      return 0;
    });
  }, [filtered, sort]);

  const pageCount = Math.ceil(sorted.length / PAGE_SIZE);
  const rows      = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Handlers ─────────────────────────────────────────────────────────
  const setFilter = useCallback(<K extends keyof Filters>(k: K, v: Filters[K]) => {
    setFilters(f => ({ ...f, [k]: v }));
    setPage(0);
  }, []);

  const toggleSort = useCallback((key: SortKey) => {
    setSort(s => s.key === key
      ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
      : { key, dir: key === "ticker" ? "asc" : "desc" }
    );
    setPage(0);
  }, []);

  const handleWatchlist = useCallback(async (e: React.MouseEvent, ticker: string) => {
    e.stopPropagation();
    await addToWatchlist(ticker);
  }, [addToWatchlist]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, overflow: "hidden" }}>

      {/* ── Filter Bar ──────────────────────────────────────────────── */}
      <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>

        {/* Ticker search */}
        <input
          placeholder="Cari ticker..."
          value={filters.search}
          onChange={e => setFilter("search", e.target.value.toUpperCase())}
          style={{ ...INPUT_STYLE, width: 100 }}
        />

        {/* Preset arah */}
        <div style={{ display: "flex", gap: 3 }}>
          {(["all", "gainer", "loser", "flat"] as Preset[]).map(p => (
            <PresetBtn key={p} active={filters.preset === p}
              color={p === "gainer" ? C.up : p === "loser" ? C.dn : C.label}
              onClick={() => setFilter("preset", p)}>
              {p === "all" ? "Semua" : p === "gainer" ? "Naik" : p === "loser" ? "Turun" : "Flat"}
            </PresetBtn>
          ))}
        </div>

        <Divider />

        {/* Change% range */}
        <label style={LABEL_STYLE}>Chg%</label>
        <input placeholder="Min" value={filters.minChg} onChange={e => setFilter("minChg", e.target.value)} style={{ ...INPUT_STYLE, width: 54 }} />
        <span style={{ color: C.muted, fontSize: 10 }}>–</span>
        <input placeholder="Max" value={filters.maxChg} onChange={e => setFilter("maxChg", e.target.value)} style={{ ...INPUT_STYLE, width: 54 }} />

        <Divider />

        {/* Volume min */}
        <label style={LABEL_STYLE}>Vol ≥</label>
        <input placeholder="Jt lembar" value={filters.minVol} onChange={e => setFilter("minVol", e.target.value)} style={{ ...INPUT_STYLE, width: 80 }} />

        <Divider />

        {/* Price range */}
        <label style={LABEL_STYLE}>Harga</label>
        <input placeholder="Min" value={filters.minPrice} onChange={e => setFilter("minPrice", e.target.value)} style={{ ...INPUT_STYLE, width: 64 }} />
        <span style={{ color: C.muted, fontSize: 10 }}>–</span>
        <input placeholder="Max" value={filters.maxPrice} onChange={e => setFilter("maxPrice", e.target.value)} style={{ ...INPUT_STYLE, width: 64 }} />

        <Divider />

        {/* Live only toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
          <div
            onClick={() => setFilter("liveOnly", !filters.liveOnly)}
            style={{
              width: 28, height: 15, borderRadius: 8,
              background: filters.liveOnly ? C.up : C.muted,
              position: "relative", cursor: "pointer", transition: "background .2s",
            }}>
            <div style={{
              position: "absolute", top: 2,
              left: filters.liveOnly ? 13 : 2,
              width: 11, height: 11, borderRadius: "50%",
              background: "#fff", transition: "left .2s",
            }} />
          </div>
          <span style={{ ...LABEL_STYLE, cursor: "pointer" }}>Live</span>
        </label>

        {/* Reset */}
        <button
          onClick={() => { setFilters({ search: "", preset: "all", minChg: "", maxChg: "", minVol: "", minPrice: "", maxPrice: "", liveOnly: false }); setPage(0); }}
          style={{ ...RESET_BTN, marginLeft: "auto" }}>
          Reset
        </button>

        {/* Count */}
        <span style={{ fontSize: 9, color: C.label, fontFamily: "'Space Mono',monospace", whiteSpace: "nowrap" }}>
          {filtered.length} / {Object.keys(quotes).length} saham
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1, background: C.surface }}>
            <tr>
              {([
                ["ticker",     "Symbol",  "left",  90],
                ["price",      "Last",    "right", 80],
                ["change",     "Chg",     "right", 72],
                ["change_pct", "Chg%",    "right", 72],
                ["volume",     "Volume",  "right", 88],
                ["high",       "High",    "right", 72],
                ["low",        "Low",     "right", 72],
                [null,         "Aksi",    "center", 50],
              ] as [SortKey | null, string, string, number][]).map(([key, label, align, w]) => (
                <th key={label}
                  onClick={key ? () => toggleSort(key) : undefined}
                  style={{
                    padding: "6px 10px", textAlign: align as any,
                    fontFamily: "'Syne',sans-serif", fontSize: 8, letterSpacing: 1,
                    color: sort.key === key ? C.accent : C.label,
                    fontWeight: 400, whiteSpace: "nowrap",
                    cursor: key ? "pointer" : "default",
                    borderBottom: `1px solid ${C.border}`,
                    width: w, minWidth: w,
                    userSelect: "none",
                  }}>
                  {label}
                  {sort.key === key && (
                    <span style={{ marginLeft: 3, fontSize: 8 }}>
                      {sort.dir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map(q => {
              const sym  = q.ticker.replace(".JK", "");
              const inWl = watchlist.includes(q.ticker);
              return (
                <tr key={q.ticker}
                  onClick={() => onSelectTicker(q.ticker)}
                  style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#0d1a2e")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

                  {/* Symbol */}
                  <td style={{ padding: "5px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "#8aa8cc", fontWeight: 700, fontFamily: "'Space Mono',monospace", fontSize: 10 }}>
                        {sym}
                      </span>
                      {q.is_live && (
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.up, flexShrink: 0, display: "inline-block" }} />
                      )}
                    </div>
                  </td>

                  {/* Price */}
                  <td style={{ padding: "5px 10px", textAlign: "right", color: C.text, fontFamily: "'Space Mono',monospace" }}>
                    {fmt(q.price)}
                  </td>

                  {/* Change Rp */}
                  <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'Space Mono',monospace", color: q.change >= 0 ? C.up : C.dn }}>
                    {q.change >= 0 ? "+" : ""}{fmt(q.change)}
                  </td>

                  {/* Change % */}
                  <td style={{ padding: "5px 10px", textAlign: "right" }}>
                    <span style={{
                      display: "inline-block", padding: "1px 6px", borderRadius: 3,
                      fontSize: 9, fontWeight: 700, fontFamily: "'Space Mono',monospace",
                      background: q.change_pct >= 0 ? "rgba(0,214,143,0.12)" : "rgba(255,69,96,0.12)",
                      color:      q.change_pct >= 0 ? C.up : C.dn,
                    }}>
                      {fmtPct(q.change_pct)}
                    </span>
                  </td>

                  {/* Volume */}
                  <td style={{ padding: "5px 10px", textAlign: "right", color: C.label, fontFamily: "'Space Mono',monospace" }}>
                    {fmtV(q.volume)}
                  </td>

                  {/* High */}
                  <td style={{ padding: "5px 10px", textAlign: "right", color: "#4a7050", fontFamily: "'Space Mono',monospace" }}>
                    {fmt(q.high)}
                  </td>

                  {/* Low */}
                  <td style={{ padding: "5px 10px", textAlign: "right", color: "#704a4a", fontFamily: "'Space Mono',monospace" }}>
                    {fmt(q.low)}
                  </td>

                  {/* Aksi: watchlist toggle */}
                  <td style={{ padding: "5px 10px", textAlign: "center" }}>
                    <button
                      onClick={e => handleWatchlist(e, q.ticker)}
                      title={inWl ? "Sudah di watchlist" : "Tambah ke watchlist"}
                      style={{
                        padding: "2px 6px", fontSize: 8,
                        background: inWl ? "rgba(46,143,223,0.15)" : "transparent",
                        border:     `1px solid ${inWl ? C.accent : C.muted}`,
                        borderRadius: 3, color: inWl ? C.accent : C.muted,
                        cursor: inWl ? "default" : "pointer",
                        fontFamily: "'Syne',sans-serif",
                      }}>
                      {inWl ? "★" : "☆"}
                    </button>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: "40px 16px", textAlign: "center", color: C.muted, fontSize: 11 }}>
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
        <div style={{ padding: "6px 12px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: C.label, marginRight: 4 }}>
            Hal {page + 1}/{pageCount} · {sorted.length} hasil
          </span>
          <PageBtn disabled={page === 0} onClick={() => setPage(0)}>«</PageBtn>
          <PageBtn disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</PageBtn>

          {/* Window 5 halaman */}
          {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
            const start = Math.max(0, Math.min(page - 2, pageCount - 5));
            const p = start + i;
            return (
              <PageBtn key={p} active={p === page} onClick={() => setPage(p)}>
                {p + 1}
              </PageBtn>
            );
          })}

          <PageBtn disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>›</PageBtn>
          <PageBtn disabled={page >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>»</PageBtn>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PresetBtn({ children, active, color, onClick }: {
  children: React.ReactNode; active: boolean; color: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      padding:    "3px 9px", fontSize: 9,
      fontFamily: "'Syne',sans-serif", fontWeight: 700,
      border:     `1px solid ${active ? color : "transparent"}`,
      borderRadius: 3,
      background: active ? `${color}1a` : "transparent",
      color:      active ? color : C.label,
      cursor:     "pointer",
    }}>
      {children}
    </button>
  );
}

function PageBtn({ children, onClick, disabled = false, active = false }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:    "2px 7px", fontSize: 9, minWidth: 26,
      fontFamily: "'Space Mono',monospace",
      border:     `1px solid ${active ? C.accent : C.border}`,
      borderRadius: 3,
      background: active ? `${C.accent}22` : "transparent",
      color:      active ? C.accent : disabled ? C.muted : C.label,
      cursor:     disabled ? "default" : "pointer",
    }}>
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: C.border, flexShrink: 0 }} />;
}

// ── Inline styles ──────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background:   "#040d1a",
  border:       `1px solid ${C.border}`,
  borderRadius: 3,
  color:        C.text,
  fontFamily:   "'Space Mono',monospace",
  fontSize:     10,
  padding:      "3px 7px",
  outline:      "none",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize:   8,
  color:      C.label,
  fontFamily: "'Syne',sans-serif",
  letterSpacing: 1,
  whiteSpace: "nowrap",
};

const RESET_BTN: React.CSSProperties = {
  padding:    "3px 10px", fontSize: 9,
  fontFamily: "'Syne',sans-serif",
  border:     `1px solid ${C.border}`,
  borderRadius: 3, background: "transparent",
  color:      C.label, cursor: "pointer",
};