// src/stores/useMarketStore.ts
//
// Zustand store untuk harga pasar real-time.
//
// Flow:
//   initWebSocket() → connect ke /ws/prices
//   → "snapshot" message  : replace semua harga sekaligus
//   → "update"   message  : merge harga baru ke state
//   Reconnect otomatis dengan exponential backoff (max 30 detik).
//
// fetchOrders setelah reconnect ditangani eksklusif oleh App.tsx
// via useEffect([wsStatus]) — tidak perlu duplikat di sini.

import { create } from "zustand";
import { usePortfolioStore } from "./usePortfolioStore";

// ── Types ──────────────────────────────────────────────────────────────────

export interface QuoteData {
  ticker: string;
  price: number;
  prev_close: number;
  change: number;
  change_pct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  timestamp: string;
  is_live: boolean;
}

export interface CandleData {
  time: number;     // unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type WsStatus = "connecting" | "connected" | "disconnected" | "error";

// ── Store state & actions ──────────────────────────────────────────────────

interface MarketState {
  quotes: Record<string, QuoteData>;
  candles: Record<string, CandleData[]>;
  wsStatus: WsStatus;

  getQuote: (ticker: string) => QuoteData | undefined;
  topGainers: (n?: number) => QuoteData[];
  topLosers:  (n?: number) => QuoteData[];

  initWebSocket: () => void;
  disconnectWebSocket: () => void;
  fetchCandles: (ticker: string, period?: string, interval?: string) => Promise<void>;
  searchTicker: (query: string) => Promise<QuoteData | null>;
}

// ── WebSocket singleton ───────────────────────────────────────────────────

let _ws: WebSocket | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _reconnectDelay = 1000;
const _MAX_RECONNECT = 30_000;

const WS_URL = "ws://127.0.0.1:8765/ws/prices";
const API_BASE = "http://127.0.0.1:8765";

// ── Store ─────────────────────────────────────────────────────────────────

export const useMarketStore = create<MarketState>((set, get) => ({
  quotes: {},
  candles: {},
  wsStatus: "disconnected",

  // ── Computed ──────────────────────────────────────────────────────────────

  getQuote(ticker) {
    return get().quotes[ticker.toUpperCase()];
  },

  topGainers(n = 5) {
    return Object.values(get().quotes)
      .filter(q => q.change_pct > 0)
      .sort((a, b) => b.change_pct - a.change_pct)
      .slice(0, n);
  },

  topLosers(n = 5) {
    return Object.values(get().quotes)
      .filter(q => q.change_pct < 0)
      .sort((a, b) => a.change_pct - b.change_pct)
      .slice(0, n);
  },

  // ── WebSocket ─────────────────────────────────────────────────────────────

  initWebSocket() {
    if (_ws && _ws.readyState === WebSocket.OPEN) return;
    if (_ws && _ws.readyState === WebSocket.CONNECTING) return;

    set({ wsStatus: "connecting" });
    _ws = new WebSocket(WS_URL);

    // FIX: hapus fetchOrders dari sini — App.tsx useEffect([wsStatus])
    // sudah handle ini. Memanggil di sini menyebabkan duplikasi request
    // setiap kali koneksi terbuka.
    _ws.onopen = () => {
      _reconnectDelay = 1000;
      set({ wsStatus: "connected", quotes: {} }); // clear stale quotes (F1)
    };

    _ws.onmessage = (event) => {
      let msg: { type: string; data: unknown };
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      if (msg.type === "order_triggered") {
        usePortfolioStore.getState().handleWsMessage(msg);
        return;
      }
      if (msg.type === "snapshot") {
        set({ quotes: msg.data as Record<string, QuoteData> });
      } else if (msg.type === "update") {
        set(state => ({
          quotes: { ...state.quotes, ...(msg.data as Record<string, QuoteData>) },
        }));
      }
    };

    _ws.onerror = () => {
      set({ wsStatus: "error" });
    };

    _ws.onclose = () => {
      set({ wsStatus: "disconnected" });
      _ws = null;
      _scheduleReconnect(get().initWebSocket);
    };
  },

  disconnectWebSocket() {
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
    }
    _reconnectDelay = 1000;
    if (_ws) {
      _ws.onclose = null;
      _ws.close();
      _ws = null;
    }
    set({ wsStatus: "disconnected" });
  },

  // ── Candles ───────────────────────────────────────────────────────────────

  async fetchCandles(ticker, period = "3mo", interval = "1d") {
    const t = ticker.toUpperCase().endsWith(".JK")
      ? ticker.toUpperCase()
      : `${ticker.toUpperCase()}.JK`;
    try {
      const res = await fetch(
        `${API_BASE}/api/market/candles/${t}?period=${period}&interval=${interval}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { candles: CandleData[] };
      set(state => ({
        candles: { ...state.candles, [t]: json.candles },
      }));
    } catch (err) {
      console.error("[useMarketStore] fetchCandles error:", err);
    }
  },

  // ── Search ────────────────────────────────────────────────────────────────

  async searchTicker(query) {
    const t = query.toUpperCase().endsWith(".JK")
      ? query.toUpperCase()
      : `${query.toUpperCase()}.JK`;
    try {
      const res = await fetch(`${API_BASE}/api/market/search/${t}`);
      if (!res.ok) return null;
      const json = await res.json() as { ticker: string; price?: number; name?: string };
      const existing = get().quotes[json.ticker];
      return existing ?? null;
    } catch (err) {
      console.error("[useMarketStore] searchTicker error:", err);
      return null;
    }
  },
}));

// ── Reconnect helper ──────────────────────────────────────────────────────

function _scheduleReconnect(initFn: () => void) {
  if (_reconnectTimer) clearTimeout(_reconnectTimer);
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    initFn();
  }, _reconnectDelay);
  _reconnectDelay = Math.min(_reconnectDelay * 2, _MAX_RECONNECT);
}