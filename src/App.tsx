// src/App.tsx
//
// Root component dengan Auth Gate dan Bootstrap.

import { useEffect } from "react";
import IDXTerminal              from "@/features/dashboard/IDXTerminal";
import OrderTriggeredDialog     from "@/shared/ui/OrderTriggeredDialog";
import LoginPage                from "@/features/auth/LoginPage";
import ResetPasswordPage         from "@/features/auth/ResetPasswordPage";
import { useMarketStore }       from "@/stores/market";
import { usePortfolioStore }    from "@/stores/portfolio";
import { useAuthStore }         from "@/stores/auth";

export default function App() {
  const { token, user, initialized, loadMe } = useAuthStore();
  
  const initWebSocket = useMarketStore(s => s.initWebSocket);
  const wsStatus      = useMarketStore(s => s.wsStatus);
  const fetchOrders   = usePortfolioStore(s => s.fetchOrders);

  // 1. Bootstrap auth: check token validity saat startup
  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // 2. Start WebSocket & Fetch data awal setelah authenticated
  useEffect(() => {
    if (!token || !user) return;
    
    initWebSocket();
    const { fetchSummary, fetchHoldings, fetchWatchlist } = usePortfolioStore.getState();
    const { fetchIndexData } = useMarketStore.getState();

    Promise.all([
      fetchSummary(), 
      fetchHoldings(), 
      fetchWatchlist(),
      fetchIndexData()
    ]);
  }, [token, user, initWebSocket]);

  // 3. Sync orders saat WS connected
  useEffect(() => {
    if (wsStatus === "connected") fetchOrders();
  }, [wsStatus, fetchOrders]);

  // ── Render ──────────────────────────────────────────────────────────────

  // Tunggu bootstrap auth selesai (untuk menghindari flash LoginPage)
  if (!initialized) {
    return (
      <div style={{ 
        width: "100vw", height: "100vh", background: "#040d1a", 
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#4a6080", fontFamily: "'Syne', sans-serif", fontSize: 12,
        letterSpacing: 2
      }}>
        INITIALIZING SESSION...
      </div>
    );
  }

  // Simple Router logic based on pathname
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  if (path === "/reset-password" || params.get("action") === "reset") {
    return <ResetPasswordPage />;
  }

  // Auth Guard
  if (!token || !user) {
    return <LoginPage />;
  }

  return (
    <>
      <IDXTerminal />
      <OrderTriggeredDialog />
    </>
  );
}
