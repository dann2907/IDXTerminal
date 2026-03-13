// src/components/LWChart.tsx
//
// React wrapper untuk lightweight-charts (TradingView).
// Menampilkan candlestick + volume histogram dalam satu container.
//
// Props:
//   candles  — array CandleData dari useMarketStore
//   height   — tinggi chart area (default 280)
//   loading  — tampilkan skeleton saat data belum datang
//
// Cleanup dihandle lewat useEffect return — tidak ada memory leak
// meski komponen di-unmount dan di-remount saat ganti ticker.

import { useEffect, useRef } from "react";
import type { CandleData } from "../stores/useMarketStore";

interface LWChartProps {
  candles: CandleData[];
  height?: number;
  loading?: boolean;
}

// Warna tema — sama dengan CSS di IDXTerminal
const THEME = {
  bg:          "#070d1c",
  bgGrid:      "#0a1628",
  text:        "#4a6080",
  border:      "#0f2040",
  up:          "#00d68f",
  down:        "#ff4560",
  upFill:      "rgba(0,214,143,0.15)",
  downFill:    "rgba(255,69,96,0.15)",
  volUp:       "rgba(0,214,143,0.5)",
  volDown:     "rgba(255,69,96,0.5)",
  crosshair:   "#2e4a70",
};

export default function LWChart({ candles, height = 280, loading = false }: LWChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<ReturnType<typeof import("lightweight-charts")["createChart"]> | null>(null);
  const candleRef    = useRef<ReturnType<ReturnType<typeof import("lightweight-charts")["createChart"]>["addCandlestickSeries"]> | null>(null);
  const volumeRef    = useRef<ReturnType<ReturnType<typeof import("lightweight-charts")["createChart"]>["addHistogramSeries"]> | null>(null);

  // Init chart sekali saat mount
  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamic import agar bundler tidak error jika package belum install
    let cleanup = () => {};
    import("lightweight-charts").then(({ createChart, CrosshairMode }) => {
      if (!containerRef.current) return;

      const chart = createChart(containerRef.current, {
        width:  containerRef.current.clientWidth,
        height: height,
        layout: {
          background:  { color: THEME.bg },
          textColor:   THEME.text,
        },
        grid: {
          vertLines:   { color: THEME.border },
          horzLines:   { color: THEME.border },
        },
        crosshair: {
          mode:        CrosshairMode.Normal,
          vertLine:    { color: THEME.crosshair, labelBackgroundColor: THEME.bgGrid },
          horzLine:    { color: THEME.crosshair, labelBackgroundColor: THEME.bgGrid },
        },
        rightPriceScale: {
          borderColor: THEME.border,
          scaleMargins: { top: 0.1, bottom: 0.28 },   // space untuk volume di bawah
        },
        timeScale: {
          borderColor:          THEME.border,
          timeVisible:          true,
          secondsVisible:       false,
          rightOffset:          5,
          fixLeftEdge:          false,
          lockVisibleTimeRangeOnResize: true,
        },
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor:          THEME.up,
        downColor:        THEME.down,
        borderUpColor:    THEME.up,
        borderDownColor:  THEME.down,
        wickUpColor:      THEME.up,
        wickDownColor:    THEME.down,
      });

      const volumeSeries = chart.addHistogramSeries({
        priceFormat:   { type: "volume" },
        priceScaleId:  "volume",
      });

      // Volume punya skala sendiri di bawah
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0.0 },
      });

      chartRef.current  = chart;
      candleRef.current = candleSeries;
      volumeRef.current = volumeSeries;

      // Responsive resize
      const ro = new ResizeObserver(entries => {
        const w = entries[0]?.contentRect.width;
        if (w) chart.applyOptions({ width: w });
      });
      ro.observe(containerRef.current);

      cleanup = () => {
        ro.disconnect();
        chart.remove();
        chartRef.current  = null;
        candleRef.current = null;
        volumeRef.current = null;
      };
    }).catch(err => {
      console.error("[LWChart] Failed to load lightweight-charts:", err);
    });

    return () => cleanup();
  }, [height]); // reinit hanya jika height berubah

  // Update data setiap kali candles berubah (ganti ticker / period)
  useEffect(() => {
    if (!candleRef.current || !volumeRef.current || !candles.length) return;

    const sorted = [...candles].sort((a, b) => a.time - b.time);

    candleRef.current.setData(
      sorted.map(c => ({
        time:  c.time as unknown as import("lightweight-charts").Time,
        open:  c.open,
        high:  c.high,
        low:   c.low,
        close: c.close,
      }))
    );

    volumeRef.current.setData(
      sorted.map(c => ({
        time:  c.time as unknown as import("lightweight-charts").Time,
        value: c.volume,
        color: c.close >= c.open ? THEME.volUp : THEME.volDown,
      }))
    );

    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  if (loading) {
    return (
      <div style={{
        height,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        color:          "#2a4060",
        fontSize:       "12px",
        fontFamily:     "'JetBrains Mono', monospace",
        letterSpacing:  "0.05em",
        background:     THEME.bg,
      }}>
        Loading chart data...
      </div>
    );
  }

  if (!candles.length) {
    return (
      <div style={{
        height,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        color:          "#2a4060",
        fontSize:       "11px",
        fontFamily:     "'JetBrains Mono', monospace",
        background:     THEME.bg,
      }}>
        No data
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height, background: THEME.bg }}
    />
  );
}