// src/stores/useAlertStore.ts
//
// Zustand store untuk price alert.
// Alert terpicu → ws message "alert_triggered" → notifikasi toast di UI.

import { create } from "zustand";

const API = "http://127.0.0.1:8765/api/alerts";

export interface PriceAlert {
  id:           string;
  ticker:       string;
  condition:    "above" | "below" | "change_pct" | "volume_spike";
  threshold:    number;
  note:         string;
  is_active:    boolean;
  triggered_at: string | null;
  created_at:   string;
}

export interface AlertToast {
  id:        string;
  ticker:    string;
  message:   string;
  symbol:    string;
}

interface AlertState {
  alerts:  PriceAlert[];
  toasts:  AlertToast[];
  loading: boolean;

  fetchAlerts:  (activeOnly?: boolean) => Promise<void>;
  createAlert:  (ticker: string, condition: string, threshold: number, note?: string) => Promise<{ ok: boolean; message: string }>;
  deleteAlert:  (id: string) => Promise<void>;
  handleWsMessage: (msg: { type: string; data: unknown }) => void;
  dismissToast: (id: string) => void;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res  = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...init });
  const json = await res.json() as T;
  if (!res.ok) throw new Error((json as { detail?: string }).detail ?? "Error");
  return json;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts:  [],
  toasts:  [],
  loading: false,

  async fetchAlerts(activeOnly = false) {
    set({ loading: true });
    try {
      const data = await apiFetch<PriceAlert[]>(`?active_only=${activeOnly}`);
      set({ alerts: data });
    } catch (e) {
      console.error("[alerts] fetchAlerts:", e);
    } finally {
      set({ loading: false });
    }
  },

  async createAlert(ticker, condition, threshold, note = "") {
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>("", {
        method: "POST",
        body:   JSON.stringify({ ticker, condition, threshold, note }),
      });
      await get().fetchAlerts();
      return res;
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  async deleteAlert(id) {
    try {
      await apiFetch(`/${id}`, { method: "DELETE" });
      set(s => ({ alerts: s.alerts.filter(a => a.id !== id) }));
    } catch (e) {
      console.error("[alerts] deleteAlert:", e);
    }
  },

  handleWsMessage(msg) {
    if (msg.type !== "alert_triggered") return;
    const data = msg.data as AlertToast;
    // Tambah toast + update alert jadi tidak aktif di state lokal
    set(s => ({
      toasts:  [...s.toasts, { id: data.id, ticker: data.ticker, message: data.message, symbol: data.symbol }],
      alerts:  s.alerts.map(a => a.id === data.id ? { ...a, is_active: false } : a),
    }));
  },

  dismissToast(id) {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
  },
}));