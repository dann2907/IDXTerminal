// src/components/IDXTerminal.jsx
//
// Bloomberg-style trading dashboard — Fase 4/5.
// Fitur baru: Search saham, Orders TP/SL panel, Trade history, Performance.

import { useState, useEffect, useRef, useCallback } from "react";
import CandleChart from "./chart/CandleChart";
import SearchBar from "./SearchBar";
import OrdersPanel from "./portfolio/OrdersPanel";
import TradeHistory from "./portfolio/TradeHistory";
import PerformancePanel from "./portfolio/PerformancePanel";
import { useMarketStore } from "../stores/useMarketStore";
import { usePortfolioStore } from "../stores/usePortfolioStore";

// ── Fonts ────────────────────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700;800&display=swap";
if (!document.head.querySelector(`link[href="${fontLink.href}"]`)) {
  document.head.appendChild(fontLink);
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0c1520; color: #c8d8f0; font-family: 'Space Mono', monospace; }

  .terminal {
    display: flex; flex-direction: column;
    height: 100vh; width: 100vw; overflow: hidden;
    background: #0c1520;
  }

  /* ── Topbar ── */
  .topbar {
    display: flex; align-items: center; gap: 12px;
    padding: 0 16px; height: 48px; flex-shrink: 0;
    background: #070d1c;
    border-bottom: 1px solid #0f2040;
    position: relative;
  }
  .topbar::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, #2e8fdf22, #00d68f44, #2e8fdf22);
  }
  .logo {
    font-family: 'Syne', sans-serif; font-weight: 800;
    font-size: 15px; color: #2e8fdf; letter-spacing: 3px;
  }
  .logo span { color: #4a6080; }

  .ihsg-pill {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 4px;
    background: #0a1628; border: 1px solid #0f2040;
    font-size: 10px;
  }
  .ihsg-label { color: #4a6080; letter-spacing: 1px; font-family: 'Syne', sans-serif; font-size: 8px; }
  .ihsg-val   { color: #c8d8f0; font-weight: 700; }
  .ihsg-ch.up { color: #00d68f; }
  .ihsg-ch.dn { color: #ff4560; }

  .market-status {
    display: flex; align-items: center; gap: 6px;
    font-size: 10px; color: #4a6080; letter-spacing: 1px;
    margin-right: auto; margin-left: 16px;
  }
  .dot-pulse {
    width: 6px; height: 6px; border-radius: 50%;
    background: #00d68f;
    animation: pulse 2s infinite;
  }
  .dot-pulse.offline { background: #ff4560; animation: none; }
  @keyframes pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 #00d68f66; }
    50% { opacity: 0.7; box-shadow: 0 0 0 4px transparent; }
  }

  .nav-tabs { display: flex; gap: 2px; }
  .nav-tab {
    padding: 6px 14px; font-size: 9px; letter-spacing: 1px;
    text-transform: uppercase; border: none; cursor: pointer;
    background: transparent; color: #4a6080; border-radius: 3px;
    font-family: 'Syne', sans-serif; font-weight: 600;
    transition: all 0.15s;
  }
  .nav-tab:hover { color: #94a3b8; background: #0f1e35; }
  .nav-tab.active { color: #00d68f; background: #00d68f11; }

  /* ── Layout ── */
  .body { display: flex; flex: 1; overflow: hidden; height: calc(100vh - 48px); }

  /* ── Left Sidebar ── */
  .sidebar {
    width: 200px; flex-shrink: 0;
    background: #070d1c;
    border-right: 1px solid #0f2040;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .sidebar-section { padding: 10px 0; border-bottom: 1px solid #0a1830; }
  .sidebar-title {
    font-size: 8px; letter-spacing: 2px; color: #2a4060;
    text-transform: uppercase; padding: 0 12px 6px;
    font-family: 'Syne', sans-serif; font-weight: 700;
  }

  .watchlist-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 5px 12px; cursor: pointer;
    border-left: 2px solid transparent;
    transition: all 0.12s;
  }
  .watchlist-item:hover { background: #0a1628; border-left-color: #1e3a5f; }
  .watchlist-item.active { background: #0a1e38; border-left-color: #00d68f; }
  .wi-sym { font-size: 10px; color: #8aa8cc; font-weight: 700; }
  .wi-price { font-size: 10px; color: #c8d8f0; }
  .wi-ch { font-size: 9px; }
  .wi-spark { margin-top: 2px; }

  /* ── Main ── */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

  /* ── Chart page ── */
  .chart-header { padding: 10px 14px 8px; border-bottom: 1px solid #0f2040; display: flex; align-items: center; gap: 14px; }
  .ch-sym  { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 15px; color: #2e8fdf; }
  .ch-price { font-size: 20px; color: #eff6ff; font-weight: 700; }
  .ch-meta  { font-size: 9px; }
  .period-tabs { display: flex; gap: 3px; margin-left: auto; }
  .period-btn {
    padding: 3px 8px; font-size: 8px; font-family: 'Syne', sans-serif;
    font-weight: 700; letter-spacing: 1px; border: 1px solid #0f2040;
    background: transparent; color: #4a6080; border-radius: 3px; cursor: pointer;
    transition: all 0.12s;
  }
  .period-btn:hover { background: #0a1628; color: #8aa8cc; }
  .period-btn.active { background: #2e8fdf22; color: #2e8fdf; border-color: #2e8fdf44; }

  .chart-box { flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 8px; gap: 0; }
  .chart-inner { flex: 1; min-height: 0; }
  .indicator-row {
    display: flex; gap: 6px; align-items: center;
    padding: 6px 4px; border-top: 1px solid #0f2040;
  }
  .ind-pill {
    display: flex; gap: 6px; align-items: center;
    padding: 3px 8px; border: 1px solid #0f2040;
    border-radius: 3px; font-size: 9px; color: #4a6080;
    font-family: 'Syne', sans-serif;
  }

  /* ── Right Panel ── */
  .panel {
    width: 220px; flex-shrink: 0;
    background: #070d1c;
    border-left: 1px solid #0f2040;
    display: flex; flex-direction: column;
    overflow-y: auto; overflow-x: hidden;
  }
  .panel-section { padding: 10px 12px; border-bottom: 1px solid #0a1830; }
  .panel-title {
    font-family: 'Syne', sans-serif; font-size: 8px; letter-spacing: 2px;
    color: #2a4060; text-transform: uppercase; margin-bottom: 8px;
  }
  .summary-val { font-size: 13px; color: #eff6ff; font-weight: 700; }
  .summary-label { font-size: 8px; color: #4a6080; margin-top: 2px; }

  .holding-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 5px 0; border-bottom: 1px solid #070d1c;
    font-size: 10px;
  }
  .h-sym { color: #8aa8cc; font-weight: 700; font-size: 10px; }
  .h-lots { color: #4a6080; font-size: 9px; }

  .mover-item {
    display: flex; align-items: center; gap: 6px; padding: 4px 0;
    border-bottom: 1px solid #0a1830; font-size: 10px;
  }
  .mv-sym { color: #8aa8cc; font-weight: 700; width: 52px; flex-shrink: 0; }
  .mv-bar { flex: 1; height: 3px; border-radius: 2px; opacity: 0.6; }
  .mv-ch { font-size: 9px; font-weight: 700; width: 44px; text-align: right; flex-shrink: 0; }

  .up { color: #00d68f; }
  .dn { color: #ff4560; }

  /* ── Feed Bar ── */
  .feed-bar {
    height: 28px; flex-shrink: 0;
    background: #040810; border-top: 1px solid #0a1830;
    display: flex; align-items: center; overflow: hidden;
  }
  .feed-label {
    padding: 0 10px; font-size: 8px; letter-spacing: 2px; color: #2a4060;
    border-right: 1px solid #0a1830; flex-shrink: 0;
    font-family: 'Syne', sans-serif;
  }
  .ticker-tape { display: flex; gap: 24px; padding: 0 16px; overflow: hidden; }
  .tape-item { display: flex; gap: 6px; align-items: center; font-size: 9px; flex-shrink: 0; }
  .tape-sym { color: #4a6080; font-family: 'Syne', sans-serif; font-size: 8px; font-weight: 700; }

  /* ── Trade form ── */
  .trade-input {
    width: 100%; background: #040d1a; border: 1px solid #0f2040; border-radius: 3px;
    color: #c8d8f0; font-family: 'Space Mono', monospace; font-size: 10px;
    padding: 5px 8px; outline: none; margin-bottom: 5px;
  }
  .trade-input:focus { border-color: #2e8fdf66; }

  /* ── Heatmap ── */
  .hm-grid { display: flex; flex-wrap: wrap; gap: 3px; padding: 12px; }
  .hm-cell {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; border-radius: 3px; cursor: pointer;
    transition: opacity 0.15s;
  }
  .hm-cell:hover { opacity: 0.8; }
  .hm-sym { font-size: 8px; font-weight: 700; color: #000a; }
  .hm-ch  { font-size: 7px; color: #000a; }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #050a14; }
  ::-webkit-scrollbar-thumb { background: #0f2040; border-radius: 2px; }

  /* ── Flash animations ── */
  @keyframes flash-up { 0%,100%{background:transparent} 50%{background:#00d68f22} }
  @keyframes flash-dn { 0%,100%{background:transparent} 50%{background:#ff456022} }
  .flash-up { animation: flash-up 0.6s ease; }
  .flash-dn { animation: flash-dn 0.6s ease; }
  @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
  .slide-in { animation: slideIn 0.3s ease; }
`;

const PAGES   = ["MARKET", "CHART", "PORTFOLIO", "SCREENER", "ALERTS", "HEATMAP"];
// Period → yfinance period/interval mapping
const PERIOD_MAP = {
  "1D":  { period: "1d",  interval: "5m"  },
  "5D":  { period: "5d",  interval: "15m" },
  "1M":  { period: "1mo", interval: "1d"  },
  "3M":  { period: "3mo", interval: "1d"  },
  "1Y":  { period: "1y",  interval: "1wk" },
  "5Y":  { period: "5y",  interval: "1wk" },
};
const PERIOD_KEYS = Object.keys(PERIOD_MAP);

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtPrice = v => {
  if (v === undefined || v === null) return "—";
  return v >= 1000 ? v.toLocaleString("id") : v.toString();
};

const fmtRp = v => {
  if (!v && v !== 0) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}Jt`;
  return `Rp${v.toLocaleString("id")}`;
};

const fmtPct = v => {
  if (v === undefined || v === null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
};

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color, width = 60, height = 20 }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function IDXTerminal() {
  // ── Store connections ──────────────────────────────────────────────────
  const quotes      = useMarketStore(s => s.quotes);
  const candles     = useMarketStore(s => s.candles);
  const wsStatus    = useMarketStore(s => s.wsStatus);
  const topGainers  = useMarketStore(s => s.topGainers);
  const topLosers   = useMarketStore(s => s.topLosers);

  const summary   = usePortfolioStore(s => s.summary);
  const holdings  = usePortfolioStore(s => s.holdings);
  const watchlist = usePortfolioStore(s => s.watchlist);
  const buy       = usePortfolioStore(s => s.buy);
  const sell      = usePortfolioStore(s => s.sell);

  // ── Local state ───────────────────────────────────────────────────────
  const [page, setPage]           = useState("CHART");
  const [selectedTicker, setSelectedTicker] = useState("BBCA.JK");
  const [period, setPeriod]       = useState("3M");
  const [flashMap, setFlashMap]   = useState({});
  const [time, setTime]           = useState(new Date());
  const [indexData, setIndexData] = useState(null);
  const [tradeAction, setTradeAction] = useState("BUY");
  const [tradeLots, setTradeLots] = useState("");
  const [tradeMsg, setTradeMsg]   = useState(null);
  const [portfolioTab, setPortfolioTab] = useState("holdings"); // holdings|orders|history|performance

  // Handler dari SearchBar
  const handleSearchSelect = useCallback((ticker) => {
    setSelectedTicker(ticker);
    setPage("CHART");
  }, []);

  const prevQuotesRef = useRef({});

  // ── Clock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Flash detection (dari perubahan quotes WS nyata) ──────────────────
  useEffect(() => {
    const flashes = {};
    for (const [ticker, q] of Object.entries(quotes)) {
      const prev = prevQuotesRef.current[ticker];
      if (prev && q.price !== prev.price) {
        flashes[ticker] = q.price > prev.price ? "up" : "dn";
      }
    }
    prevQuotesRef.current = quotes;
    if (Object.keys(flashes).length) {
      setFlashMap(flashes);
      setTimeout(() => setFlashMap({}), 700);
    }
  }, [quotes]);

  // ── Fetch IHSG / LQ45 (setiap 60 detik, cache di backend) ────────────
  useEffect(() => {
    const fetchIndex = () =>
      fetch("http://127.0.0.1:8765/api/market/ihsg")
        .then(r => r.json())
        .then(d => setIndexData(Object.keys(d).length ? d : null))
        .catch(() => {});
    fetchIndex();
    const iv = setInterval(fetchIndex, 60_000);
    return () => clearInterval(iv);
  }, []);

  // ── Fetch candles saat ticker atau period berubah ─────────────────────

  // ── Set default selected ticker dari watchlist ────────────────────────
  useEffect(() => {
    if (watchlist.length && !quotes[selectedTicker]) {
      setSelectedTicker(watchlist[0]);
    }
  }, [watchlist]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ──────────────────────────────────────────────────────
  const selectedQuote = quotes[selectedTicker];
  const selectedCandles = candles[selectedTicker] || [];
  const displayedWatchlist = watchlist.length
    ? watchlist
    : Object.keys(quotes).slice(0, 10);

  const gainers = topGainers(3);
  const losers  = topLosers(3);

  // Sparkline dari 20 quote terakhir — kita simpan riwayat kecil per ticker
  const sparkRef = useRef({});
  useEffect(() => {
    for (const [t, q] of Object.entries(quotes)) {
      if (!sparkRef.current[t]) sparkRef.current[t] = [];
      sparkRef.current[t].push(q.price);
      if (sparkRef.current[t].length > 20) sparkRef.current[t].shift();
    }
  }, [quotes]);

  // ── Quick Trade handler ────────────────────────────────────────────────
  const handleTrade = useCallback(async () => {
    const lots = parseInt(tradeLots, 10);
    if (!lots || lots <= 0) return;
    const price = quotes[selectedTicker]?.price;
    if (!price) { setTradeMsg({ ok: false, message: "Harga belum tersedia" }); return; }

    const fn = tradeAction === "BUY" ? buy : sell;
    const res = await fn(selectedTicker, lots, price);
    setTradeMsg(res);
    if (res.ok) setTradeLots("");
    setTimeout(() => setTradeMsg(null), 4000);
  }, [tradeLots, tradeAction, selectedTicker, quotes, buy, sell]);

  const indicators = calcIndicators(selectedCandles);

  // ── Indicators dari candle data ───────────────────────────────────────

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div className="terminal">

        {/* ── TOPBAR ── */}
        <div className="topbar">
          <div className="logo">IDX<span>TERMINAL</span></div>

          <IndexPill label="IHSG" data={indexData} />

          <div className="market-status">
            <div className={`dot-pulse${wsStatus === "connected" ? "" : " offline"}`} />
            <span>{wsStatus === "connected" ? "LIVE" : wsStatus.toUpperCase()}</span>
            <span style={{ color: "#2a4060" }}>·</span>
            <span>{time.toLocaleTimeString("id", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            <span style={{ color: "#2a4060" }}>WIB</span>
          </div>

          <SearchBar onSelect={handleSearchSelect} />

          <div className="nav-tabs">
            {PAGES.map(p => (
              <button key={p} className={`nav-tab${page === p ? " active" : ""}`}
                onClick={() => setPage(p)}>{p}</button>
            ))}
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="body">

          {/* ── LEFT SIDEBAR — Watchlist ── */}
          <div className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-title">Watchlist</div>
              {displayedWatchlist.map(ticker => {
                const q = quotes[ticker];
                const fl = flashMap[ticker];
                const spark = sparkRef.current[ticker] || [];
                return (
                  <div key={ticker}
                    className={`watchlist-item${selectedTicker === ticker ? " active" : ""}${fl ? " flash-" + fl : ""}`}
                    onClick={() => { setSelectedTicker(ticker); setPage("CHART"); }}>
                    <div>
                      <div className="wi-sym">{ticker.replace(".JK", "")}</div>
                      <div className="wi-spark">
                        <Sparkline data={spark} color={q && q.change_pct >= 0 ? "#00d68f" : "#ff4560"} width={60} height={20} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="wi-price">{q ? fmtPrice(q.price) : "—"}</div>
                      <div className={`wi-ch ${q && q.change_pct >= 0 ? "up" : "dn"}`}>
                        {q ? fmtPct(q.change_pct) : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!displayedWatchlist.length && (
                <div style={{ padding: "8px 12px", fontSize: 9, color: "#2a4060" }}>
                  Watchlist kosong
                </div>
              )}
            </div>
          </div>

          {/* ── MAIN CONTENT ── */}
          <div className="main">

            {/* CHART page */}
            {page === "CHART" && (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                <div className="chart-header">
                  <span className="ch-sym">{selectedTicker.replace(".JK", "")}</span>
                  <div>
                    <div className="ch-price">{selectedQuote ? fmtPrice(selectedQuote.price) : "—"}</div>
                    <div className={`ch-meta ${selectedQuote && selectedQuote.change_pct >= 0 ? "up" : "dn"}`}>
                      {selectedQuote
                        ? `${selectedQuote.change_pct >= 0 ? "▲" : "▼"} ${Math.abs(selectedQuote.change_pct).toFixed(2)}%  ·  H: ${fmtPrice(selectedQuote.high)}  L: ${fmtPrice(selectedQuote.low)}  Vol: ${(selectedQuote.volume / 1_000_000).toFixed(1)}M`
                        : "Memuat data..."}
                    </div>
                  </div>
                  <div className="period-tabs">
                    {PERIOD_KEYS.map(p => (
                      <button key={p} className={`period-btn${period === p ? " active" : ""}`}
                        onClick={() => setPeriod(p)}>{p}</button>
                    ))}
                  </div>
                </div>

                <div className="chart-box">
                  <div className="chart-inner">
                    <CandleChart
                      ticker={selectedTicker}
                      period={PERIOD_MAP[period].period}
                      interval="1d"
                      height={340}
                    />
                  </div>
                  <div className="indicator-row">
                    <div className="ind-pill">MA20 <span style={{ color: "#f59e0b" }}>{indicators.ma20 ? fmtPrice(indicators.ma20) : "—"}</span></div>
                    <div className="ind-pill">MA50 <span style={{ color: "#3b82f6" }}>{indicators.ma50 ? fmtPrice(indicators.ma50) : "—"}</span></div>
                    <div className="ind-pill">RSI  <span style={{ color: "#a78bfa" }}>{indicators.rsi ? indicators.rsi.toFixed(1) : "—"}</span></div>
                    <div className="ind-pill">
                      MACD <span className={indicators.macd >= 0 ? "up" : "dn"}>
                        {indicators.macd !== null ? `${indicators.macd >= 0 ? "▲" : "▼"} ${Math.abs(indicators.macd).toFixed(1)}` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MARKET page */}
            {page === "MARKET" && (
              <div style={{ padding: 12, overflow: "auto", height: "100%" }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, letterSpacing: 2, color: "#2a4060", marginBottom: 10, textTransform: "uppercase" }}>Market Overview</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {[{ label: "GAINERS", items: gainers, color: "#00d68f" },
                    { label: "LOSERS",  items: losers,  color: "#ff4560" }].map(g => (
                    <div key={g.label} style={{ background: "#070d1c", border: "1px solid #0f2040", borderRadius: 6, padding: 10 }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 8, letterSpacing: 2, color: "#2a4060", marginBottom: 8 }}>{g.label}</div>
                      {g.items.map(q => (
                        <div key={q.ticker} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #0a1830" }}
                          onClick={() => { setSelectedTicker(q.ticker); setPage("CHART"); }} style2={{ cursor: "pointer" }}>
                          <span style={{ fontSize: 10, color: "#8aa8cc" }}>{q.ticker.replace(".JK", "")}</span>
                          <span style={{ fontSize: 10, color: g.color, fontWeight: 700 }}>
                            {q.change_pct >= 0 ? "+" : ""}{q.change_pct.toFixed(2)}%
                            <span style={{ color: "#4a6080", marginLeft: 6 }}>{fmtPrice(q.price)}</span>
                          </span>
                        </div>
                      ))}
                      {!g.items.length && <div style={{ fontSize: 9, color: "#2a4060" }}>Menunggu data...</div>}
                    </div>
                  ))}
                </div>
                <div style={{ background: "#070d1c", border: "1px solid #0f2040", borderRadius: 6, padding: 10 }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 8, letterSpacing: 2, color: "#2a4060", marginBottom: 8 }}>ALL QUOTES</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <thead>
                      <tr style={{ color: "#2a4060", borderBottom: "1px solid #0f2040" }}>
                        {["Symbol", "Last", "Change", "Volume", "High", "Low"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "4px 8px", fontWeight: 400, letterSpacing: 1, fontSize: 8 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(quotes).map(q => {
                        const fl = flashMap[q.ticker];
                        return (
                          <tr key={q.ticker} className={fl ? `flash-${fl}` : ""} style={{ borderBottom: "1px solid #0a1830", cursor: "pointer" }}
                            onClick={() => { setSelectedTicker(q.ticker); setPage("CHART"); }}>
                            <td style={{ padding: "5px 8px", color: "#8aa8cc", fontWeight: 700 }}>{q.ticker.replace(".JK", "")}</td>
                            <td style={{ padding: "5px 8px", color: "#c8d8f0" }}>{fmtPrice(q.price)}</td>
                            <td style={{ padding: "5px 8px" }} className={q.change_pct >= 0 ? "up" : "dn"}>{fmtPct(q.change_pct)}</td>
                            <td style={{ padding: "5px 8px", color: "#4a6080" }}>{(q.volume / 1_000_000).toFixed(1)}M</td>
                            <td style={{ padding: "5px 8px", color: "#4a6080" }}>{fmtPrice(q.high)}</td>
                            <td style={{ padding: "5px 8px", color: "#4a6080" }}>{fmtPrice(q.low)}</td>
                          </tr>
                        );
                      })}
                      {!Object.keys(quotes).length && (
                        <tr><td colSpan={6} style={{ padding: "12px 8px", color: "#2a4060", textAlign: "center" }}>Menunggu data market...</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PORTFOLIO page */}
            {page === "PORTFOLIO" && (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

                {/* Sub-tab bar */}
                <div style={{
                  display:      "flex",
                  gap:          2,
                  padding:      "8px 12px 0",
                  borderBottom: "1px solid #0f2040",
                  flexShrink:   0,
                }}>
                  {[
                    { key: "holdings",    label: "Holdings" },
                    { key: "orders",      label: "Orders TP/SL" },
                    { key: "history",     label: "Trade History" },
                    { key: "performance", label: "Performance" },
                  ].map(t => (
                    <button key={t.key} onClick={() => setPortfolioTab(t.key)} style={{
                      padding:    "5px 14px",
                      fontSize:   9,
                      fontFamily: "'Syne', sans-serif",
                      fontWeight: 700,
                      letterSpacing: 1,
                      border:     "none",
                      borderBottom: portfolioTab === t.key ? "2px solid #2e8fdf" : "2px solid transparent",
                      background:   "transparent",
                      color:        portfolioTab === t.key ? "#2e8fdf" : "#4a6080",
                      cursor:       "pointer",
                      textTransform: "uppercase",
                    }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Sub-tab content */}
                <div style={{ flex: 1, overflow: "auto", padding: 12 }}>

                  {/* Holdings */}
                  {portfolioTab === "holdings" && (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
                        {[
                          { label: "SALDO KAS",    val: summary ? fmtRp(summary.cash)         : "—", col: "#c8d8f0" },
                          { label: "TOTAL NILAI",  val: summary ? fmtRp(summary.total_value)  : "—", col: "#c8d8f0" },
                          { label: "FLOATING P&L", val: summary ? fmtRp(summary.floating_pnl) : "—", col: summary && summary.floating_pnl >= 0 ? "#00d68f" : "#ff4560" },
                          { label: "REALIZED P&L", val: summary ? fmtRp(summary.realized_pnl) : "—", col: summary && summary.realized_pnl >= 0 ? "#00d68f" : "#ff4560" },
                        ].map(c => (
                          <div key={c.label} style={{ background: "#070d1c", border: "1px solid #0f2040", borderRadius: 6, padding: "10px 12px" }}>
                            <div style={{ fontSize: 8, letterSpacing: 1, color: "#2a4060", fontFamily: "'Syne',sans-serif", marginBottom: 4 }}>{c.label}</div>
                            <div style={{ fontSize: 13, color: c.col, fontWeight: 700 }}>{c.val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ background: "#070d1c", border: "1px solid #0f2040", borderRadius: 6, padding: 10 }}>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 8, letterSpacing: 2, color: "#2a4060", marginBottom: 8 }}>HOLDINGS</div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                          <thead>
                            <tr style={{ color: "#2a4060", borderBottom: "1px solid #0f2040" }}>
                              {["Ticker", "Lot", "Avg Cost", "Harga", "Nilai Pasar", "P&L", "%"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "4px 8px", fontWeight: 400, fontSize: 8, letterSpacing: 1 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {holdings.map(h => (
                              <tr key={h.ticker} style={{ borderBottom: "1px solid #0a1830", cursor: "pointer" }}
                                onClick={() => { setSelectedTicker(h.ticker); setPage("CHART"); }}>
                                <td style={{ padding: "5px 8px", color: "#8aa8cc", fontWeight: 700 }}>{h.ticker.replace(".JK", "")}</td>
                                <td style={{ padding: "5px 8px", color: "#c8d8f0" }}>{h.lots ?? h.shares}</td>
                                <td style={{ padding: "5px 8px", color: "#4a6080" }}>{fmtPrice(h.avg_cost)}</td>
                                <td style={{ padding: "5px 8px", color: "#c8d8f0" }}>{fmtPrice(h.current_price)}</td>
                                <td style={{ padding: "5px 8px", color: "#4a6080" }}>{fmtRp(h.market_value)}</td>
                                <td style={{ padding: "5px 8px" }} className={h.pnl_rp >= 0 ? "up" : "dn"}>{fmtRp(h.pnl_rp)}</td>
                                <td style={{ padding: "5px 8px" }} className={h.pnl_pct >= 0 ? "up" : "dn"}>{fmtPct(h.pnl_pct)}</td>
                              </tr>
                            ))}
                            {!holdings.length && (
                              <tr><td colSpan={7} style={{ padding: "12px 8px", color: "#2a4060", textAlign: "center" }}>Tidak ada holdings</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Orders */}
                  {portfolioTab === "orders" && <OrdersPanel />}

                  {/* Trade history */}
                  {portfolioTab === "history" && <TradeHistory />}

                  {/* Performance */}
                  {portfolioTab === "performance" && <PerformancePanel />}

                </div>
              </div>
            )}

            {/* HEATMAP page */}
            {page === "HEATMAP" && (
              <div style={{ overflow: "auto", height: "100%" }}>
                <div style={{ padding: "12px 12px 4px", fontFamily: "'Syne',sans-serif", fontSize: 10, letterSpacing: 2, color: "#2a4060", textTransform: "uppercase" }}>Sector Heatmap</div>
                <div className="hm-grid">
                  {Object.values(quotes)
                    .sort((a, b) => b.change_pct - a.change_pct)
                    .map(q => {
                      const intensity = Math.min(Math.abs(q.change_pct) / 5, 1);
                      const bg = q.change_pct >= 0
                        ? `rgba(0,${Math.floor(100 + 110 * intensity)},${Math.floor(80 * (1 - intensity))},${0.4 + 0.5 * intensity})`
                        : `rgba(${Math.floor(150 + 105 * intensity)},${Math.floor(50 * (1 - intensity))},${Math.floor(40 * (1 - intensity))},${0.4 + 0.5 * intensity})`;
                      const size = 60;
                      return (
                        <div key={q.ticker} className="hm-cell"
                          style={{ width: size, height: size, background: bg }}
                          onClick={() => { setSelectedTicker(q.ticker); setPage("CHART"); }}>
                          <span className="hm-sym">{q.ticker.replace(".JK", "")}</span>
                          <span className="hm-ch">{fmtPct(q.change_pct)}</span>
                        </div>
                      );
                    })}
                  {!Object.keys(quotes).length && (
                    <div style={{ color: "#2a4060", fontSize: 11, padding: 20 }}>Menunggu data...</div>
                  )}
                </div>
              </div>
            )}

            {/* SCREENER & ALERTS — placeholder */}
            {(page === "SCREENER" || page === "ALERTS") && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#4a6080", fontFamily: "'Syne',sans-serif", fontSize: 11 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{page === "SCREENER" ? "🔍" : "🔔"}</div>
                  <div>{page === "SCREENER" ? "Stock Screener" : "Price Alerts"}</div>
                  <div style={{ fontSize: 9, marginTop: 4, color: "#2a4060" }}>Coming in Phase 5</div>
                </div>
              </div>
            )}

            {/* ── FEED BAR ── */}
            <div className="feed-bar">
              <div className="feed-label">LIVE FEED</div>
              <div className="ticker-tape">
                {Object.values(quotes).slice(0, 12).map(q => (
                  <div key={q.ticker} className="tape-item">
                    <span className="tape-sym">{q.ticker.replace(".JK", "")}</span>
                    <span style={{ color: "#c8d8f0" }}>{fmtPrice(q.price)}</span>
                    <span className={q.change_pct >= 0 ? "up" : "dn"}>{fmtPct(q.change_pct)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="panel">

            {/* Portfolio summary */}
            <div className="panel-section">
              <div className="panel-title">Portfolio</div>
              <div style={{ marginBottom: 6 }}>
                <div className="summary-label">Saldo Kas</div>
                <div className="summary-val">{summary ? fmtRp(summary.cash) : "—"}</div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div className="summary-label">Total Nilai</div>
                <div className="summary-val">{summary ? fmtRp(summary.total_value) : "—"}</div>
              </div>
              <div>
                <div className="summary-label">Floating P&L</div>
                <div className={`summary-val ${summary && summary.floating_pnl >= 0 ? "up" : "dn"}`}>
                  {summary ? fmtRp(summary.floating_pnl) : "—"}
                </div>
              </div>
            </div>

            {/* Holdings mini-list */}
            <div className="panel-section">
              <div className="panel-title">Holdings</div>
              {holdings.slice(0, 5).map(h => (
                <div key={h.ticker} className="holding-item"
                  onClick={() => { setSelectedTicker(h.ticker); setPage("CHART"); }}
                  style={{ cursor: "pointer" }}>
                  <div>
                    <div className="h-sym">{h.ticker.replace(".JK", "")}</div>
                    <div className="h-lots">{h.lots ?? h.shares} {h.lots ? "lot" : "shs"}</div>
                  </div>
                  <span className={h.pnl_pct >= 0 ? "up" : "dn"} style={{ fontSize: 10, fontWeight: 700 }}>
                    {fmtPct(h.pnl_pct)}
                  </span>
                </div>
              ))}
              {!holdings.length && <div style={{ fontSize: 9, color: "#2a4060" }}>Tidak ada holdings</div>}
            </div>

            {/* Top Gainers */}
            <div className="panel-section">
              <div className="panel-title">Top Gainers</div>
              {gainers.map(q => (
                <div key={q.ticker} className="mover-item" style={{ cursor: "pointer" }}
                  onClick={() => { setSelectedTicker(q.ticker); setPage("CHART"); }}>
                  <span className="mv-sym">{q.ticker.replace(".JK", "")}</span>
                  <div className="mv-bar" style={{ background: `linear-gradient(to right,#00d68f88,transparent)` }} />
                  <span className="mv-ch up">+{q.change_pct.toFixed(2)}%</span>
                </div>
              ))}
              {!gainers.length && <div style={{ fontSize: 9, color: "#2a4060" }}>—</div>}
            </div>

            {/* Top Losers */}
            <div className="panel-section">
              <div className="panel-title">Top Losers</div>
              {losers.map(q => (
                <div key={q.ticker} className="mover-item" style={{ cursor: "pointer" }}
                  onClick={() => { setSelectedTicker(q.ticker); setPage("CHART"); }}>
                  <span className="mv-sym">{q.ticker.replace(".JK", "")}</span>
                  <div className="mv-bar" style={{ background: `linear-gradient(to right,#ff456088,transparent)` }} />
                  <span className="mv-ch dn">{q.change_pct.toFixed(2)}%</span>
                </div>
              ))}
              {!losers.length && <div style={{ fontSize: 9, color: "#2a4060" }}>—</div>}
            </div>

            {/* Quick Trade */}
            <div className="panel-section">
              <div className="panel-title">Quick Trade — {selectedTicker.replace(".JK", "")}</div>
              <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                {["BUY", "SELL"].map(a => (
                  <button key={a} onClick={() => setTradeAction(a)} style={{
                    flex: 1, padding: "6px 0", fontSize: 9, fontFamily: "'Syne',sans-serif",
                    fontWeight: 700, letterSpacing: 1, border: "none", borderRadius: 3, cursor: "pointer",
                    background: tradeAction === a
                      ? (a === "BUY" ? "#00d68f33" : "#ff456033")
                      : "#0a1628",
                    color: tradeAction === a
                      ? (a === "BUY" ? "#00d68f" : "#ff4560")
                      : "#4a6080",
                    borderTop: `2px solid ${tradeAction === a ? (a === "BUY" ? "#00d68f" : "#ff4560") : "transparent"}`,
                  }}>{a}</button>
                ))}
              </div>
              <input
                className="trade-input"
                type="number"
                placeholder="Jumlah lot"
                value={tradeLots}
                onChange={e => setTradeLots(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleTrade()}
              />
              {selectedQuote && tradeLots && (
                <div style={{ fontSize: 9, color: "#4a6080", marginBottom: 6 }}>
                  ≈ {fmtRp(parseInt(tradeLots, 10) * 100 * selectedQuote.price)}
                </div>
              )}
              <button onClick={handleTrade} style={{
                width: "100%", padding: "7px 0", fontSize: 9, fontFamily: "'Syne',sans-serif",
                fontWeight: 700, letterSpacing: 1, border: "none", borderRadius: 3, cursor: "pointer",
                background: tradeAction === "BUY" ? "#00d68f" : "#ff4560",
                color: "#050a14",
              }}>{tradeAction === "BUY" ? "▲ BUY" : "▼ SELL"}</button>
              {tradeMsg && (
                <div style={{
                  marginTop: 6, padding: "5px 8px", borderRadius: 3, fontSize: 9,
                  background: tradeMsg.ok ? "#00d68f11" : "#ff456011",
                  color: tradeMsg.ok ? "#00d68f" : "#ff4560",
                  border: `1px solid ${tradeMsg.ok ? "#00d68f33" : "#ff456033"}`,
                }}>{tradeMsg.message}</div>
              )}
            </div>

          </div>{/* end panel */}

        </div>{/* end body */}
      </div>{/* end terminal */}
    </>
  );
}

// ── IndexPill sub-component ───────────────────────────────────────────────────
function IndexPill({ label, data }) {
  return (
    <div className="ihsg-pill">
      <span className="ihsg-label">{label}</span>
      <span className="ihsg-val">{data ? data.price.toLocaleString("id") : "—"}</span>
      {data && (
        <span className={`ihsg-ch ${data.change_pct >= 0 ? "up" : "dn"}`}>
          {data.change_pct >= 0 ? "▲" : "▼"} {Math.abs(data.change_pct).toFixed(2)}%
        </span>
      )}
    </div>
  );
}

// ── Indicator calculations ────────────────────────────────────────────────────
function calcIndicators(candles) {
  if (!candles || candles.length < 14) {
    return { ma20: null, ma50: null, rsi: null, macd: null };
  }
  const closes = candles.map(c => c.close);

  const sma = (arr, n) => {
    if (arr.length < n) return null;
    return arr.slice(-n).reduce((s, v) => s + v, 0) / n;
  };

  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);

  // RSI-14
  let gains = 0, losses = 0;
  const slice = closes.slice(-15);
  for (let i = 1; i < slice.length; i++) {
    const d = slice[i] - slice[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const avgG = gains / 14, avgL = losses / 14;
  const rsi = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);

  // MACD (12-26 EMA diff, simplified dengan SMA)
  const ema12 = sma(closes, 12);
  const ema26 = sma(closes, 26);
  const macd = ema12 !== null && ema26 !== null ? ema12 - ema26 : null;

  return {
    ma20: ma20 ? Math.round(ma20) : null,
    ma50: ma50 ? Math.round(ma50) : null,
    rsi: rsi ? Math.round(rsi * 10) / 10 : null,
    macd: macd ? Math.round(macd * 10) / 10 : null,
  };
}
