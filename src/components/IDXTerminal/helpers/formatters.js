// src/components/IDXTerminal/helpers/formatters.js
export const fmtPrice = v => {
  if (v === undefined || v === null) return "—";
  return v >= 1000 ? v.toLocaleString("id") : v.toString();
};

export const fmtRp = v => {
  if (!v && v !== 0) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}Jt`;
  return `Rp${v.toLocaleString("id")}`;
};

export const fmtPct = v => {
  if (v === undefined || v === null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
};