// src/stores/usePortfolioStore.ts
//
// Zustand store untuk data portofolio — summary, holdings, history,
// orders, watchlist, dan performance.
//
// Dua sumber data:
//   REST API  → untuk data awal saat mount dan setelah operasi write
//   WebSocket → untuk notifikasi order_triggered (dari useMarketStore WS)
//
// Pattern yang dipakai: store ini tidak membuka WS sendiri.
// Sebaliknya, useMarketStore sudah punya koneksi WS aktif dan akan
// memanggil handleWsMessage() saat pesan "order_triggered" masuk.
// Ini menghindari dua koneksi WS ke endpoint yang sama.

import { create } from "zustand";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Holding {
  ticker: string;
  shares: number;
  lots: number | null;
  avg_cost: number;
  current_price: number;
  market_value: number;
  pnl_rp: number;
  pnl_pct: number;
  first_buy: string | null;
}

export interface TradeRecord {
  id: number;
  action: "BUY" | "SELL";
  ticker: string;
  shares: number;
  lots: number | null;
  price: number;
  total: number;
  source: string;
  traded_at: string;
}

export interface PortfolioOrder {
  order_id: string;
  ticker: string;
  order_type: "TP" | "SL";
  trigger_price: number;
  lots: number;
  shares: number;
  status: "ACTIVE" | "PENDING_CONFIRM" | "EXECUTED" | "CANCELLED";
  created_at: string;
  triggered_at: string | null;
}

export interface PortfolioSummary {
  cash: number;
  starting_cash: number;
  total_value: number;
  floating_pnl: number;
  realized_pnl: number;
}

export interface WatchlistTicker {
  ticker: string;
  price: number | null;
}

export interface WatchlistCategory {
  id: number;
  name: string;
  is_default: boolean;
  tickers: WatchlistTicker[];
}

interface WatchlistResponse {
  categories: WatchlistCategory[];
}

// Notifikasi order yang terpicu — dikirim dari backend via WS
export interface OrderTriggeredEvent {
  order_id: string;
  ticker: string;
  order_type: "TP" | "SL";
  trigger_price: number;
  current_price: number;
  lots: number;
  shares: number;
  symbol: string;
  message: string;
}

// ── Store ─────────────────────────────────────────────────────────────────

interface PortfolioState {
  summary: PortfolioSummary | null;
  holdings: Holding[];
  history: TradeRecord[];
  orders: PortfolioOrder[];
  watchlist: string[];
  watchlistCategories: WatchlistCategory[];
  performance: Record<string, unknown> | null;

  // Order triggered notification — frontend tampilkan dialog konfirmasi
  pendingOrderEvent: OrderTriggeredEvent | null;

  // Loading flags per operasi
  loading: {
    summary: boolean;
    holdings: boolean;
    history: boolean;
    orders: boolean;
  };

  // ── Fetch actions ────────────────────────────────────────────────────────
  fetchSummary: () => Promise<void>;
  fetchHoldings: () => Promise<void>;
  fetchHistory: (ticker?: string) => Promise<void>;
  fetchOrders: (status?: string) => Promise<void>;
  fetchWatchlist: () => Promise<void>;
  fetchPerformance: (period?: string) => Promise<void>;

  // Convenience: refresh semua data sekaligus
  refreshAll: () => Promise<void>;

  // ── Write actions ────────────────────────────────────────────────────────
  buy: (ticker: string, lots: number, price: number) => Promise<{ ok: boolean; message: string }>;
  sell: (ticker: string, lots: number, price: number) => Promise<{ ok: boolean; message: string }>;

  addOrder: (
    ticker: string,
    orderType: "TP" | "SL",
    triggerPrice: number,
    lots: number,
  ) => Promise<{ ok: boolean; message: string }>;
  cancelOrder: (orderId: string) => Promise<{ ok: boolean; message: string }>;

  // Confirm / dismiss saat order terpicu
  confirmOrder: (orderId: string, price: number) => Promise<{ ok: boolean; message: string }>;
  dismissOrder: (orderId: string) => Promise<{ ok: boolean; message: string }>;
  clearPendingOrderEvent: () => void;

