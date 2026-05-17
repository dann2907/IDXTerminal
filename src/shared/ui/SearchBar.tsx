import { useCallback, useEffect, useRef, useState } from "react";

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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = useCallback(async (value: string) => {
    const ticker = value.trim().toUpperCase();
    if (ticker.length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API}/api/market/search/${ticker}`);
      if (response.status === 404) {
        setError(`${ticker} tidak ditemukan`);
        setResults(null);
        setOpen(true);
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as SearchResult;
      setResults(data);
      setOpen(true);
    } catch {
      setError("Gagal search, coba lagi");
      setResults(null);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setOpen(false);
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(value), 500);
  };

  const handleSelect = () => {
    if (!results) return;
    onSelect(results.ticker);
    setQuery("");
    setOpen(false);
    setResults(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && results) handleSelect();
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={containerRef} className="search-box">
      <div className={`search-input-shell ${open ? "open" : ""}`}>
        <input
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search ticker (BBCA, GOTO...)"
        />
        {loading ? <span className="search-loading">...</span> : null}
      </div>

      {open ? (
        <div className="search-dropdown">
          {error ? <div className="search-error">{error}</div> : null}

          {results ? (
            <button type="button" onClick={handleSelect} className="search-result">
              <div className="search-result-main">
                <span>{results.ticker.replace(".JK", "")}</span>
                {results.price !== undefined ? <strong>{results.price.toLocaleString("id")}</strong> : null}
              </div>
              <div className="search-result-sub">
                {results.name}
                {results.sector ? ` / ${results.sector}` : ""}
              </div>
              <div className="search-result-hint">Press Enter or click to open chart</div>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
