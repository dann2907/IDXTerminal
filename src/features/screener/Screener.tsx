/**
 * Screener.tsx
 * 
 * Orchestrator component for the Stock Screener.
 * Opsi 1: TradingView Widget implementation for testing.
 */
import { C } from "./constants/tokens";
import "./screener.css";
import TVScreener from "./TVScreener";

// ── Types ─────────────────────────────────────────────────────────────────

interface Props {
  onSelectTicker: (ticker: string) => void;
  activeWatchlistCategoryId?: number;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function Screener({ onSelectTicker: _onSelectTicker, activeWatchlistCategoryId: _activeWatchlistCategoryId }: Readonly<Props>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, overflow: "hidden", color: C.text }}>
      <TVScreener colorTheme="dark" />
    </div>
  );
}
