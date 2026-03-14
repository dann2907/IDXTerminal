// src/components/SearchBar.tsx
//
// Search bar untuk mencari saham IDX.
// Debounce 500ms sebelum hit /api/market/search/{query}.
// Backend mendaftarkan ticker sebagai search_temp (TTL 5 menit)
// sehingga DataFetcher otomatis mulai track harga ticker tersebut.
//
// Props:
//   onSelect(ticker) — dipanggil saat user memilih hasil search

import { useState, useRef, useEffect, useCallback } from "react";

const API = "http://127.0.0.1:8765";

interface SearchResult {
  ticker: string;
  name: string;
  price?: number;
  sector?: string;
}

interface SearchBarProps {
  onSelect: (ticker: string) => void;
}

export default function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<SearchResult | null>(null);
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef              = useRef<HTMLDivElement>(null);

  // Tutup dropdown jika klik di luar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    const t = q.trim().toUpperCase();
    if (t.length < 2) { setResults(null); setOpen(false); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/market/search/${t}`);
      if (res.status === 404) {
        setError(`${t} tidak ditemukan`);
        setResults(null);
        setOpen(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as SearchResult;
      setResults(data);
      setOpen(true);
      setError(null);
    } catch (err) {
      setError("Gagal search — coba lagi");
      setResults(null);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) { setOpen(false); setResults(null); return; }
    debounceRef.current = setTimeout(() => doSearch(v), 500);
  };

  const handleSelect = () => {
    if (!results) return;
    onSelect(results.ticker);
    setQuery("");
    setOpen(false);
    setResults(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && results) handleSelect();
    if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: 220 }}>
      {/* Input */}
      <div style={{
        display:     "flex",
        alignItems:  "center",
        gap:         6,
        background:  "#040d1a",
        border:      `1px solid ${open ? "#2e8fdf66" : "#0f2040"}`,
        borderRadius: 4,
        padding:     "4px 10px",
        transition:  "border-color 0.15s",
      }}>
        <span style={{ color: "#2a4060", fontSize: 11 }}>🔍</span>
        <input
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Cari saham (BBCA, GOTO…)"
          style={{
            background:  "transparent",
            border:      "none",
            outline:     "none",
            color:       "#c8d8f0",
            fontSize:    10,
            fontFamily:  "'Space Mono', monospace",
            width:       "100%",
            letterSpacing: "0.03em",
          }}
        />
        {loading && <span style={{ color: "#2e8fdf", fontSize: 9, flexShrink: 0 }}>…</span>}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:    "absolute",
          top:         "calc(100% + 4px)",
          left:        0,
          right:       0,
          background:  "#0a1628",
          border:      "1px solid #0f2040",
          borderRadius: 4,
          zIndex:      9000,
          boxShadow:   "0 8px 24px rgba(0,0,0,0.5)",
          overflow:    "hidden",
        }}>
          {error && (
            <div style={{ padding: "8px 12px", fontSize: 10, color: "#ff4560" }}>
              {error}
            </div>
          )}

          {results && (
            <div
              onClick={handleSelect}
              style={{
                padding:    "10px 12px",
                cursor:     "pointer",
                borderBottom: "1px solid #0f2040",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#0f1e35")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "#2e8fdf", fontSize: 11, fontFamily: "'Syne', sans-serif" }}>
                  {results.ticker.replace(".JK", "")}
                </span>
                {results.price !== undefined && (
                  <span style={{ color: "#c8d8f0", fontSize: 10, fontFamily: "'Space Mono', monospace" }}>
                    {results.price.toLocaleString("id")}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 9, color: "#4a6080", marginTop: 2 }}>
                {results.name}
                {results.sector && ` · ${results.sector}`}
              </div>
              <div style={{ fontSize: 8, color: "#2a4060", marginTop: 2 }}>
                Tekan Enter atau klik untuk buka chart →
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}