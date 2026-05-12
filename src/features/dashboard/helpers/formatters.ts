// src/features/dashboard/helpers/formatters.ts

export const fmtPrice = (v: number | undefined | null): string => {
  if (v === undefined || v === null) return "—";
  return v >= 1000 ? v.toLocaleString("id") : v.toString();
};

export const fmtRp = (v: number | undefined | null): string => {
  if (v === undefined || v === null) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  
  // Indonesia context: t = triliun, M = miliar, jt = juta
  if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(2)}t`;
  if (abs >= 1_000_000_000)     return `${sign}${(abs / 1_000_000_000).toFixed(2)}M`;
  if (abs >= 1_000_000)         return `${sign}${(abs / 1_000_000).toFixed(2)}jt`;
  
  return `${sign}Rp${abs.toLocaleString("id")}`;
};

export const fmtPct = (v: number | undefined | null): string => {
  if (v === undefined || v === null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
};
