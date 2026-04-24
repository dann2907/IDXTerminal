// src/components/chart/MultiTimeframeChart.tsx
//
// Production-grade multi-timeframe candlestick chart.
//
// Performance contract:
//   ✓ Chart instance created ONCE on mount, never recreated
//   ✓ Timeframe switch → series.setData() (one call, fast)
//   ✓ Real-time tick → series.update() (single bar, no flicker)
//   ✓ Zustand subscription only for status/error — not candle data
//     (candles flow through ref + imperative series API)
//   ✓ ResizeObserver for width — avoids layout thrashing
//   ✓ Volume pane is a separate chart (independent zoom/scroll)

import {
  useEffect, useRef, useCallback, useState, useMemo,
} from "react";
import {
  createChart,
  CrosshairMode,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  useChartStore,
  chartKey,
  TIMEFRAMES,
  type Timeframe,
  type CandleBar,
} from "../../stores/useChartStore";
import { useChartWebSocket, fetchCandles } from "../../hooks/useChartWebSocket";

// ── Props ──────────────────────────────────────────────────────────────────

interface MultiTimeframeChartProps {
  ticker:             string;
  defaultTimeframe?:  Timeframe;
  height?:            number;
}

// ── Theme ──────────────────────────────────────────────────────────────────

const T = {
  bg:       "#070d1c",
  bgDark:   "#040a14",
  surface:  "#0a1628",
  border:   "#0f2040",
  grid:     "#0a1628",
  text:     "#4a6080",
  textMid:  "#8aa8cc",
  textHi:   "#c8d8f0",
  up:       "#00d68f",
  dn:       "#ff4560",
  volUp:    "rgba(0, 214, 143, 0.35)",
  volDn:    "rgba(255, 69, 96, 0.35)",
  accent:   "#2e8fdf",
  warn:     "#f59e0b",
  sk:       "#0d1e35",    // skeleton base
} as const;

const CHART_BASE = {
  layout: {
    background: { type: ColorType.Solid, color: T.bg },
    textColor:  T.text,
    fontFamily: "'Space Mono', monospace",
    fontSize:   11,
  },
  grid: {
    vertLines: { color: T.grid },
    horzLines: { color: T.grid },
  },
  crosshair: {
    mode:     CrosshairMode.Normal,
    vertLine: { color: "#2e4a70", labelBackgroundColor: T.surface },
    horzLine: { color: "#2e4a70", labelBackgroundColor: T.surface },
  },
  rightPriceScale: { borderColor: T.border },
  timeScale:       { borderColor: T.border, timeVisible: true, secondsVisible: false },
} as const;

// ── Sub-components ─────────────────────────────────────────────────────────

