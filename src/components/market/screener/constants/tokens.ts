import type React from "react";

export const PAGE_SIZE = 50;

export const C = {
  bg:      "#1A1D29",
  surface: "#242736",
  border:  "#2d3142",
  muted:   "#4a6080",
  label:   "#A0A0A0",
  text:    "#E5E5E5",
  up:      "#00D66F",
  dn:      "#FF4D4D",
  accent:  "#00A8FF",
  warning: "#facc15",
  white:   "#FFFFFF",
};

export const ALL_COLUMNS = [
  { id: "price",      label: "Last",      align: "right",  w: 90 },
  { id: "sparkline",  label: "Trend",     align: "center", w: 90 },
  { id: "change_pct", label: "Chg%",      align: "right",  w: 80 },
  { id: "volume",     label: "Volume",    align: "right",  w: 120 },
  { id: "range",      label: "Day Range", align: "center", w: 130 },
  { id: "rvol",       label: "RVOL",      align: "right",  w: 60 },
  { id: "rs_rank",    label: "RS Rank",   align: "right",  w: 60 },
  { id: "signals",    label: "Signals",   align: "left",   w: 130 },
  { id: "market_cap", label: "Mkt Cap",   align: "right",  w: 90 },
  { id: "pe_ratio",   label: "P/E",       align: "right",  w: 60 },
  { id: "pbv_ratio",  label: "PBV",       align: "right",  w: 60 },
] as const;

export const INPUT_STYLE: React.CSSProperties = {
  background:   "#11141d",
  border:       `1px solid ${C.border}`,
  borderRadius: 4,
  color:        "#fff",
  fontFamily:   "'Space Mono',monospace",
  fontSize:     12,
  padding:      "6px 10px",
  outline:      "none",
  transition:   "border-color 0.2s",
};

export const LABEL_STYLE: React.CSSProperties = {
  fontSize:   9,
  color:      "#A0A0A0",
  fontFamily: "'Syne',sans-serif",
  letterSpacing: 1,
  fontWeight: 800,
  textTransform: "uppercase"
};

export const RESET_BTN: React.CSSProperties = {
  padding:    "6px 14px", fontSize: 11,
  fontFamily: "'Syne',sans-serif",
  fontWeight: 700,
  border:     `1px solid ${C.border}`,
  borderRadius: 4, background: "transparent",
  color:      C.accent, cursor: "pointer",
  textTransform: "uppercase"
};
