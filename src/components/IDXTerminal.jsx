import { useState, useEffect, useRef, useCallback } from "react";

// ── Fonts via CSS injection ──────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700;800&display=swap";
document.head.appendChild(fontLink);

// ── Mock Data ────────────────────────────────────────────────────────────
const MOCK_TICKERS = [
  { s: "BBCA.JK", p: 9850, ch: 0.51, v: "12.4M", high: 9900, low: 9750 },
  { s: "ANTM.JK", p: 1620, ch: -1.22, v: "45.1M", high: 1650, low: 1605 },
  { s: "TLKM.JK", p: 3280, ch: 0.31, v: "8.7M", high: 3310, low: 3250 },
  { s: "BMRI.JK", p: 6125, ch: -0.81, v: "22.3M", high: 6175, low: 6100 },
  { s: "ASII.JK", p: 4520, ch: 1.35, v: "18.9M", high: 4575, low: 4490 },
  { s: "BBRI.JK", p: 4210, ch: -0.47, v: "31.2M", high: 4250, low: 4195 },
  { s: "UNVR.JK", p: 2480, ch: 0.81, v: "5.3M", high: 2510, low: 2460 },
  { s: "GOTO.JK", p: 68, ch: -2.86, v: "189.2M", high: 72, low: 66 },
];

const MOCK_GAINERS = [
  { s: "ASII.JK", ch: 1.35, p: 4520 },
  { s: "UNVR.JK", ch: 0.81, p: 2480 },
  { s: "BBCA.JK", ch: 0.51, p: 9850 },
];
const MOCK_LOSERS = [
  { s: "GOTO.JK", ch: -2.86, p: 68 },
  { s: "ANTM.JK", ch: -1.22, p: 1620 },
  { s: "BMRI.JK", ch: -0.81, p: 6125 },
];

const HOLDINGS = [
  { s: "ELTY.JK",  lots: 1560, avg: 48.1,  cur: 50,   pnl: 2.9 },
  { s: "ANTM.JK",  lots: 42,   avg: 4350,  cur: 1620, pnl: -62.8 },
  { s: "ENRG.JK",  lots: 200,  avg: 1750,  cur: 1805, pnl: 3.1 },
  { s: "BNBR.JK",  lots: 900,  avg: 205,   cur: 198,  pnl: -3.4 },
  { s: "DEWA.JK",  lots: 400,  avg: 530,   cur: 560,  pnl: 5.7 },
];

// ── Candlestick Generator ────────────────────────────────────────────────
function generateCandles(n = 60) {
  let price = 9800;
  return Array.from({ length: n }, (_, i) => {
    const open = price;
    const chg = (Math.random() - 0.48) * 120;
    const close = Math.max(100, open + chg);
    const high = Math.max(open, close) + Math.random() * 60;
    const low = Math.min(open, close) - Math.random() * 60;
    const vol = Math.floor(Math.random() * 5000000 + 500000);
    price = close;
    const d = new Date(Date.now() - (n - i) * 86400000);
    return { open, high, low, close, vol, date: d.toLocaleDateString("id", { day: "2-digit", month: "short" }) };
  });
}

