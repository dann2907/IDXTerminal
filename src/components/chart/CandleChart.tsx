// src/components/chart/CandleChart.tsx
//
// FIX 1 (bug panel toggle): panel div selalu di-render, display:none saat
//   tidak aktif. Chart instance tidak pernah di-destroy saat panel toggle,
//   sehingga seri bisa ditambah/dihapus tanpa re-init.
//
// FIX 2 (volume terpisah): volume dikeluarkan dari main chart ke pane
//   sendiri (volumeChart). User bisa scroll/zoom volume independen.
//
// FITUR BARU: prop `onWatchlistToggle` + `inWatchlist` untuk tombol ★
//   di chart header (dipanggil dari IDXTerminal).

import { useEffect, useRef, useState } from "react";
import {
  createChart, CrosshairMode,
  type IChartApi, type ISeriesApi, ColorType,
} from "lightweight-charts";
import { useMarketStore } from "../../stores/useMarketStore";
import { useIndicators } from "../../hooks/useIndicators";

// ── Types ──────────────────────────────────────────────────────────────────

type OverlayIndicator = "none" | "sma" | "ema" | "bb";
type PanelIndicator   = "none" | "rsi" | "macd" | "volume";

interface Props {
  ticker:              string;
  period?:             string;
  interval?:           string;
  height?:             number;
  inWatchlist?:        boolean;
  onWatchlistToggle?:  () => void;
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
};

const CHART_OPTS = (bg = C.bg) => ({
  layout:    { background: { type: ColorType.Solid, color: bg }, textColor: C.text },
  grid:      { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: C.border },
  timeScale:       { borderColor: C.border, timeVisible: true },
});

// ── Component ──────────────────────────────────────────────────────────────

