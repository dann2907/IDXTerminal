// src/components/chart/CandleChart.tsx
//
// FIX BUG-1: Chart divs selalu ada di DOM (display:none saat loading/error).
//   Root cause sebelumnya: conditional rendering {isLoading ? <Skeleton> : <div ref>}
//   menyebabkan mainRef.current=null saat chart init useEffect berjalan,
//   sehingga chart tidak pernah terbuat. Solusi: render semua div selalu,
//   overlay skeleton/error di atasnya dengan position:absolute.
//
// FIX 2: Error state saat fetch gagal (dengan tombol retry)
// FIX 3: ResizeObserver cover volRef dan panelRef juga
// FIX 4: panel div selalu di-render (display:none) — bukan conditional render
// FIX 5: volume sebagai chart terpisah (bisa di-zoom sendiri)
// FEAT:  prop inWatchlist + onWatchlistToggle untuk tombol ★

import { useEffect, useRef, useState } from "react";
import {
  createChart, CrosshairMode,
  type IChartApi, type ISeriesApi, ColorType,
} from "lightweight-charts";
import { useMarketStore } from "../../stores/useMarketStore";
import { useIndicators } from "../../hooks/useIndicators";

// ── Types ──────────────────────────────────────────────────────────────────

type OverlayIndicator = "none" | "sma" | "ema" | "bb";
type PanelIndicator   = "none" | "rsi" | "macd";

interface Props {
  ticker:             string;
  period?:            string;
  interval?:          string;
  height?:            number;
  inWatchlist?:       boolean;
  onWatchlistToggle?: () => void;
}

// ── Theme ──────────────────────────────────────────────────────────────────

const C = {
  bg:        "#070d1c",
  grid:      "#0a1628",
  text:      "#4a6080",
  border:    "#0f2040",
  up:        "#00d68f",
  dn:        "#ff4560",
  vol_up:    "rgba(0,214,143,0.3)",
  vol_dn:    "rgba(255,69,96,0.3)",
  sma20:     "#f59e0b",
  sma50:     "#8b5cf6",
  ema9:      "#38bdf8",
  bb_upper:  "rgba(99,102,241,0.7)",
  bb_mid:    "rgba(99,102,241,0.4)",
  bb_lower:  "rgba(99,102,241,0.7)",
  rsi_line:  "#f59e0b",
  macd_line: "#38bdf8",
  macd_sig:  "#f59e0b",
  macd_bull: "rgba(0,214,143,0.6)",
  macd_bear: "rgba(255,69,96,0.6)",
  skeleton:  "#0d1e35",
};

const CHART_OPTS = () => ({
  layout:    { background: { type: ColorType.Solid, color: C.bg }, textColor: C.text },
  grid:      { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: C.border },
  timeScale:       { borderColor: C.border, timeVisible: true },
});

// ── Skeleton overlay ───────────────────────────────────────────────────────
// Dirender sebagai overlay position:absolute di atas chart, bukan
// menggantikan DOM node chart — sehingga chart divs tetap terpasang.

