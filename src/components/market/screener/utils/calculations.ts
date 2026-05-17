import { C } from "../constants/tokens";

export const getVolColor = (rvol: number) => {
  return rvol >= 1.5 ? C.up : (rvol < 0.5 ? C.dn : C.label);
};

export const getRangePos = (price: number, low: number, high: number) => {
  const range = high - low;
  return range > 0 ? ((price - low) / range) * 100 : 50;
};

export const getSignal = (q: any) => {
  if (q.change_pct < -5) return { label: "OVERSOLD", color: C.dn };
  if (q.rvol > 2) return { label: "UNUSUAL VOL", color: C.accent };
  if (q.change_pct > 3 && q.volume > 5_000_000) return { label: "BREAKOUT", color: C.accent };
  if (q.rs_rank > 85) return { label: "STRONG RS", color: C.accent };
  if (q.fifty_two_week_high && q.price >= q.fifty_two_week_high * 0.98) return { label: "NEAR ATH", color: C.accent };
  return null;
};
