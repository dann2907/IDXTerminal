export interface Candle {
  date: string; open: number; high: number; low: number; close: number; volume: number;
}
export interface StockQuote {
  ticker: string; last_price: number; change_pct: number;
  volume: number; high: number; low: number; updated_at: string;
}
export interface Holding { ticker: string; shares: number; avg_cost: number; }
export interface Order {
  id: string; ticker: string; type: "TP" | "SL";
  trigger_price: number; lots: number;
  status: "ACTIVE" | "TRIGGERED" | "CANCELLED"; created_at: string;
}
export interface Alert {
  id: string; ticker: string;
  condition: "above" | "below" | "change_pct" | "volume_spike";
  threshold: number; active: boolean; created_at: string;
}
export interface User { id: string; username: string; email: string; }
