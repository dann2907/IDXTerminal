import { useRef, useEffect } from "react";
import Sparkline from "./Sparkline";
import { fmtPrice, fmtPct } from "../helpers/formatters";
import { useMarketStore } from "../../../stores/useMarketStore";

export default function SidebarWatchlist({ watchlist, selectedTicker, onSelectTicker, flashMap }) {
  const quotes = useMarketStore((s) => s.quotes);
  const sparkRef = useRef({});

  // Simpan history harga per ticker untuk sparkline
  useEffect(() => {
    for (const [t, q] of Object.entries(quotes)) {
      if (!sparkRef.current[t]) sparkRef.current[t] = [];
      sparkRef.current[t].push(q.price);
      if (sparkRef.current[t].length > 20) sparkRef.current[t].shift();
    }
  }, [quotes]);

  return (
    <div className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-title">Watchlist</div>
        <div className="watchlist-toolbar">
          <div className="watchlist-caption">{watchlist.categories.length} kategori tersimpan</div>
          <button className="watchlist-btn" onClick={watchlist.createNew} title="Buat watchlist baru">
            + Simpan
          </button>
        </div>
        <div className="watchlist-form">
          <input
            className="watchlist-input"
            placeholder="Nama watchlist baru"
            value={watchlist.newName}
            onChange={(e) => watchlist.setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && watchlist.createNew()}
          />
        </div>
        <div className="watchlist-chip-row">
          {watchlist.categories.map((cat) => (
            <button
              key={cat.id}
              className={`watchlist-chip${watchlist.active?.id === cat.id ? " active" : ""}`}
              onClick={() => watchlist.setActiveId(cat.id)}
            >
              {cat.name} ({cat.tickers.length})
            </button>
          ))}
        </div>
        {watchlist.msg && (
          <div className={`watchlist-note ${watchlist.msg.ok ? "ok" : "err"}`}>
            {watchlist.msg.message}
          </div>
        )}
        <div className="watchlist-active-label">
          {watchlist.active ? `Ticker di ${watchlist.active.name}` : "Belum ada kategori"}
        </div>
        <div className="watchlist-form">
          <button className="watchlist-btn" onClick={watchlist.renameActive} disabled={!watchlist.active}>
            Rename
          </button>
          <button
            className="watchlist-btn"
            onClick={watchlist.deleteActive}
            disabled={!watchlist.active || watchlist.active?.is_default}
          >
            Delete
          </button>
        </div>
        <div className="watchlist-form">
          <input
            className="watchlist-input"
            placeholder={watchlist.active ? "Tambah ticker manual, mis. ANTM" : "Buat kategori dulu"}
            value={watchlist.tickerInput}
            onChange={(e) => watchlist.setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && watchlist.manualAdd()}
            disabled={!watchlist.active}
          />
          <button className="watchlist-btn primary" onClick={watchlist.manualAdd} disabled={!watchlist.active}>
            + Ticker
          </button>
        </div>
        {watchlist.activeTickers.map((ticker) => {
          const q = quotes[ticker];
          const fl = flashMap[ticker];
          const spark = sparkRef.current[ticker] || [];
          return (
            <div key={ticker} className="watchlist-item-wrap">
              <div
                className={`watchlist-item${selectedTicker === ticker ? " active" : ""}${fl ? " flash-" + fl : ""}`}
                onClick={() => onSelectTicker(ticker)}
              >
                <div>
                  <div className="wi-sym">{ticker.replace(".JK", "")}</div>
                  <div className="wi-spark">
                    <Sparkline data={spark} color={q && q.change_pct >= 0 ? "#00d68f" : "#ff4560"} />
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="wi-price">{q ? fmtPrice(q.price) : "—"}</div>
                  <div className={`wi-ch ${q && q.change_pct >= 0 ? "up" : "dn"}`}>
                    {q ? fmtPct(q.change_pct) : ""}
                  </div>
                </div>
              </div>
              <button className="wi-remove" onClick={(e) => { e.stopPropagation(); watchlist.removeTicker(ticker); }}>
                ✕
              </button>
            </div>
          );
        })}
        {!watchlist.activeTickers.length && (
          <div style={{ padding: "12px", fontSize: 11, color: "#4a6080", lineHeight: 1.6 }}>
            <div>{watchlist.active ? "Belum ada ticker di kategori ini" : "Watchlist kosong"}</div>
          </div>
        )}
      </div>
    </div>
  );
}