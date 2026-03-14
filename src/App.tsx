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
  const wsStatus = useMarketStore(s => s.wsStatus);
  const fetchOrders = usePortfolioStore(s => s.fetchOrders);
  // Mount: mulai WS + fetch data non-WS paralel (tidak tunggu koneksi)
  useEffect(() => {
    initWebSocket();
    const { fetchSummary, fetchHoldings, fetchWatchlist } =
      usePortfolioStore.getState();
    Promise.all([fetchSummary(), fetchHoldings(), fetchWatchlist()]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // FIX F2: fetchOrders SETELAH WS connected — tangkap PENDING_CONFIRM
  // yang mungkin terpicu saat app tertutup atau selama jendela reconnect
  useEffect(() => {
    if (wsStatus === "connected") {
      fetchOrders();
    }
  }, [wsStatus, fetchOrders]);
  return (
    <>
      <IDXTerminal />
      <OrderTriggeredDialog />
    </>
  );
}