// ── Sparkline ────────────────────────────────────────────────────────────
function Sparkline({ data, color, width = 80, height = 28 }) {
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

// ── Mini Candlestick Chart ───────────────────────────────────────────────
function CandleChart({ candles, width = 520, height = 220 }) {
  const padL = 48, padR = 12, padT = 12, padB = 28;
  const cW = width - padL - padR;
  const cH = height - padT - padB;
  const prices = candles.flatMap(c => [c.high, c.low]);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const barW = Math.max(2, cW / candles.length - 1.5);

  const py = v => padT + cH - ((v - minP) / range) * cH;
  const px = i => padL + (i + 0.5) * (cW / candles.length);

  const priceLabels = [minP, minP + range * 0.25, minP + range * 0.5, minP + range * 0.75, maxP];

  return (
    <svg width={width} height={height} style={{ display: "block", width: "100%", height: "100%" }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {/* Grid lines */}
      {priceLabels.map((p, i) => (
        <g key={i}>
          <line x1={padL} x2={width - padR} y1={py(p)} y2={py(p)} stroke="#1e293b" strokeWidth="1" />
          <text x={padL - 4} y={py(p) + 4} textAnchor="end" fontSize="8" fill="#475569">
            {(p / 1000).toFixed(1)}k
          </text>
        </g>
      ))}
      {/* Candles */}
      {candles.map((c, i) => {
        const x = px(i);
        const isUp = c.close >= c.open;
        const col = isUp ? "#00d68f" : "#ff4560";
        const bodyTop = py(Math.max(c.open, c.close));
        const bodyBot = py(Math.min(c.open, c.close));
        const bodyH = Math.max(1, bodyBot - bodyTop);
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={py(c.high)} y2={py(c.low)} stroke={col} strokeWidth="1" />
            <rect x={x - barW / 2} y={bodyTop} width={barW} height={bodyH} fill={col} />
          </g>
        );
      })}
      {/* Date labels (every 10) */}
      {candles.map((c, i) => i % 10 === 0 && (
        <text key={i} x={px(i)} y={height - 4} textAnchor="middle" fontSize="7" fill="#475569">
          {c.date}
        </text>
      ))}
    </svg>
  );
}

// ── Volume Bars ──────────────────────────────────────────────────────────
function VolumeBars({ candles, width = 520, height = 50 }) {
  const maxVol = Math.max(...candles.map(c => c.vol));
  const padL = 48, padR = 12;
  const cW = width - padL - padR;
  const barW = Math.max(2, cW / candles.length - 1.5);
  const px = i => padL + (i + 0.5) * (cW / candles.length);

  return (
    <svg width={width} height={height} style={{ display: "block", width: "100%", height: "100%" }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {candles.map((c, i) => {
        const isUp = c.close >= c.open;
        const barH = (c.vol / maxVol) * (height - 4);
        return (
          <rect key={i} x={px(i) - barW / 2} y={height - barH} width={barW} height={barH}
            fill={isUp ? "#00d68f44" : "#ff456044"} />
        );
      })}
    </svg>
  );
}

// ── Heatmap Cell ─────────────────────────────────────────────────────────
const HEATMAP_DATA = [
  { s: "BBCA", cap: 9, ch: 0.51 }, { s: "BMRI", cap: 7, ch: -0.81 },
  { s: "TLKM", cap: 6, ch: 0.31 }, { s: "BBRI", cap: 6, ch: -0.47 },
  { s: "ASII", cap: 5, ch: 1.35 }, { s: "ANTM", cap: 3, ch: -1.22 },
  { s: "UNVR", cap: 4, ch: 0.81 }, { s: "GOTO", cap: 2, ch: -2.86 },
  { s: "INDF", cap: 3, ch: 0.22 }, { s: "ICBP", cap: 3, ch: -0.15 },
  { s: "BRIS", cap: 2, ch: 1.10 }, { s: "PGAS", cap: 2, ch: -0.55 },
];

// ── Main App ─────────────────────────────────────────────────────────────
const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #050a14; }

  .terminal {
    font-family: 'Space Mono', monospace;
    background: #050a14;
    color: #c8d8f0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Topbar ── */
  .topbar {
    display: flex; align-items: center; gap: 0;
    background: #080f1e;
    border-bottom: 1px solid #0f2040;
    padding: 0 16px;
    height: 48px;
    flex-shrink: 0;
  }
  .logo {
    font-family: 'Syne', sans-serif;
    font-weight: 800; font-size: 15px;
    color: #00d68f;
    letter-spacing: 2px;
    margin-right: 24px;
    white-space: nowrap;
  }
  .logo span { color: #3b82f6; }
  .ihsg-pill {
    display: flex; align-items: center; gap: 8px;
    background: #0a1628; border: 1px solid #0f2040;
    border-radius: 4px; padding: 4px 12px;
    margin-right: 16px;
  }
  .ihsg-label { font-size: 9px; color: #4a6080; letter-spacing: 1px; text-transform: uppercase; }
  .ihsg-val { font-size: 13px; color: #e2eaf8; font-weight: 700; }
  .ihsg-ch { font-size: 11px; }
  .up { color: #00d68f; }
  .dn { color: #ff4560; }
  .neutral { color: #94a3b8; }

  .market-status {
    display: flex; align-items: center; gap: 6px;
    font-size: 9px; color: #4a6080; letter-spacing: 1px;
    margin-right: auto; margin-left: 16px;
  }
  .dot-pulse {
    width: 6px; height: 6px; border-radius: 50%;
    background: #00d68f;
    animation: pulse 2s infinite;
  }
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
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

  .chart-area {
    flex: 1; padding: 12px;
    display: flex; flex-direction: column; gap: 8px;
    min-height: 0;
  }
  .chart-header { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .chart-ticker {
    font-family: 'Syne', sans-serif; font-weight: 800;
    font-size: 18px; color: #e2eaf8;
  }
  .chart-price { font-size: 22px; font-weight: 700; color: #00d68f; }
  .chart-chg { font-size: 12px; }
  .period-tabs { display: flex; gap: 2px; margin-left: auto; }
  .period-btn {
    padding: 3px 10px; font-size: 9px; border: 1px solid #0f2040;
    background: transparent; color: #4a6080; cursor: pointer; border-radius: 3px;
    font-family: 'Space Mono', monospace;
    transition: all 0.12s;
  }
  .period-btn:hover { border-color: #1e3a5f; color: #8aa8cc; }
  .period-btn.active { border-color: #00d68f44; color: #00d68f; background: #00d68f0d; }

  .chart-box {
    background: #070d1c; border: 1px solid #0f2040;
    border-radius: 6px; flex: 1; min-height: 0;
    overflow: hidden; display: flex; flex-direction: column;
  }
  .chart-inner { flex: 1; padding: 8px 4px 0; min-height: 0; }
  .vol-inner { height: 50px; padding: 0 4px; }

  .indicator-row {
    display: flex; gap: 12px; padding: 6px 12px;
    border-top: 1px solid #0a1830; flex-shrink: 0;
  }
  .ind-pill {
    font-size: 9px; padding: 2px 8px;
    border: 1px solid #0f2040; border-radius: 3px;
    color: #4a6080;
  }
  .ind-pill span { color: #94a3b8; margin-left: 4px; }

  /* ── Bottom bar ── */
  .feed-bar {
    height: 32px; background: #070d1c;
    border-top: 1px solid #0f2040;
    display: flex; align-items: center;
    overflow: hidden; flex-shrink: 0;
  }
  .feed-label {
    font-size: 8px; letter-spacing: 2px; color: #2a4060;
    padding: 0 12px; white-space: nowrap; flex-shrink: 0;
    border-right: 1px solid #0f2040; height: 100%;
    display: flex; align-items: center;
    font-family: 'Syne', sans-serif; font-weight: 700;
  }
  .ticker-tape { display: flex; gap: 24px; overflow: hidden; padding: 0 16px; }
  .tape-item { display: flex; gap: 6px; font-size: 9px; white-space: nowrap; }
  .tape-sym { color: #8aa8cc; }

  /* ── Right Panel ── */
  .right-panel {
    width: 240px; flex-shrink: 0;
    background: #070d1c;
    border-left: 1px solid #0f2040;
    display: flex; flex-direction: column;
    overflow-y: auto;
  }
  .panel-section { border-bottom: 1px solid #0a1830; padding: 10px; }
  .panel-title {
    font-size: 8px; letter-spacing: 2px; color: #2a4060;
    text-transform: uppercase; margin-bottom: 8px;
    font-family: 'Syne', sans-serif; font-weight: 700;
  }

  .pf-summary { display: flex; flex-direction: column; gap: 4px; }
  .pf-row { display: flex; justify-content: space-between; align-items: center; }
  .pf-label { font-size: 9px; color: #4a6080; }
  .pf-val { font-size: 11px; color: #c8d8f0; }

  .holding-item {
    padding: 5px 4px; border-radius: 4px;
    cursor: pointer; transition: background 0.1s;
  }
  .holding-item:hover { background: #0a1628; }
  .hi-row1 { display: flex; justify-content: space-between; }
  .hi-sym { font-size: 10px; color: #8aa8cc; font-weight: 700; }
  .hi-lots { font-size: 8px; color: #2a4060; }
  .hi-row2 { display: flex; justify-content: space-between; margin-top: 1px; }
  .hi-avg { font-size: 9px; color: #4a6080; }
  .hi-pnl { font-size: 9px; }

  .mover-item {
    display: flex; justify-content: space-between;
    align-items: center; padding: 4px 0;
  }
  .mv-sym { font-size: 9px; color: #8aa8cc; }
  .mv-bar { flex: 1; margin: 0 8px; height: 2px; border-radius: 1px; }
  .mv-ch { font-size: 10px; font-weight: 700; }

  /* ── Heatmap ── */
  .heatmap-grid {
    display: flex; flex-wrap: wrap; gap: 3px;
  }
  .hm-cell {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    border-radius: 3px; cursor: pointer;
    transition: opacity 0.15s;
  }
  .hm-cell:hover { opacity: 0.8; }
  .hm-sym { font-size: 8px; font-weight: 700; color: #000a; }
  .hm-ch  { font-size: 7px; color: #000a; }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #050a14; }
  ::-webkit-scrollbar-thumb { background: #0f2040; border-radius: 2px; }

  /* ── Animations ── */
  @keyframes flash-up { 0%,100%{background:transparent} 50%{background:#00d68f22} }
  @keyframes flash-dn { 0%,100%{background:transparent} 50%{background:#ff456022} }
  .flash-up { animation: flash-up 0.6s ease; }
  .flash-dn { animation: flash-dn 0.6s ease; }

  @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
  .slide-in { animation: slideIn 0.3s ease; }
`;

const PERIODS = ["1m", "5m", "15m", "1h", "1D", "1W", "1M"];
const PAGES = ["MARKET", "CHART", "PORTFOLIO", "SCREENER", "ALERTS", "HEATMAP"];

export default function IDXTerminal() {
  const [page, setPage] = useState("CHART");
  const [selectedTicker, setSelectedTicker] = useState("BBCA.JK");
  const [period, setPeriod] = useState("1D");
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(MOCK_TICKERS.map(t => [t.s, t.p]))
  );
  const [candles] = useState(() => generateCandles(60));
  const [flashMap, setFlashMap] = useState({});
  const [time, setTime] = useState(new Date());
  const prevPrices = useRef({ ...prices });

  // Simulate price updates
  useEffect(() => {
    const iv = setInterval(() => {
      setTime(new Date());
      setPrices(prev => {
        const next = { ...prev };
        const flashes = {};
        MOCK_TICKERS.forEach(t => {
          const delta = (Math.random() - 0.5) * t.p * 0.002;
          const newP = Math.max(1, Math.round((prev[t.s] + delta) * 10) / 10);
          if (newP !== prev[t.s]) {
            flashes[t.s] = newP > prev[t.s] ? "up" : "dn";
          }
          next[t.s] = newP;
        });
        prevPrices.current = prev;
        setFlashMap(flashes);
        setTimeout(() => setFlashMap({}), 700);
        return next;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  const selectedData = MOCK_TICKERS.find(t => t.s === selectedTicker) || MOCK_TICKERS[0];
  const curPrice = prices[selectedTicker] || selectedData.p;

  // Sparkline data (fake)
  const sparklines = Object.fromEntries(
    MOCK_TICKERS.map(t => [t.s, Array.from({ length: 20 }, (_, i) =>
      t.p + (Math.random() - 0.5) * t.p * 0.03 * (i + 1)
    )])
  );

  const fmtRp = v => `${(v / 1_000_000).toFixed(1)}M`;
  const fmtPrice = v => v >= 1000 ? v.toLocaleString("id") : v;

  return (
    <>
      <style>{CSS}</style>
      <div className="terminal">

        {/* ── TOPBAR ── */}
        <div className="topbar">
          <div className="logo">IDX<span>TERMINAL</span></div>

          <div className="ihsg-pill">
            <span className="ihsg-label">IHSG</span>
            <span className="ihsg-val">7,284.50</span>
            <span className="ihsg-ch up">▲ 0.43%</span>
          </div>
          <div className="ihsg-pill">
            <span className="ihsg-label">LQ45</span>
            <span className="ihsg-val">912.30</span>
            <span className="ihsg-ch dn">▼ 0.18%</span>
          </div>
          <div className="market-status">
            <div className="dot-pulse" />
            <span>LIVE</span>
            <span style={{ color: "#2a4060" }}>·</span>
            <span>{time.toLocaleTimeString("id", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            <span style={{ color: "#2a4060" }}>WIB</span>
          </div>

          <div className="nav-tabs">
            {PAGES.map(p => (
              <button key={p} className={`nav-tab${page === p ? " active" : ""}`}
                onClick={() => setPage(p)}>{p}</button>
            ))}
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="body">

          {/* ── LEFT SIDEBAR ── */}
          <div className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-title">Watchlist</div>
              {MOCK_TICKERS.map(t => {
                const cur = prices[t.s] || t.p;
                const fl = flashMap[t.s];
                return (
                  <div key={t.s}
                    className={`watchlist-item${selectedTicker === t.s ? " active" : ""}${fl ? " flash-" + fl : ""}`}
                    onClick={() => setSelectedTicker(t.s)}>
                    <div>
                      <div className="wi-sym">{t.s.replace(".JK", "")}</div>
                      <div className="wi-spark">
                        <Sparkline data={sparklines[t.s]} color={t.ch >= 0 ? "#00d68f" : "#ff4560"} width={60} height={20} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="wi-price">{fmtPrice(cur)}</div>
                      <div className={`wi-ch ${t.ch >= 0 ? "up" : "dn"}`}>
                        {t.ch >= 0 ? "▲" : "▼"} {Math.abs(t.ch)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── MAIN AREA ── */}
          <div className="main">

            {page === "CHART" && (
              <div className="chart-area">
                {/* Chart header */}
                <div className="chart-header">
                  <div className="chart-ticker">{selectedTicker.replace(".JK", "")}</div>
                  <div>
                    <div className="chart-price">{fmtPrice(curPrice)}</div>
                    <div className={`chart-chg ${selectedData.ch >= 0 ? "up" : "dn"}`}>
                      {selectedData.ch >= 0 ? "▲" : "▼"} {Math.abs(selectedData.ch)}%
                      &nbsp;·&nbsp;H: {fmtPrice(selectedData.high)}&nbsp;L: {fmtPrice(selectedData.low)}
                      &nbsp;·&nbsp;Vol: {selectedData.v}
                    </div>
                  </div>
                  <div className="period-tabs">
                    {PERIODS.map(p => (
                      <button key={p} className={`period-btn${period === p ? " active" : ""}`}
                        onClick={() => setPeriod(p)}>{p}</button>
                    ))}
                  </div>
                </div>

                {/* Chart box */}
                <div className="chart-box">
                  <div className="chart-inner">
                    <CandleChart candles={candles} width={520} height={220} />
                  </div>
                  <div className="vol-inner">
                    <VolumeBars candles={candles} width={520} height={48} />
                  </div>
                  <div className="indicator-row">
                    <div className="ind-pill">MA20<span style={{ color: "#f59e0b" }}>9,812</span></div>
                    <div className="ind-pill">MA50<span style={{ color: "#3b82f6" }}>9,640</span></div>
                    <div className="ind-pill">RSI<span style={{ color: "#a78bfa" }}>52.3</span></div>
                    <div className="ind-pill">MACD<span className="up">▲ 28.4</span></div>
                    <div className="ind-pill" style={{ marginLeft: "auto", cursor: "pointer", color: "#3b82f6", borderColor: "#1e3a6e" }}>
                      + Indicator
                    </div>
                  </div>
                </div>
              </div>
            )}

            {page === "MARKET" && (
              <div style={{ padding: 12, overflow: "auto", height: "100%" }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, letterSpacing: 2, color: "#2a4060", marginBottom: 10, textTransform: "uppercase" }}>Market Overview</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {[
                    { label: "GAINERS", items: MOCK_GAINERS, color: "#00d68f" },
                    { label: "LOSERS", items: MOCK_LOSERS, color: "#ff4560" },
                  ].map(g => (
                    <div key={g.label} style={{ background: "#070d1c", border: "1px solid #0f2040", borderRadius: 6, padding: 10 }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 8, letterSpacing: 2, color: "#2a4060", marginBottom: 8 }}>{g.label}</div>
                      {g.items.map(t => (
                        <div key={t.s} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #0a1830" }}>
                          <span style={{ fontSize: 10, color: "#8aa8cc" }}>{t.s.replace(".JK", "")}</span>
                          <span style={{ fontSize: 10, color: g.color, fontWeight: 700 }}>{t.ch > 0 ? "+" : ""}{t.ch}%</span>
                          <span style={{ fontSize: 10, color: "#c8d8f0" }}>{t.p.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div style={{ background: "#070d1c", border: "1px solid #0f2040", borderRadius: 6, padding: 10 }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 8, letterSpacing: 2, color: "#2a4060", marginBottom: 8 }}>ALL STOCKS</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <thead>
                      <tr style={{ color: "#2a4060", borderBottom: "1px solid #0f2040" }}>
                        {["Symbol", "Last", "Change", "Volume", "High", "Low"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "4px 8px", fontWeight: 400, letterSpacing: 1, fontSize: 8 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_TICKERS.map(t => {
                        const fl = flashMap[t.s];
                        return (
                          <tr key={t.s} className={fl ? `flash-${fl}` : ""} style={{ borderBottom: "1px solid #0a1830", cursor: "pointer" }}
                            onClick={() => { setSelectedTicker(t.s); setPage("CHART"); }}>
                            <td style={{ padding: "5px 8px", color: "#8aa8cc", fontWeight: 700 }}>{t.s.replace(".JK", "")}</td>
                            <td style={{ padding: "5px 8px", color: "#c8d8f0" }}>{fmtPrice(prices[t.s] || t.p)}</td>
                            <td style={{ padding: "5px 8px" }} className={t.ch >= 0 ? "up" : "dn"}>{t.ch >= 0 ? "▲" : "▼"} {Math.abs(t.ch)}%</td>
                            <td style={{ padding: "5px 8px", color: "#4a6080" }}>{t.v}</td>
                            <td style={{ padding: "5px 8px", color: "#4a6080" }}>{fmtPrice(t.high)}</td>
                            <td style={{ padding: "5px 8px", color: "#4a6080" }}>{fmtPrice(t.low)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {page === "PORTFOLIO" && (
              <div style={{ padding: 12, overflow: "auto" }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, letterSpacing: 2, color: "#2a4060", marginBottom: 10, textTransform: "uppercase" }}>Portfolio Simulator</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
                  {[
                    { label: "SALDO KAS", val: "Rp357.500", col: "#c8d8f0" },
                    { label: "TOTAL PORTOFOLIO", val: "Rp98.2M", col: "#c8d8f0" },
                    { label: "REALIZED P&L", val: "+Rp2.1M", col: "#00d68f" },
                    { label: "FLOATING P&L", val: "-Rp840K", col: "#ff4560" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "#070d1c", border: "1px solid #0f2040", borderRadius: 6, padding: 12 }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 7, letterSpacing: 2, color: "#2a4060", marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: s.col }}>{s.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#070d1c", border: "1px solid #0f2040", borderRadius: 6, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <thead>
                      <tr style={{ color: "#2a4060", borderBottom: "1px solid #0f2040", background: "#050a14" }}>
                        {["Ticker", "Lots", "Avg Cost", "Cur Price", "Market Val", "P&L %"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 400, letterSpacing: 1, fontSize: 8 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {HOLDINGS.map(h => (
                        <tr key={h.s} style={{ borderBottom: "1px solid #0a1830", cursor: "pointer" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#0a1628"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "8px 12px", color: "#8aa8cc", fontWeight: 700 }}>{h.s.replace(".JK", "")}</td>
                          <td style={{ padding: "8px 12px", color: "#c8d8f0" }}>{h.lots.toLocaleString()}</td>
                          <td style={{ padding: "8px 12px", color: "#4a6080" }}>{fmtPrice(h.avg)}</td>
                          <td style={{ padding: "8px 12px", color: "#c8d8f0" }}>{fmtPrice(h.cur)}</td>
                          <td style={{ padding: "8px 12px", color: "#c8d8f0" }}>Rp{(h.cur * h.lots * 100 / 1_000_000).toFixed(1)}M</td>
                          <td style={{ padding: "8px 12px" }} className={h.pnl >= 0 ? "up" : "dn"}>
                            {h.pnl >= 0 ? "▲" : "▼"} {Math.abs(h.pnl)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {page === "HEATMAP" && (
              <div style={{ padding: 12 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, letterSpacing: 2, color: "#2a4060", marginBottom: 10, textTransform: "uppercase" }}>Market Heatmap — IDX</div>
                <div className="heatmap-grid">
                  {HEATMAP_DATA.map(c => {
                    const abs = Math.min(Math.abs(c.ch), 3);
                    const intensity = abs / 3;
                    const bg = c.ch >= 0
                      ? `rgba(0, ${Math.floor(100 + 110 * intensity)}, ${Math.floor(80 * (1 - intensity))}, ${0.4 + 0.5 * intensity})`
                      : `rgba(${Math.floor(150 + 105 * intensity)}, ${Math.floor(50 * (1 - intensity))}, ${Math.floor(40 * (1 - intensity))}, ${0.4 + 0.5 * intensity})`;
                    const size = 60 + c.cap * 10;
                    return (
                      <div key={c.s} className="hm-cell" style={{ width: size, height: size, background: bg }}>
                        <span className="hm-sym">{c.s}</span>
                        <span className="hm-ch">{c.ch > 0 ? "+" : ""}{c.ch}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {page === "SCREENER" && (
              <div style={{ padding: 12, color: "#4a6080", fontFamily: "'Syne',sans-serif", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                  <div>Stock Screener</div>
                  <div style={{ fontSize: 9, marginTop: 4, color: "#2a4060" }}>Coming in Phase 4</div>
                </div>
              </div>
            )}

            {page === "ALERTS" && (
              <div style={{ padding: 12, color: "#4a6080", fontFamily: "'Syne',sans-serif", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
                  <div>Price Alerts</div>
                  <div style={{ fontSize: 9, marginTop: 4, color: "#2a4060" }}>Coming in Phase 3</div>
                </div>
              </div>
            )}

            {/* ── FEED BAR ── */}
            <div className="feed-bar">
              <div className="feed-label">LIVE FEED</div>
              <div className="ticker-tape">
                {MOCK_TICKERS.map(t => (
                  <div key={t.s} className="tape-item">
                    <span className="tape-sym">{t.s.replace(".JK", "")}</span>
                    <span style={{ color: "#c8d8f0" }}>{fmtPrice(prices[t.s] || t.p)}</span>
                    <span className={t.ch >= 0 ? "up" : "dn"}>{t.ch >= 0 ? "▲" : "▼"}{Math.abs(t.ch)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="right-panel">
            {/* Portfolio Summary */}
            <div className="panel-section">
              <div className="panel-title">Portfolio</div>
              <div className="pf-summary">
                {[
                  { l: "Kas", v: "Rp357.5K" },
                  { l: "Total", v: "Rp98.2M" },
                  { l: "P&L Realized", v: <span className="up">+Rp2.1M</span> },
                  { l: "Floating", v: <span className="dn">-Rp840K</span> },
                ].map(r => (
                  <div key={r.l} className="pf-row">
                    <span className="pf-label">{r.l}</span>
                    <span className="pf-val">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Holdings */}
            <div className="panel-section">
              <div className="panel-title">Holdings</div>
              {HOLDINGS.map(h => (
                <div key={h.s} className="holding-item">
                  <div className="hi-row1">
                    <span className="hi-sym">{h.s.replace(".JK", "")}</span>
                    <span className="hi-lots">{h.lots} lot</span>
                  </div>
                  <div className="hi-row2">
                    <span className="hi-avg">avg {fmtPrice(h.avg)}</span>
                    <span className={`hi-pnl ${h.pnl >= 0 ? "up" : "dn"}`}>
                      {h.pnl >= 0 ? "+" : ""}{h.pnl}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Top Gainers */}
            <div className="panel-section">
              <div className="panel-title">Top Gainers</div>
              {MOCK_GAINERS.map(t => (
                <div key={t.s} className="mover-item">
                  <span className="mv-sym">{t.s.replace(".JK", "")}</span>
                  <div className="mv-bar" style={{ background: `linear-gradient(to right, #00d68f${Math.floor(t.ch / 3 * 255).toString(16).padStart(2, "0")}, transparent)` }} />
                  <span className="mv-ch up">+{t.ch}%</span>
                </div>
              ))}
            </div>

            {/* Top Losers */}
            <div className="panel-section">
              <div className="panel-title">Top Losers</div>
              {MOCK_LOSERS.map(t => (
                <div key={t.s} className="mover-item">
                  <span className="mv-sym">{t.s.replace(".JK", "")}</span>
                  <div className="mv-bar" style={{ background: `linear-gradient(to right, #ff4560${Math.floor(Math.abs(t.ch) / 3 * 255).toString(16).padStart(2, "0")}, transparent)` }} />
                  <span className="mv-ch dn">{t.ch}%</span>
                </div>
              ))}
            </div>

            {/* Quick Trade */}
            <div className="panel-section">
              <div className="panel-title">Quick Trade</div>
              <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                {["BUY", "SELL"].map(a => (
                  <button key={a} style={{
                    flex: 1, padding: "6px 0", fontSize: 9, fontFamily: "'Syne',sans-serif",
                    fontWeight: 700, letterSpacing: 1, border: "none", borderRadius: 3, cursor: "pointer",
                    background: a === "BUY" ? "#00d68f22" : "#ff456022",
                    color: a === "BUY" ? "#00d68f" : "#ff4560",
                    borderTop: `2px solid ${a === "BUY" ? "#00d68f" : "#ff4560"}`
                  }}>{a}</button>
                ))}
              </div>
              <input placeholder="Ticker" style={{
                width: "100%", background: "#050a14", border: "1px solid #0f2040",
                borderRadius: 3, padding: "5px 8px", color: "#c8d8f0",
                fontSize: 10, fontFamily: "'Space Mono', monospace", marginBottom: 4
              }} />
              <div style={{ display: "flex", gap: 4 }}>
                <input placeholder="Lots" style={{
                  flex: 1, background: "#050a14", border: "1px solid #0f2040",
                  borderRadius: 3, padding: "5px 8px", color: "#c8d8f0",
                  fontSize: 10, fontFamily: "'Space Mono', monospace"
                }} />
                <input placeholder="Price" style={{
                  flex: 1, background: "#050a14", border: "1px solid #0f2040",
                  borderRadius: 3, padding: "5px 8px", color: "#c8d8f0",
                  fontSize: 10, fontFamily: "'Space Mono', monospace"
                }} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}