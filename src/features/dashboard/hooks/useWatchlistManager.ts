import { useState, useCallback, useRef, useEffect } from "react";
import { usePortfolioStore } from "@/stores/portfolio";

export function useWatchlistManager() {
  const watchlistCategories   = usePortfolioStore(s => s.watchlistCategories);
  const addToWatchlist        = usePortfolioStore(s => s.addToWatchlist);
  const removeFromWatchlist   = usePortfolioStore(s => s.removeFromWatchlist);
  const createCategory        = usePortfolioStore(s => s.createWatchlistCategory);
  const renameCategory        = usePortfolioStore(s => s.renameWatchlistCategory);
  const deleteCategory        = usePortfolioStore(s => s.deleteWatchlistCategory);

  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [message, setMessage]                   = useState<{ ok: boolean; message: string } | null>(null);
  const [newCategoryName, setNewCategoryName]   = useState("");
  const [tickerInput, setTickerInput]           = useState("");
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto‑clear success messages
  useEffect(() => {
    if (message?.ok && msgTimerRef.current === null) {
      msgTimerRef.current = setTimeout(() => {
        setMessage(null);
        msgTimerRef.current = null;
      }, 4000);
      return () => {
        if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
        msgTimerRef.current = null;
      };
    }
  }, [message]);

  // Ensure activeCategoryId is valid when categories change
  useEffect(() => {
    if (!watchlistCategories.length) {
      setActiveCategoryId(null);
      return;
    }
    if (activeCategoryId === null || !watchlistCategories.some(c => c.id === activeCategoryId)) {
      setActiveCategoryId(watchlistCategories[0].id);
    }
  }, [watchlistCategories, activeCategoryId]);

  const activeCategory  = watchlistCategories.find(c => c.id === activeCategoryId) || watchlistCategories[0] || null;
  const activeTickers   = activeCategory ? activeCategory.tickers.map(item => item.ticker) : [];
  const activeCategoryIdResolved = activeCategory?.id ?? null;

  const isTickerInActive = useCallback((ticker: string) => {
    return activeTickers.includes(ticker);
  }, [activeTickers]);

  const toggleSelected = useCallback(async (ticker: string) => {
    if (!activeCategory) return;
    if (isTickerInActive(ticker)) {
      const res = await removeFromWatchlist(ticker, activeCategory.id);
      setMessage(res);
    } else {
      const res = await addToWatchlist(ticker, activeCategory.id);
      setMessage(res);
    }
  }, [activeCategory, isTickerInActive, addToWatchlist, removeFromWatchlist]);

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const res = await createCategory(name);
    setMessage(res);
    if (res.ok && res.category) {
      setActiveCategoryId(res.category.id);
      setNewCategoryName("");
    }
  };

  const handleManualAdd = async () => {
    if (!activeCategory) return;
    const ticker = tickerInput.trim();
    if (!ticker) return;
    const res = await addToWatchlist(ticker, activeCategory.id);
    setMessage(res);
    if (res.ok) setTickerInput("");
  };

  const handleRename = async () => {
    if (!activeCategory) return;
    const next = window.prompt("Nama baru watchlist:", activeCategory.name);
    if (!next || next.trim() === activeCategory.name) return;
    const res = await renameCategory(activeCategory.id, next);
    setMessage(res);
  };

  const handleDelete = async () => {
    if (!activeCategory || activeCategory.is_default) return;
    if (!window.confirm(`Hapus watchlist "${activeCategory.name}"?`)) return;
    const res = await deleteCategory(activeCategory.id);
    setMessage(res);
  };

  const handleRemoveTicker = useCallback(async (ticker: string) => {
    if (!activeCategory) return;
    const res = await removeFromWatchlist(ticker, activeCategory.id);
    setMessage(res);
  }, [activeCategory, removeFromWatchlist]);

  return {
    categories:        watchlistCategories,
    active:           activeCategory,
    activeTickers,
    setActiveId:      setActiveCategoryId,
    newName:          newCategoryName,
    setNewName:       setNewCategoryName,
    createNew:        handleCreateCategory,
    renameActive:     handleRename,
    deleteActive:     handleDelete,
    tickerInput,
    setTickerInput,
    manualAdd:        handleManualAdd,
    removeTicker:     handleRemoveTicker,
    msg:              message,
    toggleSelected,
  };
}
