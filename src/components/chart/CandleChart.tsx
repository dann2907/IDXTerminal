// src/components/chart/CandleChart.tsx
//
// Candlestick chart dengan overlay indicator (SMA, EMA, BB)
// dan panel bawah untuk RSI atau MACD.
//
// Library: lightweight-charts (TradingView)
// Data:    candle dari useMarketStore + indicator dari useIndicators
//
// Props:
//   ticker  — saham yang ditampilkan (misal "BBCA.JK")
//   period  — period candle: "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y"
//   interval— interval candle: "1d" | "1wk" | dll
//   height  — tinggi chart area utama (default 340)

import { useEffect, useRef, useMemo, useState } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
} from "lightweight-charts";
import { useMarketStore } from "../../stores/useMarketStore";
import { useIndicators } from "../../hooks/useIndicators";

// ── Types ──────────────────────────────────────────────────────────────────

type OverlayIndicator = "none" | "sma" | "ema" | "bb";
type PanelIndicator   = "none" | "rsi" | "macd";

interface Props {
  ticker:   string;
  period?:  string;
  interval?: string;
  height?:  number;
}

// ── Theme constants (Bloomberg dark) ──────────────────────────────────────

const C = {
  bg:         "#070d1c",
  grid:       "#0a1628",
  text:       "#4a6080",
  border:     "#0f2040",
  candle_up:  "#00d68f",
  candle_dn:  "#ff4560",
  volume_up:  "rgba(0,214,143,0.25)",
  volume_dn:  "rgba(255,69,96,0.25)",
  sma20:      "#f59e0b",
  sma50:      "#8b5cf6",
  ema9:       "#38bdf8",
  bb_upper:   "rgba(99,102,241,0.7)",
  bb_mid:     "rgba(99,102,241,0.4)",
  bb_lower:   "rgba(99,102,241,0.7)",
  bb_fill:    "rgba(99,102,241,0.05)",
  rsi_line:   "#f59e0b",
  rsi_ob:     "rgba(255,69,96,0.35)",
  rsi_os:     "rgba(0,214,143,0.35)",
  macd_line:  "#38bdf8",
  macd_sig:   "#f59e0b",
  macd_bull:  "rgba(0,214,143,0.6)",
  macd_bear:  "rgba(255,69,96,0.6)",
};

// ── Component ──────────────────────────────────────────────────────────────

