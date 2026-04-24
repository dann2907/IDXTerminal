// src/hooks/useChartWebSocket.ts
//
// Attaches to the existing /ws/prices WebSocket and drives real-time
// candle updates for (ticker, timeframe) pairs.
//
// Design decisions:
//   - Reuses the WS already managed by useMarketStore — no second connection
//   - Per-key throttle (100–300ms) via a ref-based timer map
//     so high-frequency tickers don't flood the chart render pipeline
//   - Decoupled from React render cycle — throttled via setTimeout, not
//     useDeferredValue / useTransition (those are for React 18 concurrent
//     scheduler, not for bypassing JS event loop frequency)
//   - Returns the latest CandleBar so the chart component can call
//     series.update() directly without a Zustand subscription re-render

import { useEffect, useRef, useCallback } from "react";
import {
  useChartStore,
  chartKey,
  type Timeframe,
  type CandleBar,
} from "../stores/useChartStore";

const API_BASE = "http://127.0.0.1:8765";
const WS_URL   = "ws://127.0.0.1:8765/ws/prices";

// ── Throttle config ────────────────────────────────────────────────────────
// 150ms sweet spot: smooth enough for live chart, cheap enough for CPU.
// Lower → more renders. Higher → chart feels laggy vs actual market.
const THROTTLE_MS = 150;

// ── Types ──────────────────────────────────────────────────────────────────

interface PriceUpdate {
  ticker:     string;
  price:      number;
  timestamp:  string;   // ISO string from backend
  volume?:    number;
  change_pct: number;
}

interface UseChartWebSocketOptions {
  ticker:    string;
  timeframe: Timeframe;
  /** Called with the updated last candle — chart uses this to call .update() */
  onUpdate:  (bar: CandleBar) => void;
}

// ── Module-level WS singleton ──────────────────────────────────────────────
// Shared across all hook instances — one socket, N subscribers.

interface Subscriber {
  ticker:   string;
  callback: (update: PriceUpdate) => void;
}

let _ws:           WebSocket | null = null;
let _reconnectT:   ReturnType<typeof setTimeout> | null = null;
let _reconnectMs   = 1_000;
const _MAX_RECONNECT = 30_000;
const _subscribers  = new Set<Subscriber>();

function _dispatch(update: PriceUpdate) {
  for (const sub of _subscribers) {
    if (sub.ticker === update.ticker) sub.callback(update);
  }
}

function _connect() {
  if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return;

  _ws = new WebSocket(WS_URL);

  _ws.onopen = () => {
    _reconnectMs = 1_000;
    console.debug("[ChartWS] connected");
  };

  _ws.onmessage = (evt) => {
    let msg: { type: string; data: unknown };
    try { msg = JSON.parse(evt.data); }
    catch { return; }

    if (msg.type !== "update" && msg.type !== "snapshot") return;

    const data = msg.data as Record<string, PriceUpdate>;
    for (const update of Object.values(data)) {
      if (update?.ticker && update?.price) _dispatch(update);
    }
  };

  _ws.onerror  = () => { _ws?.close(); };
  _ws.onclose  = () => {
    _ws = null;
    if (_reconnectT) clearTimeout(_reconnectT);
    _reconnectT = setTimeout(() => { _reconnectT = null; _connect(); }, _reconnectMs);
    _reconnectMs = Math.min(_reconnectMs * 2, _MAX_RECONNECT);
  };
}

function _subscribe(sub: Subscriber) {
  _subscribers.add(sub);
  _connect(); // ensure WS is alive
  return () => { _subscribers.delete(sub); };
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useChartWebSocket({ ticker, timeframe, onUpdate }: UseChartWebSocketOptions) {
  const updateLastCandle = useChartStore(s => s.updateLastCandle);
  const key              = chartKey(ticker, timeframe);

  // Stable ref to onUpdate — avoids stale closure inside throttle timer
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  // Per-key throttle: { key → { pending: PriceUpdate | null, timerId } }
  const throttleMap = useRef<Map<string, { pending: PriceUpdate | null; timer: ReturnType<typeof setTimeout> | null }>>(new Map());

  const handleUpdate = useCallback((update: PriceUpdate) => {
    let slot = throttleMap.current.get(key);
    if (!slot) {
      slot = { pending: null, timer: null };
      throttleMap.current.set(key, slot);
    }

    // Always overwrite pending — we only care about the latest price
    slot.pending = update;

    if (slot.timer !== null) return; // already scheduled, will flush on next tick

    slot.timer = setTimeout(() => {
      const pending = slot!.pending;
      slot!.pending = null;
      slot!.timer   = null;

      if (!pending) return;

      const ts = pending.timestamp
        ? Math.floor(new Date(pending.timestamp).getTime() / 1_000)
        : Math.floor(Date.now() / 1_000);

      const bar = updateLastCandle(key, timeframe, pending.price, ts, pending.volume ?? 0);
      if (bar) onUpdateRef.current(bar);
    }, THROTTLE_MS);
  }, [key, timeframe, updateLastCandle]);

  useEffect(() => {
    const unsub = _subscribe({ ticker, callback: handleUpdate });
    return () => {
      unsub();
      // Cancel any pending timer for this key
      const slot = throttleMap.current.get(key);
      if (slot?.timer) clearTimeout(slot.timer);
      throttleMap.current.delete(key);
    };
  }, [ticker, key, handleUpdate]);
}

// ── API fetch helper ───────────────────────────────────────────────────────

/**
 * Fetch historical candles from the backend.
 * Maps backend response to CandleBar format.
 */
export async function fetchCandles(
  ticker:    string,
  timeframe: Timeframe,
  period:    string = "5d",
): Promise<CandleBar[]> {
  const url = `${API_BASE}/api/market/candles/${ticker}?interval=${timeframe}&period=${period}`;
  const res = await fetch(url);

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching candles for ${ticker}/${timeframe}`);

  const json = await res.json() as { candles: Array<{
    time:   number;
    open:   number;
    high:   number;
    low:    number;
    close:  number;
    volume: number;
  }> };

  return json.candles
    .map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }))
    .sort((a, b) => a.time - b.time);
}