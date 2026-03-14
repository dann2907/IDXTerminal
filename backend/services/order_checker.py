# services/order_checker.py
#
# Background task yang memeriksa order ACTIVE setiap kali ada harga baru
# dari DataFetcher. Ketika harga menyentuh level TP atau SL:
#
#   1. Order diubah status → PENDING_CONFIRM di DB
#   2. Event "order_triggered" dikirim ke semua WS client
#   3. Frontend menampilkan dialog konfirmasi
#   4. User tekan "Eksekusi" → POST /api/portfolio/orders/{id}/confirm
#      User tekan "Abaikan"  → POST /api/portfolio/orders/{id}/dismiss
#
# Prioritas SL atas TP sama dengan portofolio.py asli:
# jika pada satu poll satu ticker punya TP dan SL keduanya terpicu,
# SL yang diproses duluan (untuk melindungi modal).
#
# Guard race condition: order yang sudah PENDING_CONFIRM tidak akan
# dipicu ulang karena query di get_active_orders_for_check() hanya
# mengambil status == "ACTIVE".

import asyncio
import logging
from typing import TYPE_CHECKING

from db.database import AsyncSessionLocal
from services.portfolio_service import PortfolioService

if TYPE_CHECKING:
    from services.ws_broadcaster import WSBroadcaster

logger = logging.getLogger(__name__)


class OrderChecker:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._lock = asyncio.Lock()

    def start(self, broadcaster: "WSBroadcaster") -> None:
        """
        Mulai checker. Dipanggil sekali saat app startup.
        broadcaster disimpan agar bisa dipakai setiap kali check dipanggil.
        """
        self._broadcaster = broadcaster
        logger.info("OrderChecker started (event-driven, triggered per price update)")

    async def check(self, prices: dict[str, float]) -> None:
        """
        Periksa semua order ACTIVE terhadap harga terbaru.
        Dipanggil oleh DataFetcher / WSBroadcaster setiap kali ada batch harga baru.
        Tidak perlu interval sendiri — ia ikut ritme DataFetcher.
        """
        if not prices:
            return
        async with self._lock:
            async with AsyncSessionLocal() as db:
                orders = await PortfolioService.get_active_orders_for_check(db)
                if not orders:
                    return

                # Kelompokkan per ticker, SL duluan dalam list
                by_ticker: dict[str, list] = {}
                for o in orders:
                    if o.ticker in prices:
                        by_ticker.setdefault(o.ticker, [])
                        # SL masuk di depan (prioritas lebih tinggi)
                        if o.order_type == "SL":
                            by_ticker[o.ticker].insert(0, o)
                        else:
                            by_ticker[o.ticker].append(o)

                for ticker, ticker_orders in by_ticker.items():
                    price = prices[ticker]
                    for order in ticker_orders:
                        triggered = (
                            order.order_type == "TP" and price >= order.trigger_price
                            or
                            order.order_type == "SL" and price <= order.trigger_price
                        )
                        if not triggered:
                            continue

                        # Set ke PENDING_CONFIRM
                        marked = await PortfolioService.mark_order_pending(
                            db, order.order_id, price
                        )
                        if not marked:
                            continue
                        logger.info(
                            "Order %s triggered: %s %s @ %.0f (trigger=%.0f)",
                            order.order_id, order.order_type, ticker,
                            price, order.trigger_price,
                        )

                        # Broadcast ke frontend untuk konfirmasi
                        symbol = "Rp" if ticker.endswith(".JK") else "$"
                        await self._broadcaster.broadcast({
                            "type": "order_triggered",
                            "data": {
                                "order_id": order.order_id,
                                "ticker": ticker,
                                "order_type": order.order_type,
                                "trigger_price": order.trigger_price,
                                "current_price": price,
                                "lots": order.lots,
                                "shares": order.shares,
                                "symbol": symbol,
                                "message": (
                                    f"{order.order_type} order untuk {ticker} terpicu! "
                                    f"Harga {symbol}{price:,.0f} menyentuh target "
                                    f"{symbol}{order.trigger_price:,.0f}. Eksekusi sekarang?"
                                ),
                            },
                        })

                        # Hanya proses satu order per ticker per poll
                        # (SL yang diprioritaskan sudah ada di posisi pertama list)
                        break
