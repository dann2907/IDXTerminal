// src/components/IDXTerminal/hooks/useWatchlistManager.js
//
// FIX: import path usePortfolioStore diperbaiki dari
//   "../../stores/usePortfolioStore" → "../../../stores/usePortfolioStore"
//   (hooks/ ada di dalam IDXTerminal/, satu level lebih dalam dari components/)

import { useState, useEffect, useCallback, useRef } from "react";
import { usePortfolioStore } from "../../../stores/usePortfolioStore";

export function useWatchlistManager() {
  const watchlistCategories   = usePortfolioStore(s => s.watchlistCategories);
  const addToWatchlist        = usePortfolioStore(s => s.addToWatchlist);
  const removeFromWatchlist   = usePortfolioStore(s => s.removeFromWatchlist);
  const createCategory        = usePortfolioStore(s => s.createWatchlistCategory);
  const renameCategory        = usePortfolioStore(s => s.renameWatchlistCategory);
  const deleteCategory        = usePortfolioStore(s => s.deleteWatchlistCategory);

  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [message, setMessage]                   = useState(null);
  const [newCategoryName, setNewCategoryName]   = useState("");
  const [tickerInput, setTickerInput]           = useState("");
  const msgTimerRef = useRef(null);

  // Auto‑clear success messages
  useEffect(() => {
    if (message?.ok && msgTimerRef.current === null) {
      msgTimerRef.current = setTimeout(() => {
        setMessage(null);
        msgTimerRef.current = null;
      }, 4000);
      return () => {
        clearTimeout(msgTimerRef.current);
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
    if (!watchlistCategories.some(c => c.id === activeCategoryId)) {
      setActiveCategoryId(watchlistCategories[0].id);
    }
  }, [watchlistCategories, activeCategoryId]);

  const activeCategory  = watchlistCategories.find(c => c.id === activeCategoryId) || watchlistCategories[0] || null;
  const activeTickers   = activeCategory ? activeCategory.tickers.map(item => item.ticker) : [];
  const activeCategoryIdResolved = activeCategory?.id ?? null;

  const isTickerInActive = useCallback((ticker) => {
    return activeTickers.includes(ticker);
  }, [activeTickers]);

  const toggleSelected = useCallback((ticker) => {
    return async () => {
      if (!activeCategory) return;
      if (isTickerInActive(ticker)) {
        const res = await removeFromWatchlist(ticker, activeCategory.id);
        setMessage(res);
      } else {
        const res = await addToWatchlist(ticker, activeCategory.id);
        setMessage(res);
      }
    };
  }, [activeCategory, isTickerInActive, addToWatchlist, removeFromWatchlist]);

  const handleCreateCategory = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const res = await createCategory(name);
    setMessage(res);
    if (res.ok && res.category) {
      setActiveCategoryId(res.category.id);
      setNewCategoryName("");
    }
  }, [createCategory, newCategoryName]);

  const handleManualAdd = useCallback(async () => {
    if (!activeCategory) return;
    const ticker = tickerInput.trim();
    if (!ticker) return;
    const res = await addToWatchlist(ticker, activeCategory.id);
    setMessage(res);
    if (res.ok) setTickerInput("");
  }, [activeCategory, addToWatchlist, tickerInput]);

  const handleRename = useCallback(async () => {
    if (!activeCategory) return;
    const next = window.prompt("Nama baru watchlist:", activeCategory.name);
    if (!next || next.trim() === activeCategory.name) return;
    const res = await renameCategory(activeCategory.id, next);
    setMessage(res);
  }, [activeCategory, renameCategory]);

  const handleDelete = useCallback(async () => {
    if (!activeCategory || activeCategory.is_default) return;
    if (!window.confirm(`Hapus watchlist "${activeCategory.name}"?`)) return;
    const res = await deleteCategory(activeCategory.id);
    setMessage(res);
  }, [activeCategory, deleteCategory]);

  const handleRemoveTicker = useCallback(async (ticker) => {
    if (!activeCategory) return;
    const res = await removeFromWatchlist(ticker, activeCategory.id);
    setMessage(res);
  }, [activeCategory, removeFromWatchlist]);

  return {
    // Data
    categories:        watchlistCategories,
    activeCategoryId:  activeCategoryIdResolved,
    activeCategory,
    activeTickers,

    // Setters
    setActiveCategoryId,

    // Queries
    isTickerInActive,
    toggleSelected,

    // State
    msg:              message,
    setMsg:           setMessage,
    newName:          newCategoryName,
    setNewName:       setNewCategoryName,
    tickerInput,
    setTickerInput,

    // Actions
    createNew:        handleCreateCategory,
    manualAdd:        handleManualAdd,
    renameActive:     handleRename,
    deleteActive:     handleDelete,
    removeTicker:     handleRemoveTicker,
  };
}