function SkeletonOverlay({ height, label = "Memuat data chart..." }: { height: number; label?: string }) {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      zIndex: 10,
      height,
      background: C.bg,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      pointerEvents: "none",
    }}>
      {/* Shimmer bars — simulasi candlestick */}
      <div style={{ flex: 1, padding: "12px 8px", display: "flex", alignItems: "flex-end", gap: 3 }}>
        {Array.from({ length: 40 }, (_, i) => {
          const h = 20 + Math.sin(i * 0.7) * 15 + Math.cos(i * 0.3) * 10 + (i % 5) * 3;
          return (
            <div key={i} style={{
              flex: 1,
              height: `${Math.max(8, h)}%`,
              background: C.skeleton,
              borderRadius: 1,
              animation: `skeletonPulse 1.5s ease-in-out ${(i * 0.03).toFixed(2)}s infinite`,
            }} />
          );
        })}
      </div>
      {/* Label */}
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 8,
      }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#2e8fdf",
              animation: `dotBounce 1.2s ease-in-out ${(i * 0.2).toFixed(1)}s infinite`,
            }} />
          ))}
        </div>
        <div style={{
          fontSize: 11, color: "#2a4060",
          fontFamily: "'Space Mono', monospace",
          letterSpacing: "0.05em",
        }}>
          {label}
        </div>
      </div>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.8; }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
          40%           { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Error overlay ──────────────────────────────────────────────────────────

function ChartErrorOverlay({ ticker, onRetry, height }: { ticker: string; onRetry: () => void; height: number }) {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      zIndex: 10,
      height,
      background: C.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 10,
    }}>
      <div style={{ fontSize: 20 }}>⚠</div>
      <div style={{ fontSize: 11, color: "#4a6080", fontFamily: "'Space Mono', monospace" }}>
        Gagal memuat data {ticker.replace(".JK", "")}
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: "5px 14px", fontSize: 10,
          fontFamily: "'Syne', sans-serif", fontWeight: 700,
          background: "rgba(46,143,223,0.15)",
          border: "1px solid rgba(46,143,223,0.4)",
          borderRadius: 3, color: "#2e8fdf", cursor: "pointer",
        }}
      >
        Coba Lagi
      </button>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function CandleChart({
  ticker, period = "3mo", interval = "1d",
  height = 300, inWatchlist = false, onWatchlistToggle,
}: Props) {
  const fetchCandles    = useMarketStore(s => s.fetchCandles);
  const candles         = useMarketStore(s => s.candles[ticker] ?? []);
  const candleLoading   = useMarketStore(s => s.candleLoading[ticker] ?? false);
  const candleError     = useMarketStore(s => s.candleError[ticker] ?? null);
  const ind             = useIndicators(ticker);

  const [overlay, setOverlay] = useState<OverlayIndicator>("sma");
  const [panel,   setPanel]   = useState<PanelIndicator>("none");

  // DOM refs — SEMUA div SELALU di-render di DOM (fix utama Bug-1)
  const mainRef  = useRef<HTMLDivElement>(null);
  const volRef   = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Chart instance refs
  const mainChart  = useRef<IChartApi | null>(null);
  const volChart   = useRef<IChartApi | null>(null);
  const panelChart = useRef<IChartApi | null>(null);

  // Series refs
  const candleSeries  = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volSeries     = useRef<ISeriesApi<"Histogram"> | null>(null);
  const overlaySeries = useRef<ISeriesApi<any>[]>([]);
  const panelSeries   = useRef<ISeriesApi<any>[]>([]);

  // Tracks whether chart instances have been created
  const chartInitialized = useRef(false);

  // ── Fetch on param change ────────────────────────────────────────────────
  useEffect(() => {
    fetchCandles(ticker, period, interval);
  }, [ticker, period, interval, fetchCandles]);

  // ── Init charts ONCE on mount ────────────────────────────────────────────
  // BUG-1 FIX: Chart divs are always in DOM now (rendered inside a wrapper
  // that is always mounted). This useEffect will always find valid refs.
  useEffect(() => {
    if (!mainRef.current || !volRef.current || !panelRef.current) return;
    if (chartInitialized.current) return;
    chartInitialized.current = true;

    // Main chart
    mainChart.current = createChart(mainRef.current, {
      ...CHART_OPTS(), height, width: mainRef.current.clientWidth,
    });
    candleSeries.current = mainChart.current.addCandlestickSeries({
      upColor: C.up, downColor: C.dn,
      borderUpColor: C.up, borderDownColor: C.dn,
      wickUpColor: C.up, wickDownColor: C.dn,
    });

    // Volume chart — pane terpisah (FIX 5)
    volChart.current = createChart(volRef.current, {
      ...CHART_OPTS(), height: 72, width: volRef.current.clientWidth,
    });
    volSeries.current = volChart.current.addHistogramSeries({
      priceFormat: { type: "volume" },
    });
    volChart.current.priceScale("right").applyOptions({
      scaleMargins: { top: 0.1, bottom: 0 },
    });

    // Panel chart (RSI/MACD) — selalu dibuat (FIX 4)
    panelChart.current = createChart(panelRef.current, {
      ...CHART_OPTS(), height: 100, width: panelRef.current.clientWidth,
    });

    // Sync time scale
    const syncRange = (range: any) => {
      if (!range) return;
      volChart.current?.timeScale().setVisibleLogicalRange(range);
      panelChart.current?.timeScale().setVisibleLogicalRange(range);
    };
    mainChart.current.timeScale().subscribeVisibleLogicalRangeChange(syncRange);

    // FIX 3: ResizeObserver cover semua tiga chart
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      mainChart.current?.applyOptions({ width: w });
      volChart.current?.applyOptions({ width: w });
      panelChart.current?.applyOptions({ width: w });
    });
    ro.observe(mainRef.current);

    return () => {
      ro.disconnect();
      mainChart.current?.remove();
      volChart.current?.remove();
      panelChart.current?.remove();
      mainChart.current = volChart.current = panelChart.current = null;
      chartInitialized.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update candle + volume ───────────────────────────────────────────────
  useEffect(() => {
    if (!candles.length || !candleSeries.current || !volSeries.current) return;
    candleSeries.current.setData(candles.map(c => ({
      time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close,
    })));
    volSeries.current.setData(candles.map(c => ({
      time: c.time as any, value: c.volume,
      color: c.close >= c.open ? C.vol_up : C.vol_dn,
    })));
    mainChart.current?.timeScale().fitContent();
    volChart.current?.timeScale().fitContent();
  }, [candles]);

  // ── Overlay indicators ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mainChart.current) return;
    overlaySeries.current.forEach(s => { try { mainChart.current!.removeSeries(s); } catch {} });
    overlaySeries.current = [];

    if (overlay === "sma" && ind.sma20.length) {
      const s20 = mainChart.current.addLineSeries({ color: C.sma20, lineWidth: 1, priceLineVisible: false });
      const s50 = mainChart.current.addLineSeries({ color: C.sma50, lineWidth: 1, priceLineVisible: false });
      s20.setData(ind.sma20.map(p => ({ time: p.time as any, value: p.value })));
      s50.setData(ind.sma50.map(p => ({ time: p.time as any, value: p.value })));
      overlaySeries.current = [s20, s50];
    } else if (overlay === "ema" && ind.ema9.length) {
      const e9 = mainChart.current.addLineSeries({ color: C.ema9, lineWidth: 1, priceLineVisible: false });
      e9.setData(ind.ema9.map(p => ({ time: p.time as any, value: p.value })));
      overlaySeries.current = [e9];
    } else if (overlay === "bb" && ind.bb.length) {
      const upper = mainChart.current.addLineSeries({ color: C.bb_upper, lineWidth: 1, priceLineVisible: false });
      const mid   = mainChart.current.addLineSeries({ color: C.bb_mid, lineWidth: 1, lineStyle: 2, priceLineVisible: false });
      const lower = mainChart.current.addLineSeries({ color: C.bb_lower, lineWidth: 1, priceLineVisible: false });
      upper.setData(ind.bb.map(p => ({ time: p.time as any, value: p.upper })));
      mid.setData(  ind.bb.map(p => ({ time: p.time as any, value: p.mid })));
      lower.setData(ind.bb.map(p => ({ time: p.time as any, value: p.lower })));
      overlaySeries.current = [upper, mid, lower];
    }
  }, [overlay, ind]);

  // ── Panel indicators (RSI/MACD) ───────────────────────────────────────────
  useEffect(() => {
    if (!panelChart.current) return;
    panelSeries.current.forEach(s => { try { panelChart.current!.removeSeries(s); } catch {} });
    panelSeries.current = [];

    if (panel === "rsi" && ind.rsi14.length) {
      const line = panelChart.current.addLineSeries({
        color: C.rsi_line, lineWidth: 1, priceLineVisible: false,
        autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
      });
      line.setData(ind.rsi14.map(p => ({ time: p.time as any, value: p.value })));
      panelSeries.current = [line];
    } else if (panel === "macd" && ind.macd.length) {
      const hist = panelChart.current.addHistogramSeries({ priceLineVisible: false });
      const ml   = panelChart.current.addLineSeries({ color: C.macd_line, lineWidth: 1, priceLineVisible: false });
      const sig  = panelChart.current.addLineSeries({ color: C.macd_sig, lineWidth: 1, priceLineVisible: false });
      hist.setData(ind.macd.map(p => ({
        time: p.time as any, value: p.histogram,
        color: p.histogram >= 0 ? C.macd_bull : C.macd_bear,
      })));
      ml.setData( ind.macd.map(p => ({ time: p.time as any, value: p.macd })));
      sig.setData(ind.macd.map(p => ({ time: p.time as any, value: p.signal })));
      panelSeries.current = [hist, ml, sig];
    }
    if (panelSeries.current.length) panelChart.current.timeScale().fitContent();
  }, [panel, ind]);

  // ── Retry handler ─────────────────────────────────────────────────────────
  const handleRetry = () => fetchCandles(ticker, period, interval);

  // ── Derived flags ─────────────────────────────────────────────────────────
  const isLoading  = candleLoading && candles.length === 0;
  const isError    = !!candleError && !isLoading;
  const panelLabel = panel === "rsi" ? "RSI (14)" : panel === "macd" ? "MACD (12,26,9)" : "";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", background: C.bg, height: "100%" }}>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 6, padding: "5px 8px",
        borderBottom: `1px solid ${C.border}`,
        flexWrap: "wrap", alignItems: "center", flexShrink: 0,
      }}>
        <ToolGroup label="OVERLAY">
          {(["none", "sma", "ema", "bb"] as OverlayIndicator[]).map(o => (
            <Btn key={o} active={overlay === o} onClick={() => setOverlay(o)}
              color={o === "sma" ? C.sma20 : o === "ema" ? C.ema9 : o === "bb" ? C.bb_mid : C.text}>
              {o === "none" ? "—" : o.toUpperCase()}
            </Btn>
          ))}
        </ToolGroup>

        <Sep />

        <ToolGroup label="PANEL">
          {(["none", "rsi", "macd"] as PanelIndicator[]).map(p => (
            <Btn key={p} active={panel === p} onClick={() => setPanel(p)}
              color={p === "rsi" ? C.rsi_line : p === "macd" ? C.macd_line : C.text}>
              {p === "none" ? "—" : p.toUpperCase()}
            </Btn>
          ))}
        </ToolGroup>

        {/* Watchlist toggle */}
        {onWatchlistToggle && (
          <>
            <Sep />
            <button onClick={onWatchlistToggle}
              title={inWatchlist ? "Hapus dari watchlist" : "Tambah ke watchlist"}
              style={{
                padding: "2px 8px", fontSize: 13, lineHeight: 1,
                border: `1px solid ${inWatchlist ? C.sma20 : C.border}`,
                borderRadius: 3,
                background: inWatchlist ? `${C.sma20}22` : "transparent",
                color: inWatchlist ? C.sma20 : C.text,
                cursor: "pointer",
              }}>
              {inWatchlist ? "★" : "☆"}
            </button>
          </>
        )}

        {/* Legend */}
        {overlay === "sma" && (
          <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
            <Legend color={C.sma20} label="SMA 20" />
            <Legend color={C.sma50} label="SMA 50" />
          </div>
        )}
        {overlay === "ema" && <div style={{ marginLeft: "auto" }}><Legend color={C.ema9} label="EMA 9" /></div>}
        {overlay === "bb"  && <div style={{ marginLeft: "auto" }}><Legend color={C.bb_mid} label="BB (20,2)" /></div>}
      </div>

      {/* ── BUG-1 FIX: Chart area — divs SELALU ada di DOM ───────────────
          Skeleton & Error dirender sebagai overlay position:absolute,
          bukan menggantikan div chart. Ini memastikan chart init useEffect
          selalu menemukan mainRef.current !== null saat mount.           ── */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {/* Loading overlay */}
        {isLoading && <SkeletonOverlay height={height} />}
        {/* Error overlay */}
        {isError && <ChartErrorOverlay ticker={ticker} onRetry={handleRetry} height={height} />}

        {/* Main chart — ALWAYS in DOM */}
        <div ref={mainRef} style={{ visibility: (isLoading || isError) ? "hidden" : "visible" }} />
      </div>

      {/* Volume pane — ALWAYS in DOM, hidden during loading/error */}
      <div style={{
        borderTop: `1px solid ${C.border}`,
        flexShrink: 0,
        visibility: (isLoading || isError) ? "hidden" : "visible",
      }}>
        <PaneLabel>VOL</PaneLabel>
        <div ref={volRef} />
      </div>

      {/* RSI / MACD pane — ALWAYS in DOM (FIX 4) */}
      <div style={{
        borderTop: `1px solid ${C.border}`,
        flexShrink: 0,
        display: panel !== "none" ? "block" : "none",
        visibility: (isLoading || isError) ? "hidden" : "visible",
      }}>
        {panelLabel && <PaneLabel>{panelLabel}</PaneLabel>}
        <div ref={panelRef} />
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <span style={{ fontSize: 9, color: C.text, fontFamily: "'Syne',sans-serif", letterSpacing: 1 }}>{label}</span>
      {children}
    </div>
  );
}

function Btn({ children, active, onClick, color }: {
  children: React.ReactNode; active: boolean; onClick: () => void; color: string;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "2px 7px", fontSize: 9, fontFamily: "'Syne',sans-serif", fontWeight: 700,
      border: `1px solid ${active ? color : "transparent"}`,
      borderRadius: 3, background: active ? `${color}22` : "transparent",
      color: active ? color : "#4a6080", cursor: "pointer",
    }}>
      {children}
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />;
}

function PaneLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "1px 8px", fontSize: 8, color: C.text, fontFamily: "'Syne',sans-serif", letterSpacing: 1 }}>
      {children}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ width: 14, height: 2, background: color, borderRadius: 1 }} />
      <span style={{ fontSize: 9, color: "#4a6080", fontFamily: "'Space Mono',monospace" }}>{label}</span>
    </div>
  );
}