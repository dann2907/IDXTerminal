// src/components/IDXTerminal/IDXTerminal.jsx
import { useState, useCallback, useMemo, memo } from "react";
import { useMarketStore } from "../../stores/useMarketStore";
import { usePortfolioStore } from "../../stores/usePortfolioStore";
import { useClock } from "./hooks/useClock";
import { useFlashQuotes } from "./hooks/useFlashQuotes";
import { useWatchlistManager } from "./hooks/useWatchlistManager";
import { useTradeFlow } from "./hooks/useTradeFlow";

import Topbar from "./Topbar";
import SidebarWatchlist from "./SidebarWatchlist";
import RightPanel from "./RightPanel";
import FeedBar from "./FeedBar";

// Lazy-loaded sub-pages
import ChartPage from "./ChartPage";
import MarketPage from "./MarketPage";
import PortfolioPage from "./PortfolioPage";
import HeatmapPage from "./HeatmapPage";

// Features from other folders
import Screener from "../../components/market/screener/Screener";
import AlertsPanel from "../../components/alerts/AlertsPanel";
import TradeConfirmDialog from "../../components/TradeConfirmDialog";

const IDXTerminal = memo(function IDXTerminal() {
  const [page, setPage] = useState("MARKET");
  const [selectedTicker, setSelectedTicker] = useState("BBCA.JK");

  const quotes     = useMarketStore(s => s.quotes);
  const indexData  = useMarketStore(s => s.indexData);
  const wsStatus   = useMarketStore(s => s.wsStatus);
  const topGainers = useMarketStore(s => s.topGainers);
  const topLosers  = useMarketStore(s => s.topLosers);

  const summary  = usePortfolioStore(s => s.summary);
  const holdings = usePortfolioStore(s => s.holdings);

  const currentTime = useClock();
  const flashMap    = useFlashQuotes(quotes);
  const watchlist   = useWatchlistManager();
  const tradeFlow   = useTradeFlow(selectedTicker, quotes, holdings, summary);

  const gainers = useMemo(() => topGainers(5), [topGainers]);
  const losers  = useMemo(() => topLosers(5), [topLosers]);
  const selectedQuote = quotes[selectedTicker];

  const handleSelectTicker = useCallback((t: string) => {
    setSelectedTicker(t);
  }, []);

  const handleSearchSelect = useCallback((t: string) => {
    setSelectedTicker(t);
    setPage("CHART");
  }, []);

  const isTickerInActive = watchlist.activeTickers.includes(selectedTicker);
  const toggleSelected = () => watchlist.toggleSelected(selectedTicker);

  return (
    <>
      <div className="h-screen flex flex-col bg-[#0B1120] text-slate-100 overflow-hidden">
        <Topbar
          indexData={indexData}
          wsStatus={wsStatus}
          currentTime={currentTime}
          activePage={page}
          onPageChange={setPage}
          onSearchSelect={handleSearchSelect}
        />

        <div className="flex-1 grid grid-cols-[260px_1fr_320px] overflow-hidden">
          <SidebarWatchlist
            watchlist={watchlist}
            selectedTicker={selectedTicker}
            onSelectTicker={handleSelectTicker}
            flashMap={flashMap}
          />

          <main className="min-w-0 flex flex-col bg-[#090D16] overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {page === "CHART" ? (
                <ChartPage
                  ticker={selectedTicker}
                  inWatchlist={isTickerInActive}
                  onWatchlistToggle={toggleSelected}
                />
              ) : null}
              {page === "MARKET" ? (
                <MarketPage
                  gainers={gainers}
                  losers={losers}
                  quotes={quotes}
                  flashMap={flashMap}
                  onSelectTicker={handleSelectTicker}
                />
              ) : null}
              {page === "PORTFOLIO" ? (
                <PortfolioPage
                  selectedTicker={selectedTicker}
                  onSelectTicker={handleSelectTicker}
                />
              ) : null}
              {page === "SCREENER" ? (
                <Screener
                  activeWatchlistCategoryId={watchlist.active?.id ?? undefined}
                  onSelectTicker={handleSelectTicker}
                />
              ) : null}
              {page === "ALERTS" ? <AlertsPanel /> : null}
              {page === "HEATMAP" ? (
                <HeatmapPage
                  quotes={quotes}
                  onSelectTicker={handleSelectTicker}
                />
              ) : null}
            </div>
            <FeedBar quotes={quotes} />
          </main>

          <RightPanel
            summary={summary}
            holdings={holdings}
            gainers={gainers}
            losers={losers}
            selectedTicker={selectedTicker}
            selectedQuote={selectedQuote}
            trade={tradeFlow}
            onSelectTicker={handleSelectTicker}
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
});

export default IDXTerminal;
