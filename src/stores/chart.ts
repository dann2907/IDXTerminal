// src/stores/useChartStore.ts
//
// Multi-timeframe candle store.
//
// Key design decisions:
//   - Candles keyed by `${ticker}_${timeframe}` (e.g. "BBCA.JK_5m")
//   - updateLastCandle MUTATES last bar or appends new bar — never refetches
//   - MAX_CANDLES = 500: oldest candle is dropped when limit exceeded
//   - Loading/error tracked per key so UI can show skeleton per-timeframe
//   - No side effects in store — all WS/fetch logic lives in hooks

import { create } from "zustand";

// ── Constants ──────────────────────────────────────────────────────────────

export const MAX_CANDLES = 500;
export const TIMEFRAMES  = ["5m", "15m", "1h"] as const;

export type Timeframe = typeof TIMEFRAMES[number];

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Convert timeframe string to seconds.
 * Used to bucket timestamp → candle start time.
 */
export function timeframeToSeconds(tf: Timeframe): number {
  switch (tf) {
    case "5m":  return 300;
    case "15m": return 900;
    case "1h":  return 3600;
  }
}

/**
 * Given a unix timestamp and timeframe, return the candle's start time.
 * e.g. 10:07:32 on a 5m chart → 10:05:00
 */
export function snapToCandle(timestamp: number, tf: Timeframe): number {
  const s = timeframeToSeconds(tf);
  return Math.floor(timestamp / s) * s;
}

/** Canonical store key */
export function chartKey(ticker: string, tf: Timeframe): string {
  return `${ticker}_${tf}`;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface CandleBar {
  time:   number; // unix seconds — lightweight-charts expects this as UTCTimestamp
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export type ChartStatus = "idle" | "loading" | "ready" | "error";

interface KeyState {
  candles: CandleBar[];
  status:  ChartStatus;
  error:   string | null;
}

interface ChartStoreState {
  // Per (ticker+timeframe) data
  data: Record<string, KeyState>;

  // ── Queries ─────────────────────────────────────────────────────────────
  getCandles:  (key: string) => CandleBar[];
  getStatus:   (key: string) => ChartStatus;
  hasData:     (key: string) => boolean;

  // ── Mutations ────────────────────────────────────────────────────────────
  setLoading:  (key: string) => void;
  setError:    (key: string, err: string) => void;

  /**
   * Replace full candle set (called after API fetch).
   * Trims to MAX_CANDLES, sorted ascending by time.
   */
  setCandles:  (key: string, candles: CandleBar[]) => void;

  /**
   * CRITICAL: Real-time update — never refetches.
   *
   * Logic:
   *   1. Snap incoming timestamp to candle boundary for this timeframe
   *   2a. If same boundary as last candle → update close/high/low in-place
   *   2b. If new boundary → append new candle (open = prev close)
   *   3. Trim to MAX_CANDLES
   *
   * Returns the updated last candle (used by chart to call .update())
   */
  updateLastCandle: (
    key:       string,
    tf:        Timeframe,
    price:     number,
    timestamp: number,   // unix seconds
    volume?:   number,
  ) => CandleBar | null;

  clearTicker: (ticker: string) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────

export const useChartStore = create<ChartStoreState>((set, get) => ({
  data: {},

  // ── Queries ───────────────────────────────────────────────────────────────

  getCandles(key) {
    return get().data[key]?.candles ?? [];
  },

  getStatus(key) {
    return get().data[key]?.status ?? "idle";
  },

  hasData(key) {
    const d = get().data[key];
    return d?.status === "ready" && d.candles.length > 0;
  },

  // ── Mutations ─────────────────────────────────────────────────────────────

  setLoading(key) {
    set(s => ({
      data: {
        ...s.data,
        [key]: { candles: s.data[key]?.candles ?? [], status: "loading", error: null },
      },
    }));
  },

  setError(key, err) {
    set(s => ({
      data: {
        ...s.data,
        [key]: { candles: s.data[key]?.candles ?? [], status: "error", error: err },
      },
    }));
  },

  setCandles(key, candles) {
    const sorted  = [...candles].sort((a, b) => a.time - b.time);
    const trimmed = sorted.slice(-MAX_CANDLES);
    set(s => ({
      data: {
        ...s.data,
        [key]: { candles: trimmed, status: "ready", error: null },
      },
    }));
  },

  updateLastCandle(key, tf, price, timestamp, volume = 0) {
    const state   = get().data[key];
    const candles = state?.candles;

    // Nothing to update if no data yet — wait for initial fetch
    if (!candles || candles.length === 0) return null;

    const candleStart = snapToCandle(timestamp, tf);
    const last        = candles[candles.length - 1];

    let updated: CandleBar;
    let newCandles: CandleBar[];

    if (candleStart === last.time) {
      // ── Same interval: mutate last candle ─────────────────────────────
      updated = {
        ...last,
        close:  price,
        high:   Math.max(last.high, price),
        low:    Math.min(last.low,  price),
        volume: last.volume + volume,
      };
      // Replace last element — avoid full array copy using slice
      newCandles = candles.slice(0, -1);
      newCandles.push(updated);
    } else if (candleStart > last.time) {
      // ── New interval: open = previous close ───────────────────────────
      updated = {
        time:   candleStart,
        open:   last.close,
        high:   Math.max(last.close, price),
        low:    Math.min(last.close, price),
        close:  price,
        volume: volume,
      };
      newCandles = candles.concat(updated);

      // Trim oldest if over limit
      if (newCandles.length > MAX_CANDLES) {
        newCandles = newCandles.slice(newCandles.length - MAX_CANDLES);
      }
    } else {
      // Stale timestamp (e.g. out-of-order packet) — ignore
      return null;
    }

    set(s => ({
      data: {
        ...s.data,
        [key]: { ...s.data[key], candles: newCandles },
      },
    }));

    return updated;
  },

  clearTicker(ticker) {
    set(s => {
      const next = { ...s.data };
      for (const tf of TIMEFRAMES) {
        delete next[chartKey(ticker, tf)];
      }
      return { data: next };
    });
  },
}));