  addToWatchlist: (ticker: string, categoryId?: number) => Promise<{ ok: boolean; message: string }>;
  removeFromWatchlist: (ticker: string, categoryId?: number) => Promise<{ ok: boolean; message: string }>;
  createWatchlistCategory: (name: string) => Promise<{
    ok: boolean;
    message: string;
    category?: WatchlistCategory;
  }>;
  renameWatchlistCategory: (categoryId: number, name: string) => Promise<{
    ok: boolean;
    message: string;
    category?: WatchlistCategory;
  }>;
  deleteWatchlistCategory: (categoryId: number) => Promise<{
    ok: boolean;
    message: string;
  }>;

  // ── WS handler (dipanggil oleh useMarketStore) ───────────────────────────
  handleWsMessage: (msg: { type: string; data: unknown }) => void;
}

const API = "http://127.0.0.1:8765/api/portfolio";

// ── Helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json() as T;
  if (!res.ok) {
    const detail = (json as { detail?: string }).detail ?? "Terjadi kesalahan";
    throw new Error(detail);
  }
  return json;
}

// ── Store implementation ──────────────────────────────────────────────────

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  summary: null,
  holdings: [],
  history: [],
  orders: [],
  watchlist: [],
  watchlistCategories: [],
  performance: null,
  pendingOrderEvent: null,
  loading: { summary: false, holdings: false, history: false, orders: false },

  // ── Fetch ─────────────────────────────────────────────────────────────────

  async fetchSummary() {
    set(s => ({ loading: { ...s.loading, summary: true } }));
    try {
      const data = await apiFetch<PortfolioSummary>("/summary");
      set({ summary: data });
    } catch (e) {
      console.error("[portfolio] fetchSummary:", e);
    } finally {
      set(s => ({ loading: { ...s.loading, summary: false } }));
    }
  },

  async fetchHoldings() {
    set(s => ({ loading: { ...s.loading, holdings: true } }));
    try {
      const data = await apiFetch<Holding[]>("/holdings");
      set({ holdings: data });
    } catch (e) {
      console.error("[portfolio] fetchHoldings:", e);
    } finally {
      set(s => ({ loading: { ...s.loading, holdings: false } }));
    }
  },

  async fetchHistory(ticker) {
    set(s => ({ loading: { ...s.loading, history: true } }));
    try {
      const q = ticker ? `?ticker=${ticker}` : "";
      const data = await apiFetch<TradeRecord[]>(`/history${q}`);
      set({ history: data });
    } catch (e) {
      console.error("[portfolio] fetchHistory:", e);
    } finally {
      set(s => ({ loading: { ...s.loading, history: false } }));
    }
  },

  async fetchOrders(status) {
    set(s => ({ loading: { ...s.loading, orders: true } }));
    try {
      const q = status ? `?status=${status}` : "";
      const data = await apiFetch<PortfolioOrder[]>(`/orders${q}`);
      set({ orders: data });

      // FIX: Jika ada order PENDING_CONFIRM dari sesi sebelumnya,
      // tampilkan dialog konfirmasi otomatis.
      if (!status || status === "PENDING_CONFIRM") {
        const pending = data.find(o => o.status === "PENDING_CONFIRM");
        if (pending) {
          const existing = get().pendingOrderEvent;
          if (!existing || existing.order_id !== pending.order_id) {
            set({
              pendingOrderEvent: {
                order_id: pending.order_id,
                ticker: pending.ticker,
                order_type: pending.order_type,
                trigger_price: pending.trigger_price,
                current_price: pending.trigger_price, // akan di-update oleh WS
                lots: pending.lots,
                shares: pending.shares,
                symbol: "Rp",
                message: `${pending.order_type} order untuk ${pending.ticker} terpicu. Eksekusi sekarang?`,
              },
            });
          }
        }
      }
    } catch (e) {
      console.error("[portfolio] fetchOrders:", e);
    } finally {
      set(s => ({ loading: { ...s.loading, orders: false } }));
    }
  },

  async fetchWatchlist() {
    try {
      const data = await apiFetch<WatchlistResponse>("/watchlist");
      const categories = data.categories ?? [];
      const tickers = Array.from(
        new Set(
          categories.flatMap(category => category.tickers.map(item => item.ticker)),
        ),
      );
      set({ watchlist: tickers, watchlistCategories: categories });
    } catch (e) {
      console.error("[portfolio] fetchWatchlist:", e);
    }
  },

  async fetchPerformance(period = "all") {
    try {
      const data = await apiFetch<Record<string, unknown>>(`/performance?period=${period}`);
      set({ performance: data });
    } catch (e) {
      console.error("[portfolio] fetchPerformance:", e);
    }
  },

  async refreshAll() {
    await Promise.all([
      get().fetchSummary(),
      get().fetchHoldings(),
      get().fetchOrders(),
      get().fetchWatchlist(),
    ]);
  },

  // ── Buy / Sell ─────────────────────────────────────────────────────────────

  async buy(ticker, lots, price) {
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>("/buy", {
        method: "POST",
        body: JSON.stringify({ ticker, lots, price }),
      });
      // Refresh state setelah transaksi berhasil
      await get().refreshAll();
      return res;
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  async sell(ticker, lots, price) {
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>("/sell", {
        method: "POST",
        body: JSON.stringify({ ticker, lots, price }),
      });
      await get().refreshAll();
      return res;
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  // ── Orders ─────────────────────────────────────────────────────────────────

  async addOrder(ticker, orderType, triggerPrice, lots) {
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>("/orders", {
        method: "POST",
        body: JSON.stringify({
          ticker,
          order_type: orderType,
          trigger_price: triggerPrice,
          lots,
        }),
      });
      await get().fetchOrders();
      return res;
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  async cancelOrder(orderId) {
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>(
        `/orders/${orderId}`,
        { method: "DELETE" },
      );
      await get().fetchOrders();
      return res;
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  async confirmOrder(orderId, price) {
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>(
        `/orders/${orderId}/confirm`,
        { method: "POST", body: JSON.stringify({ price }) },
      );
      // Clear pending notification & refresh semua data
      set({ pendingOrderEvent: null });
      await get().refreshAll();
      return res;
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  async dismissOrder(orderId) {
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>(
        `/orders/${orderId}/dismiss`,
        { method: "POST" },
      );
      set({ pendingOrderEvent: null });
      await get().fetchOrders();
      return res;
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  clearPendingOrderEvent() {
    set({ pendingOrderEvent: null });
  },

  // ── Watchlist ──────────────────────────────────────────────────────────────

  async addToWatchlist(ticker, categoryId) {
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>("/watchlist", {
        method: "POST",
        body: JSON.stringify({ ticker, category_id: categoryId }),
      });
      await get().fetchWatchlist();
      return res;
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  async removeFromWatchlist(ticker, categoryId) {
    try {
      const q = categoryId ? `?category_id=${categoryId}` : "";
      const res = await apiFetch<{ ok: boolean; message: string }>(
        `/watchlist/${ticker}${q}`,
        { method: "DELETE" },
      );
      await get().fetchWatchlist();
      return res;
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  async createWatchlistCategory(name) {
    try {
      const res = await apiFetch<{
        ok: boolean;
        message: string;
        category: WatchlistCategory;
      }>("/watchlist/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await get().fetchWatchlist();
      return res;
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  async renameWatchlistCategory(categoryId, name) {
    try {
      const res = await apiFetch<{
        ok: boolean;
        message: string;
        category: WatchlistCategory;
      }>(`/watchlist/categories/${categoryId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      await get().fetchWatchlist();
      return res;
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  async deleteWatchlistCategory(categoryId) {
    try {
      const res = await apiFetch<{
        ok: boolean;
        message: string;
      }>(`/watchlist/categories/${categoryId}`, {
        method: "DELETE",
      });
      await get().fetchWatchlist();
      return res;
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  // ── WS message handler ─────────────────────────────────────────────────────

  handleWsMessage(msg) {
    if (msg.type === "order_triggered") {
      // Simpan event ke state — IDXTerminal.jsx akan menampilkan dialog
      set({ pendingOrderEvent: msg.data as OrderTriggeredEvent });
      // Refresh orders agar status PENDING_CONFIRM terlihat di panel
      get().fetchOrders().catch(() => {});
    }
  },
}));
