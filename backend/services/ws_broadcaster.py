# services/ws_broadcaster.py
#
# Mengelola semua koneksi WebSocket aktif dan cache harga terakhir.
#
# Flow:
#   1. Client connect → kirim "snapshot" (seluruh cache saat ini)
#   2. DataFetcher dapat data baru → update_cache() + broadcast("update")
#   3. Client disconnect → hapus dari set, tidak ada leak
#
# Jika send ke client gagal (koneksi mati tiba-tiba), client
# langsung dikeluarkan dari set — tidak crash loop.
#
# FIX BUG-A: get_snapshot() sekarang return deep copy per-ticker.
#   Sebelumnya dict(self._cache) hanya shallow copy — caller bisa
#   secara tidak sengaja memutasi inner dict dan merusak cache harga.
#   Contoh bug: alert_checker memodifikasi nilai snapshot → harga
#   di cache berubah → broadcast berikutnya kirim harga yang salah.

import asyncio
import logging
from typing import TYPE_CHECKING

from fastapi import WebSocket, WebSocketDisconnect

if TYPE_CHECKING:
    from .data_fetcher import QuoteData

logger = logging.getLogger(__name__)


class WSBroadcaster:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._connections: set[WebSocket] = set()
        # cache: ticker → dict (output dari QuoteData.to_dict())
        self._cache: dict[str, dict] = {}

    # ── Cache ─────────────────────────────────────────────────────────────────

    def update_cache(self, data: "dict[str, QuoteData]") -> None:
        """
        Terima dict {ticker: QuoteData} dari DataFetcher, simpan ke cache.
        Dipanggil dari coroutine DataFetcher — tidak perlu lock karena
        GIL Python dan update_cache tidak yield.
        """
        for ticker, quote in data.items():
            self._cache[ticker] = quote.to_dict()

    def get_snapshot(self) -> dict:
        """
        Kembalikan seluruh cache sebagai dict (untuk snapshot awal client).

        FIX BUG-A: Return DEEP COPY per-ticker agar caller tidak bisa
        memutasi cache secara tidak sengaja.
        dict(self._cache) hanya shallow copy — nilai dict (inner dict)
        masih shared reference, sehingga:
          snap = broadcaster.get_snapshot()
          snap["BBCA.JK"]["price"] = 9999  ← ini juga mengubah self._cache!

        Solusi: copy setiap inner dict secara eksplisit.
        Tidak perlu copy.deepcopy penuh karena inner dict hanya berisi
        primitif (str, float, int, bool) — dict(v) sudah cukup.
        """
        return {ticker: dict(quote) for ticker, quote in self._cache.items()}

    # ── Connection management ─────────────────────────────────────────────────

    async def connect(self, ws: WebSocket) -> None:
        """
        Accept WebSocket baru, kirim snapshot, lalu tambah ke set.
        Panggil di awal WebSocket endpoint handler.
        """
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)
        logger.info(
            "WS client connected. Total: %d", len(self._connections)
        )
        # Kirim seluruh cache sekarang agar client tidak menunggu poll berikutnya
        if self._cache:
            await self._safe_send(ws, {
                "type": "snapshot",
                "data": self.get_snapshot(),
            })

    async def disconnect(self, ws: WebSocket) -> None:
        """Hapus koneksi dari set. Aman dipanggil berulang kali."""
        async with self._lock:
            self._connections.discard(ws)
        logger.info(
            "WS client disconnected. Total: %d", len(self._connections)
        )

    # ── Broadcast ─────────────────────────────────────────────────────────────

    async def broadcast(self, message: dict) -> None:
        """
        Kirim pesan ke semua client yang terhubung.
        Client yang gagal diterima (koneksi mati) langsung dibuang.
        """
        if not self._connections:
            return

        async with self._lock:
            targets = list(self._connections)

        dead: list[WebSocket] = []
        for ws in targets:
            ok = await self._safe_send(ws, message)
            if not ok:
                dead.append(ws)

        if dead:
            async with self._lock:
                for ws in dead:
                    self._connections.discard(ws)
            logger.debug("Removed %d dead WS connections", len(dead))

    async def _safe_send(self, ws: WebSocket, message: dict) -> bool:
        """
        Kirim JSON ke satu client. Kembalikan False jika gagal.
        Tidak raise — caller yang memutuskan apa yang dilakukan.
        """
        try:
            await ws.send_json(message)
            return True
        except WebSocketDisconnect:
            return False
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug("WS send error: %s", exc)
            return False

    # ── Stats ─────────────────────────────────────────────────────────────────

    @property
    def connection_count(self) -> int:
        return len(self._connections)

    @property
    def cached_tickers(self) -> list[str]:
        return sorted(self._cache.keys())