// src/App.tsx
//
// Root component.
// Dua hal yang dilakukan saat mount:
//   1. initWebSocket()  — connect ke /ws/prices, mulai terima quote real-time
//   2. refreshAll()     — load summary, holdings, orders, watchlist dari REST API
//
// OrderTriggeredDialog di-render di sini (bukan di dalam IDXTerminal)
// agar selalu tampil di atas semua layer, bahkan saat user sedang di
// halaman apapun ketika TP/SL terpicu.

import { useEffect } from "react";
import IDXTerminal from "./components/IDXTerminal";
import OrderTriggeredDialog from "./components/OrderTriggeredDialog";
import { useMarketStore } from "./stores/useMarketStore";
import { usePortfolioStore } from "./stores/usePortfolioStore";

export default function App() {
  const initWebSocket = useMarketStore(s => s.initWebSocket);
  const refreshAll    = usePortfolioStore(s => s.refreshAll);

  useEffect(() => {
    initWebSocket();
    refreshAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <IDXTerminal />
      <OrderTriggeredDialog />
    </>
  );
}