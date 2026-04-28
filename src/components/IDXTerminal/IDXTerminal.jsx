// src/components/IDXTerminal/IDXTerminal.jsx
import { useState, useCallback, useEffect } from "react";
import { useMarketStore } from "../../stores/useMarketStore";
import { usePortfolioStore } from "../../stores/usePortfolioStore";
import { ensureFonts } from "./utils/ensureFonts";
import { useClock } from "./hooks/useClock";
import { useFlashQuotes } from "./hooks/useFlashQuotes";
import { useWatchlistManager } from "./hooks/useWatchlistManager";
import { useTradeFlow } from "./hooks/useTradeFlow";
import Topbar from "./components/Topbar";
import SidebarWatchlist from "./components/SidebarWatchlist";
import ChartPage from "./components/ChartPage";
import MarketPage from "./components/MarketPage";
import PortfolioPage from "./components/PortfolioPage";
import HeatmapPage from "./components/HeatmapPage";
import RightPanel from "./components/RightPanel";
import FeedBar from "./components/FeedBar";
import TradeConfirmDialog from "../TradeConfirmDialog";
import Screener from "../market/Screener";
import AlertsPanel from "../alerts/AlertsPanel";
import "./IDXTerminal.css";

// Fonts loaded once
ensureFonts();

const PAGES = ["MARKET", "CHART", "PORTFOLIO", "SCREENER", "ALERTS", "HEATMAP"];

export default function IDXTerminal() {
  // ── Global state from stores ──────────────────────────────────────────
  const quotes      = useMarketStore(s => s.quotes);
  const wsStatus    = useMarketStore(s => s.wsStatus);
  const topGainers  = useMarketStore(s => s.topGainers);
  const topLosers   = useMarketStore(s => s.topLosers);
  const summary     = usePortfolioStore(s => s.summary);
  const holdings    = usePortfolioStore(s => s.holdings);

  // ── UI global state ───────────────────────────────────────────────────
  const [page, setPage]                = useState("CHART");
  const [selectedTicker, setSelectedTicker] = useState("BBCA.JK");

  // Sub‑hooks
  const currentTime = useClock();
  const flashMap    = useFlashQuotes(quotes);
  const watchlist   = useWatchlistManager();
  const tradeFlow   = useTradeFlow(selectedTicker, quotes, holdings, summary);

  // Search → chart navigation
  const handleSearchSelect = useCallback((ticker) => {
    setSelectedTicker(ticker);
    setPage("CHART");
  }, []);

  // Derived helpers
  const gainers = topGainers(3);
  const losers  = topLosers(3);
  const selectedQuote = quotes[selectedTicker];

  return (
    <>
      <div className="terminal">
        <Topbar
          indexData={indexData}
          wsStatus={wsStatus}
          currentTime={currentTime}
          activePage={page}
          onPageChange={setPage}
          onSearchSelect={handleSearchSelect}
          selectedTicker={selectedTicker}
          selectedTickerInWatchlist={watchlist.isTickerInActive(selectedTicker)}
          onWatchlistToggle={watchlist.toggleSelected(selectedTicker)}
        />

        <div className="body">
          <SidebarWatchlist
            watchlist={watchlist}
            selectedTicker={selectedTicker}
            onSelectTicker={(t) => { setSelectedTicker(t); setPage("CHART"); }}
            flashMap={flashMap}
          />

          <div className="main">
            {page === "CHART" && (
              <ChartPage
                ticker={selectedTicker}
                inWatchlist={watchlist.isTickerInActive(selectedTicker)}
                onWatchlistToggle={watchlist.toggleSelected(selectedTicker)}
              />
            )}
            {page === "MARKET" && (
              <MarketPage
                gainers={gainers}
                losers={losers}
                quotes={quotes}
                flashMap={flashMap}
                onSelectTicker={(t) => { setSelectedTicker(t); setPage("CHART"); }}
              />
            )}
            {page === "PORTFOLIO" && <PortfolioPage selectedTicker={selectedTicker} onSelectTicker={(t) => { setSelectedTicker(t); setPage("CHART"); }} />}
            {page === "SCREENER" && (
              <Screener
                activeWatchlistCategoryId={watchlist.activeCategoryId ?? undefined}
                onSelectTicker={(t) => { setSelectedTicker(t); setPage("CHART"); }}
              />
            )}
            {page === "ALERTS" && <AlertsPanel />}
            {page === "HEATMAP" && (
              <HeatmapPage quotes={quotes} onSelectTicker={(t) => { setSelectedTicker(t); setPage("CHART"); }} />
            )}
            <FeedBar quotes={quotes} />
          </div>

          <RightPanel
            summary={summary}
            holdings={holdings}
            gainers={gainers}
            losers={losers}
            selectedTicker={selectedTicker}
            selectedQuote={selectedQuote}
            trade={tradeFlow}
            onSelectTicker={(t) => { setSelectedTicker(t); setPage("CHART"); }}
          />
        </div>
      </div>

      <TradeConfirmDialog
        payload={tradeFlow.confirmPayload}
        onConfirm={tradeFlow.handleConfirm}
        onCancel={tradeFlow.cancelConfirm}
      />
    </>
  );
}