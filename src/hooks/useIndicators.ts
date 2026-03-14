// src/hooks/useIndicators.ts
//
// Hook untuk menghitung indicator dari candle data yang sudah ada di store.
// Semua perhitungan dilakukan di useMemo — tidak ada fetch tambahan.
//
// Dikembalikan per-ticker agar komponen chart bisa request ticker yang
// sedang ditampilkan tanpa re-render komponen lain.

import { useMemo } from "react";
import { useMarketStore } from "../stores/useMarketStore";
import {
  sma, ema, bollingerBands, rsi, macd,
  type LinePoint, type BBPoint, type MACDPoint,
} from "../lib/indicators";

export interface IndicatorSet {
  sma20:  LinePoint[];
  sma50:  LinePoint[];
  ema9:   LinePoint[];
  bb:     BBPoint[];
  rsi14:  LinePoint[];
  macd:   MACDPoint[];
}

export function useIndicators(ticker: string): IndicatorSet {
  const candles = useMarketStore(s => s.candles[ticker] ?? []);

  return useMemo(() => ({
    sma20:  sma(candles, 20),
    sma50:  sma(candles, 50),
    ema9:   ema(candles, 9),
    bb:     bollingerBands(candles, 20, 2),
    rsi14:  rsi(candles, 14),
    macd:   macd(candles, 12, 26, 9),
  }), [candles]);
}