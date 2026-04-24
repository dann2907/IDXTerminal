// src/components/IDXTerminal/hooks/useTradeFlow.js
import { useState, useCallback, useEffect, useRef } from "react";
import { usePortfolioStore } from "../../stores/usePortfolioStore";

export function useTradeFlow(selectedTicker, quotes, holdings, summary) {
  const buy  = usePortfolioStore(s => s.buy);
  const sell = usePortfolioStore(s => s.sell);

  const [action, setAction]        = useState("BUY");
  const [lots, setLots]            = useState("");
  const [message, setMessage]      = useState(null);
  const [confirmPayload, setConfirmPayload] = useState(null);
  const msgTimerRef = useRef(null);

  // Auto‑clear success messages after 6s
  useEffect(() => {
    if (message?.ok) {
      msgTimerRef.current = setTimeout(() => setMessage(null), 6000);
      return () => clearTimeout(msgTimerRef.current);
    }
  }, [message]);

  // Build confirm payload
  const handleOpenConfirm = useCallback(() => {
    const lotNum = parseInt(lots, 10);
    if (!lotNum || lotNum <= 0) return;
    const price = quotes[selectedTicker]?.price;
    if (!price) {
      setMessage({ ok: false, message: "Harga belum tersedia — tunggu data live" });
      return;
    }
    setConfirmPayload({
      action,
      ticker: selectedTicker,
      lots: lotNum,
      price,
      avgCost: holdings.find(h => h.ticker === selectedTicker)?.avg_cost,
      currentCash: summary?.cash,
    });
  }, [lots, action, selectedTicker, quotes, holdings, summary]);

  // Executed when user confirms
  const handleConfirm = useCallback(async () => {
    if (!confirmPayload) return;
    const { action: act, ticker, lots: lotNum, price } = confirmPayload;
    const fn = act === "BUY" ? buy : sell;
    const res = await fn(ticker, lotNum, price);
    setMessage(res);
    if (res.ok) setLots("");
    setConfirmPayload(null);
  }, [confirmPayload, buy, sell]);

  const cancelConfirm = useCallback(() => setConfirmPayload(null), []);

  return {
    action,
    setAction,
    lots,
    setLots,
    message,
    setMessage,
    confirmPayload,
    handleOpenConfirm,
    handleConfirm,
    cancelConfirm,
  };
}