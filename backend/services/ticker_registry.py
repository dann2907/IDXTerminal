# services/ticker_registry.py
#
# Mengelola tiga tier ticker yang di-track oleh DataFetcher:
#   1. holdings   — permanent (dari DB / portfolio aktif)
#   2. watchlist  — permanent (dari DB / watchlist user)
#   3. search_temp — TTL 5 menit (dari search manual di UI)
#
# search_temp otomatis dihapus setelah SEARCH_TTL detik tidak ada aktivitas.
# Jika ticker search_temp akhirnya dibeli / dimasukan ke watchlist,
# panggil promote() agar TTL-nya dicabut dan ticker tetap di-track.
#
# Thread-safety: semua mutasi pakai asyncio.Lock.

import asyncio
import logging
import time
from typing import Literal

logger = logging.getLogger(__name__)

SEARCH_TTL = 300  # 5 menit dalam detik
CLEANUP_INTERVAL = 30  # periksa expired setiap 30 detik

Tier = Literal["holdings", "watchlist", "search_temp"]


class TickerRegistry:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._holdings: set[str] = set()
        self._watchlist: set[str] = set()
        # ticker -> unix timestamp kapan expired
        self._search_temp: dict[str, float] = {}
        self._cleanup_task: asyncio.Task | None = None

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def start_cleanup(self) -> None:
        """Jalankan background task pembersih search_temp yang expired."""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop(self) -> None:
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

    # ── Sync dari DB / portfolio ──────────────────────────────────────────────

    async def sync_holdings(self, tickers: list[str]) -> None:
        """Ganti seluruh set holdings. Dipanggil saat boot dan setelah trade."""
        normalized = {_normalize(t) for t in tickers if t}
        async with self._lock:
            self._holdings = normalized
            # Promosikan search_temp yang ternyata sudah ada di holdings
            for t in normalized:
                self._search_temp.pop(t, None)
        logger.debug("Holdings synced: %s", self._holdings)

    async def sync_watchlist(self, tickers: list[str]) -> None:
        """Ganti seluruh set watchlist."""
        normalized = {_normalize(t) for t in tickers if t}
        async with self._lock:
            self._watchlist = normalized
            for t in normalized:
                self._search_temp.pop(t, None)
        logger.debug("Watchlist synced: %s", self._watchlist)

    # ── Search temp ───────────────────────────────────────────────────────────

    async def add_search(self, ticker: str) -> None:
        """
        Daftarkan ticker dari hasil search UI.
        Jika sudah ada di holdings/watchlist, tidak perlu TTL.
        Jika sudah di search_temp, TTL di-refresh.
        """
        t = _normalize(ticker)
        async with self._lock:
            if t in self._holdings or t in self._watchlist:
                return  # sudah permanent, tidak perlu TTL
            self._search_temp[t] = time.monotonic() + SEARCH_TTL
            logger.debug("Search temp registered: %s (TTL %ds)", t, SEARCH_TTL)

    async def refresh_search(self, ticker: str) -> None:
        """
        Perpanjang TTL ticker search_temp (dipanggil saat user aktif view chart).
        No-op jika ticker sudah permanent atau tidak ada di search_temp.
        """
        t = _normalize(ticker)
        async with self._lock:
            if t in self._search_temp:
                self._search_temp[t] = time.monotonic() + SEARCH_TTL

    async def promote(self, ticker: str, to: Tier) -> None:
        """
        Angkat ticker dari search_temp ke tier permanen (holdings/watchlist).
        Dipanggil setelah user buy atau add-to-watchlist.
        """
        t = _normalize(ticker)
        async with self._lock:
            self._search_temp.pop(t, None)
            if to == "holdings":
                self._holdings.add(t)
            elif to == "watchlist":
                self._watchlist.add(t)
        logger.info("Promoted %s → %s", t, to)

    async def remove(self, ticker: str, from_tier: Tier) -> None:
        """Hapus ticker dari tier tertentu (misal saat user hapus dari watchlist)."""
        t = _normalize(ticker)
        async with self._lock:
            if from_tier == "holdings":
                self._holdings.discard(t)
            elif from_tier == "watchlist":
                self._watchlist.discard(t)
            elif from_tier == "search_temp":
                self._search_temp.pop(t, None)

    # ── Query ─────────────────────────────────────────────────────────────────

    async def get_all(self) -> set[str]:
        """
        Kembalikan semua ticker yang harus di-poll sekarang.
        Gabungan holdings + watchlist + search_temp yang belum expired.
        """
        now = time.monotonic()
        async with self._lock:
            temp_active = {t for t, exp in self._search_temp.items() if exp > now}
            return self._holdings | self._watchlist | temp_active

    async def snapshot(self) -> dict:
        """Kembalikan state lengkap (untuk debug / health endpoint)."""
        now = time.monotonic()
        async with self._lock:
            return {
                "holdings": sorted(self._holdings),
                "watchlist": sorted(self._watchlist),
                "search_temp": {
                    t: round(exp - now, 1)
                    for t, exp in self._search_temp.items()
                    if exp > now
                },
            }

    # ── Cleanup loop ──────────────────────────────────────────────────────────

    async def _cleanup_loop(self) -> None:
        logger.info("TickerRegistry cleanup task started")
        while True:
            try:
                await asyncio.sleep(CLEANUP_INTERVAL)
                await self._cleanup_expired()
            except asyncio.CancelledError:
                logger.info("TickerRegistry cleanup task stopped")
                return
            except Exception as exc:  # pylint: disable=broad-except
                logger.error("Cleanup error: %s", exc)

    async def _cleanup_expired(self) -> None:
        now = time.monotonic()
        async with self._lock:
            expired = [t for t, exp in self._search_temp.items() if exp <= now]
            for t in expired:
                del self._search_temp[t]
        if expired:
            logger.info("Search temp expired and removed: %s", expired)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalize(ticker: str) -> str:
    """'bbca' → 'BBCA.JK',  'BBCA.JK' → 'BBCA.JK',  'BBCA' → 'BBCA.JK'"""
    t = ticker.strip().upper()
    if not t.endswith(".JK"):
        t += ".JK"
    return t