export default function CandleChart({
  ticker,
  period   = "3mo",
  interval = "1d",
  height   = 340,
}: Props) {
  const fetchCandles = useMarketStore(s => s.fetchCandles);
  const candles      = useMarketStore(s => s.candles[ticker] ?? []);
  const ind          = useIndicators(ticker);

  const [overlay, setOverlay] = useState<OverlayIndicator>("sma");
  const [panel,   setPanel]   = useState<PanelIndicator>("rsi");

  // ── Refs ────────────────────────────────────────────────────────────────
  const mainRef  = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const mainChart  = useRef<IChartApi | null>(null);
  const panelChart = useRef<IChartApi | null>(null);

  const candleSeries  = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeries  = useRef<ISeriesApi<"Histogram"> | null>(null);
  const overlaySeries = useRef<ISeriesApi<any>[]>([]);
  const panelSeries   = useRef<ISeriesApi<any>[]>([]);

  // ── Fetch on mount / param change ────────────────────────────────────────
  useEffect(() => {
    fetchCandles(ticker, period, interval);
  }, [ticker, period, interval, fetchCandles]);

  // ── Create charts on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!mainRef.current) return;

    const chartOpts = {
      layout:     { background: { type: ColorType.Solid, color: C.bg }, textColor: C.text },
      grid:       { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      crosshair:  { mode: 1 },
      rightPriceScale: { borderColor: C.border },
      timeScale:  { borderColor: C.border, timeVisible: true },
    };

    // Main chart
    mainChart.current = createChart(mainRef.current, {
      ...chartOpts,
      height,
      width: mainRef.current.clientWidth,
    });

    candleSeries.current = mainChart.current.addCandlestickSeries({
      upColor:   C.candle_up, downColor:   C.candle_dn,
      borderUpColor: C.candle_up, borderDownColor: C.candle_dn,
      wickUpColor:   C.candle_up, wickDownColor:   C.candle_dn,
    });

    volumeSeries.current = mainChart.current.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    mainChart.current.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    // Panel chart (RSI / MACD)
    if (panelRef.current) {
      panelChart.current = createChart(panelRef.current, {
        ...chartOpts,
        height: 120,
        width:  panelRef.current.clientWidth,
      });
      // Sync crosshair time dengan main chart
      mainChart.current.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range && panelChart.current) {
          panelChart.current.timeScale().setVisibleLogicalRange(range);
        }
      });
    }

    // ResizeObserver
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      mainChart.current?.applyOptions({ width: w });
      panelChart.current?.applyOptions({ width: w });
    });
    if (mainRef.current) ro.observe(mainRef.current);

    return () => {
      ro.disconnect();
      mainChart.current?.remove();
      panelChart.current?.remove();
      mainChart.current = panelChart.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update candle & volume data ─────────────────────────────────────────
  useEffect(() => {
    if (!candles.length || !candleSeries.current || !volumeSeries.current) return;

    candleSeries.current.setData(candles.map(c => ({
      time:  c.time as any,
      open:  c.open,
      high:  c.high,
      low:   c.low,
      close: c.close,
    })));

    volumeSeries.current.setData(candles.map(c => ({
      time:  c.time as any,
      value: c.volume,
      color: c.close >= c.open ? C.volume_up : C.volume_dn,
    })));

    mainChart.current?.timeScale().fitContent();
  }, [candles]);

  // ── Update overlay indicators ────────────────────────────────────────────
  useEffect(() => {
    if (!mainChart.current) return;

    // Hapus series lama
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
      const mid   = mainChart.current.addLineSeries({ color: C.bb_mid,   lineWidth: 1, lineStyle: 2, priceLineVisible: false });
      const lower = mainChart.current.addLineSeries({ color: C.bb_lower, lineWidth: 1, priceLineVisible: false });
      upper.setData(ind.bb.map(p => ({ time: p.time as any, value: p.upper })));
      mid.setData(  ind.bb.map(p => ({ time: p.time as any, value: p.mid   })));
      lower.setData(ind.bb.map(p => ({ time: p.time as any, value: p.lower })));
      overlaySeries.current = [upper, mid, lower];
    }
  }, [overlay, ind]);

  // ── Update panel indicators ──────────────────────────────────────────────
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
      const sig  = panelChart.current.addLineSeries({ color: C.macd_sig,  lineWidth: 1, priceLineVisible: false });
      hist.setData(ind.macd.map(p => ({
        time: p.time as any, value: p.histogram,
        color: p.histogram >= 0 ? C.macd_bull : C.macd_bear,
      })));
      ml.setData( ind.macd.map(p => ({ time: p.time as any, value: p.macd   })));
      sig.setData(ind.macd.map(p => ({ time: p.time as any, value: p.signal })));
      panelSeries.current = [hist, ml, sig];
    }
    panelChart.current.timeScale().fitContent();
  }, [panel, ind]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, background: C.bg }}>

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, padding: "6px 8px", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>

        {/* Overlay selector */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: C.text, fontFamily: "'Syne',sans-serif", letterSpacing: 1 }}>OVERLAY</span>
          {(["none", "sma", "ema", "bb"] as const).map(o => (
            <Btn key={o} active={overlay === o} onClick={() => setOverlay(o)}
              color={o === "sma" ? C.sma20 : o === "ema" ? C.ema9 : o === "bb" ? C.bb_mid : C.text}>
              {o === "none" ? "—" : o.toUpperCase()}
            </Btn>
          ))}
        </div>

        <div style={{ width: 1, background: C.border, alignSelf: "stretch" }} />

        {/* Panel selector */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: C.text, fontFamily: "'Syne',sans-serif", letterSpacing: 1 }}>PANEL</span>
          {(["none", "rsi", "macd"] as const).map(p => (
            <Btn key={p} active={panel === p} onClick={() => setPanel(p)}
              color={p === "rsi" ? C.rsi_line : p === "macd" ? C.macd_line : C.text}>
              {p === "none" ? "—" : p.toUpperCase()}
            </Btn>
          ))}
        </div>

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

      {/* ── Main chart ───────────────────────────────────────────────── */}
      <div ref={mainRef} />

      {/* ── Panel chart ──────────────────────────────────────────────── */}
      {panel !== "none" && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {/* Panel label */}
          <div style={{ padding: "2px 8px", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 9, color: C.text, fontFamily: "'Syne',sans-serif", letterSpacing: 1 }}>
              {panel === "rsi" ? "RSI (14)" : "MACD (12, 26, 9)"}
            </span>
            {panel === "rsi" && (
              <>
                <span style={{ fontSize: 9, color: C.candle_dn }}>OB 70</span>
                <span style={{ fontSize: 9, color: C.candle_up }}>OS 30</span>
              </>
            )}
            {panel === "macd" && (
              <>
                <Legend color={C.macd_line} label="MACD" />
                <Legend color={C.macd_sig}  label="Signal" />
              </>
            )}
          </div>
          <div ref={panelRef} />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Btn({ children, active, onClick, color }: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button onClick={onClick} style={{
      padding:      "2px 7px",
      fontSize:     9,
      fontFamily:   "'Syne',sans-serif",
      fontWeight:   700,
      border:       `1px solid ${active ? color : "transparent"}`,
      borderRadius: 3,
      background:   active ? `${color}22` : "transparent",
      color:        active ? color : "#4a6080",
      cursor:       "pointer",
    }}>
      {children}
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ width: 16, height: 2, background: color, borderRadius: 1 }} />
      <span style={{ fontSize: 9, color: "#4a6080", fontFamily: "'Space Mono',monospace" }}>{label}</span>
    </div>
  );
}