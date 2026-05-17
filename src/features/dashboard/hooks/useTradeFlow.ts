import { useState, useCallback, useEffect, useRef } from "react";
import { usePortfolioStore } from "@/stores/portfolio";
import { QuoteData, Holding, PortfolioSummary } from "../../../types";

interface TradeMessage {
  ok: boolean;
  message: string;
}

interface ConfirmPayload {
  action: "BUY" | "SELL";
  ticker: string;
  lots: number;
  price: number;
  avgCost: number | undefined;
  currentCash: number | undefined;
}

export function useTradeFlow(
  selectedTicker: string, 
  quotes: Record<string, QuoteData>, 
  holdings: Holding[], 
  summary: PortfolioSummary | null
) {
  const buy  = usePortfolioStore(s => s.buy);
  const sell = usePortfolioStore(s => s.sell);

  const [action, setAction]               = useState<"BUY" | "SELL">("BUY");
  const [lots, setLots]                   = useState("");
  const [message, setMessage]             = useState<TradeMessage | null>(null);
  const [confirmPayload, setConfirmPayload] = useState<ConfirmPayload | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto‑clear success messages after 6s
  useEffect(() => {
    if (message?.ok) {
      msgTimerRef.current = setTimeout(() => setMessage(null), 6000);
      return () => {
        if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
      };
    }
  }, [message]);

  // Buka dialog konfirmasi — TIDAK langsung eksekusi
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
      ticker:      selectedTicker,
      lots:        lotNum,
      price,
      avgCost:     holdings.find(h => h.ticker === selectedTicker)?.avg_cost,
      currentCash: summary?.cash,
    });
  }, [lots, action, selectedTicker, quotes, holdings, summary]);

  // Dipanggil saat user klik "Konfirmasi" di TradeConfirmDialog
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