function Skeleton({ height }: { height: number }) {
  return (
    <div style={{ height, background: T.bg, position: "relative", overflow: "hidden" }}>
      {/* Animated shimmer bars */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", padding: "16px 8px", gap: 2 }}>
        {Array.from({ length: 60 }, (_, i) => {
          const h = 15 + Math.sin(i * 0.6) * 12 + Math.cos(i * 0.25) * 8 + (i % 7) * 2.5;
          return (
            <div key={i} style={{
              flex: 1,
              height: `${Math.max(6, h)}%`,
              background: T.sk,
              borderRadius: 1,
              animation: `chartSkPulse 1.8s ease-in-out ${(i * 0.025).toFixed(3)}s infinite`,
            }} />
          );
        })}
      </div>

      {/* Center label */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        <div style={{ display: "flex", gap: 5 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: "50%",
              background: T.accent,
              animation: `chartDotBounce 1.3s ease-in-out ${(i * 0.22).toFixed(2)}s infinite`,
            }} />
          ))}
        </div>
        <span style={{ fontSize: 10, color: T.text, fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em" }}>
          Loading chart data...
        </span>
      </div>

      <style>{`
        @keyframes chartSkPulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.75; }
        }
        @keyframes chartDotBounce {
          0%, 80%, 100% { transform: translateY(0) scale(0.8); opacity: 0.4; }
          40%           { transform: translateY(-6px) scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function ErrorState({ ticker, onRetry }: { ticker: string; onRetry: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 12, padding: 32, background: T.bg,
    }}>
      <span style={{ fontSize: 22 }}>⚠</span>
      <span style={{ fontSize: 11, color: T.text, fontFamily: "'Space Mono', monospace" }}>
        Failed to load {ticker.replace(".JK", "")}
      </span>
      <button onClick={onRetry} style={{
        padding: "5px 16px", fontSize: 10, fontFamily: "'Syne', sans-serif",
        fontWeight: 700, borderRadius: 3, cursor: "pointer",
        background: "rgba(46,143,223,0.15)", color: T.accent,
        border: "1px solid rgba(46,143,223,0.4)",
      }}>
        Retry
      </button>
    </div>
  );
}

function TfButton({ tf, active, onClick }: { tf: Timeframe; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 12px", fontSize: 9,
      fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: 1,
      border: `1px solid ${active ? T.accent : "transparent"}`,
      borderRadius: 3, cursor: "pointer",
      background: active ? `${T.accent}1a` : "transparent",
      color:      active ? T.accent : T.text,
      transition: "all 0.12s",
    }}>
      {tf.toUpperCase()}
    </button>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function MultiTimeframeChart({
  ticker,
  defaultTimeframe = "15m",
  height = 340,
}: MultiTimeframeChartProps) {
  const [activeTf, setActiveTf] = useState<Timeframe>(defaultTimeframe);
  const activeKey = chartKey(ticker, activeTf);

  // Zustand — subscribe only to status, NOT candle arrays
  // (candle data flows imperative via series API, not React state)
  const status  = useChartStore(s => s.getStatus(activeKey));
  const hasData = useChartStore(s => s.hasData(activeKey));
  const { setLoading, setError, setCandles, getCandles } = useChartStore.getState();

  // ── DOM refs ────────────────────────────────────────────────────────────
  const mainRef = useRef<HTMLDivElement>(null);
  const volRef  = useRef<HTMLDivElement>(null);

  // ── Chart instance refs ─────────────────────────────────────────────────
  const mainChart     = useRef<IChartApi | null>(null);
  const volChart      = useRef<IChartApi | null>(null);
  const candleSeries  = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volSeries     = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Track which key is currently rendered in the chart
  // Used to decide setData vs update
  const renderedKey = useRef<string | null>(null);

  // ── Load data for a key ─────────────────────────────────────────────────
  const loadData = useCallback(async (ticker: string, tf: Timeframe) => {
    const key = chartKey(ticker, tf);

    // Cache hit — data already in store, no fetch needed
    if (useChartStore.getState().hasData(key)) return;

    setLoading(key);
    try {
      const candles = await fetchCandles(ticker, tf, "5d");
      if (candles.length === 0) throw new Error("No candle data returned");
      setCandles(key, candles);
    } catch (err) {
      setError(key, err instanceof Error ? err.message : "Fetch failed");
    }
  }, [setLoading, setCandles, setError]);

  // ── Apply candles to chart ──────────────────────────────────────────────
  // Called when: (a) data loads for first time, (b) user switches timeframe
  const applyCandles = useCallback((key: string) => {
    if (!candleSeries.current || !volSeries.current) return;

    const candles = getCandles(key);
    if (candles.length === 0) return;

    // type cast: lightweight-charts Time = UTCTimestamp (number in unix seconds)
    candleSeries.current.setData(
      candles.map(c => ({
        time:  c.time as UTCTimestamp,
        open:  c.open,
        high:  c.high,
        low:   c.low,
        close: c.close,
      }))
    );

    volSeries.current.setData(
      candles.map(c => ({
        time:  c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? T.volUp : T.volDn,
      }))
    );

    mainChart.current?.timeScale().fitContent();
    volChart.current?.timeScale().fitContent();
    renderedKey.current = key;
  }, [getCandles]);

  // ── Real-time update handler ────────────────────────────────────────────
  // Called by useChartWebSocket after throttle — receives updated last candle.
  // Uses series.update() — the performant path, NO setData, NO re-render.
  const handleRealtimeUpdate = useCallback((bar: CandleBar) => {
    if (!candleSeries.current || !volSeries.current) return;
    if (renderedKey.current !== activeKey) return; // guard stale timeframe

    candleSeries.current.update({
      time:  bar.time as UTCTimestamp,
      open:  bar.open,
      high:  bar.high,
      low:   bar.low,
      close: bar.close,
    });

    volSeries.current.update({
      time:  bar.time as UTCTimestamp,
      value: bar.volume,
      color: bar.close >= bar.open ? T.volUp : T.volDn,
    });
  }, [activeKey]);

  // ── Init charts ONCE on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!mainRef.current || !volRef.current) return;

    // Main candlestick chart
    mainChart.current = createChart(mainRef.current, {
      ...CHART_BASE,
      height,
      width:  mainRef.current.clientWidth,
      rightPriceScale: {
        ...CHART_BASE.rightPriceScale,
        scaleMargins: { top: 0.08, bottom: 0.04 },
      },
    });

    candleSeries.current = mainChart.current.addCandlestickSeries({
      upColor:        T.up,   downColor:        T.dn,
      borderUpColor:  T.up,   borderDownColor:  T.dn,
      wickUpColor:    T.up,   wickDownColor:    T.dn,
    });

    // Volume chart — separate pane for independent zoom
    volChart.current = createChart(volRef.current, {
      ...CHART_BASE,
      height: 72,
      width:  volRef.current.clientWidth,
    });

    volSeries.current = volChart.current.addHistogramSeries({
      priceFormat: { type: "volume" },
    });
    volChart.current.priceScale("right").applyOptions({
      scaleMargins: { top: 0.1, bottom: 0 },
    });

    // Sync scroll between main and volume
    const syncRange = (range: unknown) => {
      if (!range) return;
      volChart.current?.timeScale().setVisibleLogicalRange(range as any);
    };
    mainChart.current.timeScale().subscribeVisibleLogicalRangeChange(syncRange);

    // ResizeObserver — single observer, apply to both charts
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      mainChart.current?.applyOptions({ width: w });
      volChart.current?.applyOptions({ width: w });
    });
    ro.observe(mainRef.current);

    return () => {
      ro.disconnect();
      mainChart.current?.remove();
      volChart.current?.remove();
      mainChart.current = volChart.current = null;
      candleSeries.current = volSeries.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch when ticker or timeframe changes ───────────────────────────────
  useEffect(() => {
    loadData(ticker, activeTf);
  }, [ticker, activeTf, loadData]);

  // ── Apply data when store marks key as ready ─────────────────────────────
  useEffect(() => {
    if (status === "ready" && renderedKey.current !== activeKey) {
      applyCandles(activeKey);
    }
  }, [status, activeKey, applyCandles]);

  // ── WebSocket real-time updates ──────────────────────────────────────────
  useChartWebSocket({
    ticker,
    timeframe: activeTf,
    onUpdate:  handleRealtimeUpdate,
  });

  // ── Timeframe switcher ───────────────────────────────────────────────────
  const handleTfSwitch = useCallback((tf: Timeframe) => {
    if (tf === activeTf) return;
    setActiveTf(tf);
    // If data already cached, chart updates in the status useEffect above.
    // If not cached, loadData fetches → store marks ready → useEffect applies.
  }, [activeTf]);

  // ── Retry ────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    // Force re-fetch by clearing the key
    useChartStore.getState().setLoading(activeKey);
    loadData(ticker, activeTf);
  }, [activeKey, ticker, activeTf, loadData]);

  // ── Derived display state ─────────────────────────────────────────────────
  const isLoading = status === "loading" || (status === "idle" && !hasData);
  const isError   = status === "error";

  // OHLCV tooltip values — read from store only for display, not for chart
  const [tooltip, setTooltip] = useState<CandleBar | null>(null);
  useEffect(() => {
    if (!mainChart.current || !candleSeries.current) return;
    const handler = mainChart.current.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.size) {
        setTooltip(null);
        return;
      }
      const bar = param.seriesData.get(candleSeries.current!) as any;
      if (bar) setTooltip({ time: param.time as number, ...bar });
    });
    // lightweight-charts returns unsubscribe fn
    return () => { handler?.(); };  // eslint-disable-line react-hooks/exhaustive-deps
  }, []); 

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", background: T.bg }}>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "5px 10px",
        borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: "wrap",
      }}>

        {/* Timeframe selector */}
        <div style={{ display: "flex", gap: 3 }}>
          {TIMEFRAMES.map(tf => (
            <TfButton key={tf} tf={tf} active={activeTf === tf} onClick={() => handleTfSwitch(tf)} />
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: T.border, flexShrink: 0 }} />

        {/* OHLCV tooltip — only when crosshair active */}
        {tooltip ? (
          <div style={{ display: "flex", gap: 10, fontSize: 10, fontFamily: "'Space Mono', monospace", flexWrap: "wrap" }}>
            {(["open", "high", "low", "close"] as const).map(k => (
              <span key={k}>
                <span style={{ color: T.text, marginRight: 3 }}>{k[0].toUpperCase()}</span>
                <span style={{
                  color: k === "high" ? T.up : k === "low" ? T.dn :
                         k === "close" ? (tooltip.close >= tooltip.open ? T.up : T.dn) : T.textMid,
                }}>
                  {tooltip[k].toLocaleString("id")}
                </span>
              </span>
            ))}
            <span>
              <span style={{ color: T.text, marginRight: 3 }}>V</span>
              <span style={{ color: T.textMid }}>
                {tooltip.volume >= 1_000_000
                  ? `${(tooltip.volume / 1_000_000).toFixed(1)}Jt`
                  : tooltip.volume.toLocaleString("id")}
              </span>
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: T.textMid, fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>
              {ticker.replace(".JK", "")}
            </span>
            <span style={{ fontSize: 9, color: T.text, fontFamily: "'Space Mono', monospace" }}>
              {activeTf.toUpperCase()} · hover to inspect
            </span>
          </div>
        )}

        {/* Live indicator */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", background: T.up,
            animation: "livePulse 2s infinite",
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 8, color: T.text, fontFamily: "'Syne', sans-serif", letterSpacing: 1 }}>LIVE</span>
        </div>
      </div>

      {/* ── Chart area ────────────────────────────────────────────────── */}
      {isLoading ? (
        <Skeleton height={height} />
      ) : isError ? (
        <ErrorState ticker={ticker} onRetry={handleRetry} />
      ) : (
        <>
          <div ref={mainRef} style={{ flexShrink: 0 }} />
        </>
      )}

      {/* Volume — always in DOM so ref stays valid, hidden during loading */}
      <div style={{
        borderTop: `1px solid ${T.border}`, flexShrink: 0,
        visibility: (isLoading || isError) ? "hidden" : "visible",
        height:     (isLoading || isError) ? 0 : "auto",
      }}>
        <div style={{ padding: "1px 8px", fontSize: 8, color: T.text, fontFamily: "'Syne', sans-serif", letterSpacing: 1 }}>
          VOL
        </div>
        <div ref={volRef} />
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0,214,143,0.5); }
          50%       { opacity: 0.7; box-shadow: 0 0 0 4px transparent; }
        }
      `}</style>
    </div>
  );
}