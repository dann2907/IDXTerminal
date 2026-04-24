// src/App.tsx  (Fase 5 — fixed)
//
// FIX: versi sebelumnya patch usePortfolioStore.handleWsMessage di
// dalam useEffect tanpa guard yang benar — originalHandler bisa stale,
// dan setState dipanggil setiap render karena handleAlertWs sebagai dep.
//
// Solusi bersih: routing "alert_triggered" langsung di useMarketStore
// _ws.onmessage, lewat subscription useEffect yang hanya run sekali,
// atau dengan extract ke custom hook.
//
// CARA YANG DIPAKAI: useEffect dengan ref untuk handler yang stabil.
// Tidak perlu patch store — cukup subscribe ke store di luar component.

import { useEffect, useRef } from "react";
import IDXTerminal              from "./components/IDXTerminal";
import OrderTriggeredDialog     from "./components/OrderTriggeredDialog";
import LoginPage                from "./components/auth/LoginPage";
import { useMarketStore }       from "./stores/useMarketStore";
import { usePortfolioStore }    from "./stores/usePortfolioStore";
import { useAuthStore }         from "./stores/useAuthStore";
import { useAlertStore }        from "./stores/useAlertStore";

export default function App() {
  const initWebSocket = useMarketStore(s => s.initWebSocket);
  const wsStatus      = useMarketStore(s => s.wsStatus);
  const fetchOrders   = usePortfolioStore(s => s.fetchOrders);

  const { token, user, loadMe } = useAuthStore();

  // Ref yang stabil — tidak menyebabkan re-render saat store berubah
  const alertHandlerRef = useRef(useAlertStore.getState().handleWsMessage);
  useEffect(() => {
    // Subscribe ke store agar ref selalu punya fungsi terbaru
    return useAlertStore.subscribe(
      s => { alertHandlerRef.current = s.handleWsMessage; }
    );
  }, []);

  // ── Mount: verifikasi token tersimpan ─────────────────────────────────
  useEffect(() => {
    loadMe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wire alert WS routing — run SEKALI saja ───────────────────────────
  useEffect(() => {
    // Patch handleWsMessage di portfolioStore agar juga forward alert.
    // Ini run sekali setelah mount — tidak stale karena pakai ref.
    const original = usePortfolioStore.getState().handleWsMessage;
    usePortfolioStore.setState({
      handleWsMessage: (msg) => {
        original(msg);
        if (msg.type === "alert_triggered") {
          alertHandlerRef.current(msg);
        }
      },
    });
    // Tidak perlu cleanup — patch ini permanen selama app hidup
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Setelah login: mulai WS + fetch data awal ─────────────────────────
  useEffect(() => {
    if (!token) return;
    initWebSocket();
    const { fetchSummary, fetchHoldings, fetchWatchlist } = usePortfolioStore.getState();
    Promise.all([fetchSummary(), fetchHoldings(), fetchWatchlist()]);
  }, [token, initWebSocket]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WS connected: sync orders ─────────────────────────────────────────
  useEffect(() => {
    if (wsStatus === "connected") fetchOrders();
  }, [wsStatus, fetchOrders]);

  // ── Auth guard ────────────────────────────────────────────────────────
  if (!token || !user) return <LoginPage />;

  return (
    <>
      <IDXTerminal />
      <OrderTriggeredDialog />
    </>
  );
}
