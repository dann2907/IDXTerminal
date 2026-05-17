export const fmt  = (v: number) => v >= 1000 ? v.toLocaleString("id") : String(v);

export const fmtV = (v: number) => {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}Jt`;
  if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}Rb`;
  return String(v);
};

export const fmtRp = (v: number | undefined): string => {
  if (v === undefined || v === 0) return "—";
  if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}T`;
  if (v >= 1_000_000_000)     return `${(v / 1_000_000_000).toFixed(1)}M`;
  return fmt(v);
};

export const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

export function parseNum(s: string): number | null {
  if (!s) return null;
  const n = Number.parseFloat(s.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
