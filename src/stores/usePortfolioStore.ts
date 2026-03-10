import { create } from "zustand";

interface PortfolioState {
  cash:         number;
  holdings:     Record<string, { shares: number; avg_cost: number }>;
  history:      any[];
  orders:       Record<string, any[]>;
  watchlist:    string[];
  setPortfolio: (d: Partial<PortfolioState>) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  cash:         0,
  holdings:     {},
  history:      [],
  orders:       {},
  watchlist:    [],
  setPortfolio: (data) => set((s) => ({ ...s, ...data })),
}));
