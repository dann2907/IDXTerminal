import { useState, useCallback, useRef, useEffect } from "react";
import { useMarketStore } from "../../../stores/useMarketStore";
import { WatchlistCategory } from "../../../types";

export function useWatchlistManager() {
  const { quotes } = useMarketStore();
  const [categories, setCategories] = useState<WatchlistCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [tickerInput, setTickerInput] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mock initial load - normally from backend
  useEffect(() => {
    // In actual app, fetch from /api/portfolio/watchlist
    const initial: WatchlistCategory[] = [
      { 
        id: 1, 
        name: "Default", 
        is_default: true, 
        tickers: [
          { ticker: "BBCA.JK", price: null },
          { ticker: "TLKM.JK", price: null },
          { ticker: "ASII.JK", price: null }
        ] 
      }
    ];
    setCategories(initial);
    setActiveCategoryId(1);
  }, []);

  // Auto-clear message
  useEffect(() => {
    if (message?.ok && msgTimerRef.current === null) {
      msgTimerRef.current = setTimeout(() => {
        setMessage(null);
        msgTimerRef.current = null;
      }, 5000);
    }
    return () => {
      if (msgTimerRef.current) {
        clearTimeout(msgTimerRef.current);
        msgTimerRef.current = null;
      }
    };
  }, [message]);

  const activeCategory = categories.find(c => c.id === activeCategoryId) || null;
  const activeTickers = activeCategory?.tickers.map(t => t.ticker) || [];

  const handleSetActiveId = (id: number) => setActiveCategoryId(id);

  const isTickerInActive = useCallback((ticker: string) => {
    return activeTickers.includes(ticker);
  }, [activeTickers]);

  const toggleSelected = useCallback(async (ticker: string) => {
    if (!activeCategoryId) return;
    // Mock API call
    const res = { ok: true, message: `Ticker ${ticker} updated` };
    setMessage(res);
  }, [activeCategoryId]);

  const handleCreateNew = async () => {
    if (!newName.trim()) return;
    const res = { ok: true, message: "Kategori dibuat", category: { id: Date.now(), name: newName, is_default: false, tickers: [] } };
    setMessage(res);
    setCategories([...categories, res.category]);
    setActiveCategoryId(res.category.id);
    setNewName("");
  };

  const handleRenameActive = async () => {
    if (!activeCategory || !newName.trim()) return;
    const updated = categories.map(c => c.id === activeCategoryId ? { ...c, name: newName } : c);
    setCategories(updated);
    setMessage({ ok: true, message: "Kategori diubah" });
    setNewName("");
  };

  const handleDeleteActive = async () => {
    if (!activeCategory || activeCategory.is_default) return;
    const filtered = categories.filter(c => c.id !== activeCategoryId);
    setCategories(filtered);
    setActiveCategoryId(filtered[0]?.id || null);
    setMessage({ ok: true, message: "Kategori dihapus" });
  };

  const handleManualAdd = async () => {
    if (!activeCategoryId || !tickerInput.trim()) return;
    const tickerStr = tickerInput.trim().toUpperCase().endsWith(".JK") ? tickerInput.trim().toUpperCase() : `${tickerInput.trim().toUpperCase()}.JK`;
    const res = { ok: true, message: "Ticker ditambahkan" };
    setMessage(res);
    const updated = categories.map(c => c.id === activeCategoryId ? { ...c, tickers: [...c.tickers, { ticker: tickerStr, price: null }] } : c);
    setCategories(updated);
    setTickerInput("");
  };

  const handleRemoveTicker = useCallback(async (ticker: string) => {
    if (!activeCategoryId) return;
    const res = { ok: true, message: "Ticker dihapus" };
    setMessage(res);
    const updated = categories.map(c => c.id === activeCategoryId ? { ...c, tickers: c.tickers.filter(t => t.ticker !== ticker) } : c);
    setCategories(updated);
  }, [activeCategoryId]);

  return {
    categories,
    active: activeCategory,
    activeTickers,
    setActiveId: handleSetActiveId,
    newName,
    setNewName,
    createNew: handleCreateNew,
    renameActive: handleRenameActive,
    deleteActive: handleDeleteActive,
    tickerInput,
    setTickerInput,
    manualAdd: handleManualAdd,
    removeTicker: handleRemoveTicker,
    msg: message,
    toggleSelected,
  };
}
