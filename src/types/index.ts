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
  // Metadata & Fundamentals
  name?: string;
  sector?: string;
  industry?: string;
  market_cap?: number;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
  pe_ratio?: number;
  pbv_ratio?: number;
  dividend_yield?: number;
  avg_volume?: number; // 30d avg
}

export interface CandleData {
  time: number;     // unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

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

export interface Order {
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

export interface Alert {
  id: string; 
  ticker: string;
  condition: "above" | "below" | "change_pct" | "volume_spike";
  threshold: number; 
  active: boolean; 
  created_at: string;
}

export interface PortfolioSummary {
  cash: number;
  starting_cash: number;
  total_value: number;
  floating_pnl: number;
  realized_pnl: number;
}

export interface User { 
  id: string; 
  username: string; 
  email: string; 
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