export default function CandleChart({
  ticker, period = "3mo", interval = "1d",
  height = 340, inWatchlist = false, onWatchlistToggle,
}: Props) {
  const fetchCandles = useMarketStore(s => s.fetchCandles);
  const candles      = useMarketStore(s => s.candles[ticker] ?? []);
  const ind          = useIndicators(ticker);

  const [overlay, setOverlay] = useState<OverlayIndicator>("sma");
  const [panel,   setPanel]   = useState<PanelIndicator>("volume");

  // DOM refs — semua div SELALU di-render, kontrol via CSS display
  const mainRef   = useRef<HTMLDivElement>(null);
  const volRef    = useRef<HTMLDivElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);

  // Chart instance refs
  const mainChart  = useRef<IChartApi | null>(null);
  const volChart   = useRef<IChartApi | null>(null);
  const panelChart = useRef<IChartApi | null>(null);

  // Series refs
  const candleSeries  = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volSeries     = useRef<ISeriesApi<"Histogram"> | null>(null);
  const overlaySeries = useRef<ISeriesApi<any>[]>([]);
  const panelSeries   = useRef<ISeriesApi<any>[]>([]);

  // ── Fetch on param change ────────────────────────────────────────────────
  useEffect(() => {
    fetchCandles(ticker, period, interval);
  }, [ticker, period, interval, fetchCandles]);

  // ── Init charts ONCE on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!mainRef.current || !volRef.current || !panelRef.current) return;

    // ── Main (candlestick) chart ──────────────────────────────────────────
    mainChart.current = createChart(mainRef.current, {
      ...CHART_OPTS(),
      height,
      width: mainRef.current.clientWidth,
    });
    candleSeries.current = mainChart.current.addCandlestickSeries({
      upColor:        C.up,  downColor:        C.dn,
      borderUpColor:  C.up,  borderDownColor:  C.dn,
      wickUpColor:    C.up,  wickDownColor:    C.dn,
    });

    // ── Volume chart (FIX 2: pane terpisah) ──────────────────────────────
    volChart.current = createChart(volRef.current, {
      ...CHART_OPTS(),
      height: 80,
      width:  volRef.current.clientWidth,
    });
    volSeries.current = volChart.current.addHistogramSeries({
      priceFormat: { type: "volume" },
    });
    volChart.current.priceScale("right").applyOptions({
      scaleMargins: { top: 0.1, bottom: 0 },
    });

    // ── Panel chart (RSI / MACD) — FIX 1: selalu dibuat ─────────────────
    panelChart.current = createChart(panelRef.current, {
      ...CHART_OPTS(),
      height: 120,
      width:  panelRef.current.clientWidth,
    });

    // Sync time scale: scroll main → scroll semua panel
    const syncRange = (range: any) => {
      if (!range) return;
      volChart.current?.timeScale().setVisibleLogicalRange(range);
      panelChart.current?.timeScale().setVisibleLogicalRange(range);
    };
    mainChart.current.timeScale().subscribeVisibleLogicalRangeChange(syncRange);

    // ResizeObserver
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
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update candle + volume data ──────────────────────────────────────────
  useEffect(() => {
    if (!candles.length || !candleSeries.current || !volSeries.current) return;

    candleSeries.current.setData(candles.map(c => ({
      time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close,
    })));
    volSeries.current.setData(candles.map(c => ({
      time:  c.time as any,
      value: c.volume,
      color: c.close >= c.open ? C.vol_up : C.vol_dn,
    })));
    mainChart.current?.timeScale().fitContent();
    volChart.current?.timeScale().fitContent();
  }, [candles]);

  // ── Update overlay indicators ────────────────────────────────────────────
  useEffect(() => {
    if (!mainChart.current) return;
    overlaySeries.current.forEach(s => {
      try { mainChart.current!.removeSeries(s); } catch {}
    });
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

  // ── Update panel (RSI / MACD) — FIX 1: tidak bergantung pada display ────
  useEffect(() => {
    if (!panelChart.current) return;

    // Hapus semua seri lama dulu
    panelSeries.current.forEach(s => {
      try { panelChart.current!.removeSeries(s); } catch {}
    });
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
    // panel === "none": series sudah di-clear di atas, tidak perlu isi ulang
    if (panelSeries.current.length) {
      panelChart.current.timeScale().fitContent();
    }
  }, [panel, ind]);

  // ── Render ───────────────────────────────────────────────────────────────
  const panelLabel = panel === "rsi" ? "RSI (14)" : panel === "macd" ? "MACD (12,26,9)" : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", background: C.bg, height: "100%" }}>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 6, padding: "5px 8px",
        borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", alignItems: "center", flexShrink: 0,
      }}>
        {/* Overlay */}
        <ToolGroup label="OVERLAY">
          {(["none", "sma", "ema", "bb"] as OverlayIndicator[]).map(o => (
            <Btn key={o} active={overlay === o} onClick={() => setOverlay(o)}
              color={o === "sma" ? C.sma20 : o === "ema" ? C.ema9 : o === "bb" ? C.bb_mid : C.text}>
              {o === "none" ? "—" : o.toUpperCase()}
            </Btn>
          ))}
        </ToolGroup>

        <Sep />

        {/* Panel */}
        <ToolGroup label="PANEL">
          {(["none", "rsi", "macd"] as PanelIndicator[]).map(p => (
            <Btn key={p} active={panel === p} onClick={() => setPanel(p)}
              color={p === "rsi" ? C.rsi_line : p === "macd" ? C.macd_line : C.text}>
              {p === "none" ? "—" : p.toUpperCase()}
            </Btn>
          ))}
        </ToolGroup>

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

      {/* ── Main chart ─────────────────────────────────────────────────── */}
      <div ref={mainRef} style={{ flexShrink: 0 }} />

      {/* ── Volume pane (FIX 2: selalu terlihat, chart terpisah) ─────── */}
      <div style={{ borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <PaneLabel>VOL</PaneLabel>
        <div ref={volRef} />
      </div>

      {/* ── RSI / MACD pane (FIX 1: div SELALU di-render) ───────────── */}
      {/* FIX: gunakan display:none bukan conditional render agar panelRef tetap valid */}
      <div style={{
        borderTop: `1px solid ${C.border}`, flexShrink: 0,
        display:   panel !== "none" ? "block" : "none",   // ← kunci fix bug
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
      border:  `1px solid ${active ? color : "transparent"}`,
      borderRadius: 3, background: active ? `${color}22` : "transparent",
      color:   active ? color : "#4a6080", cursor: "pointer",
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
