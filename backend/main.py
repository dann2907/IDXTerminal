# main.py
#
# FastAPI app entry point — Fase 3 update.
# Startup order:
#   1. Buat tabel SQLite jika belum ada
#   2. Pastikan baris portfolio_meta ada (id=1)
#   3. Baca holdings + watchlist dari SQLite → sync ke TickerRegistry
#   4. Inisialisasi OrderChecker (event-driven, tidak punya loop sendiri)
#   5. Mulai DataFetcher polling loop
# Shutdown: hentikan DataFetcher dan TickerRegistry cleanup task.

import logging
import asyncio
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from db.database import AsyncSessionLocal, Base as DBBase, engine
from models.portfolio import Base as PortfolioBase, Holding, Watchlist
from routers import auth, market, portfolio
from routers.alerts import router as alerts_router
from routers.alerts import export_router
from services.data_fetcher import DataFetcher
from services.alert_checker import AlertChecker
from services.order_checker import OrderChecker
from services.portfolio_service import PortfolioService
from services.ticker_registry import TickerRegistry
from services.ws_broadcaster import WSBroadcaster

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


# ── Singletons ────────────────────────────────────────────────────────────────

registry    = TickerRegistry()
broadcaster = WSBroadcaster()
fetcher     = DataFetcher()
order_checker = OrderChecker()
alert_checker = AlertChecker()


# ── Startup helpers ───────────────────────────────────────────────────────────

async def _init_db() -> None:
    """Buat semua tabel jika belum ada. Idempoten."""
    import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(PortfolioBase.metadata.create_all)
        await conn.run_sync(DBBase.metadata.create_all)
    logger.info("Database tables ready")


async def _load_tickers_from_db() -> tuple[list[str], list[str]]:
    """
    Baca holdings dan watchlist dari SQLite.
    Dipakai untuk sync awal ke TickerRegistry saat startup.
    """
    async with AsyncSessionLocal() as db:
        # Pastikan baris portfolio_meta ada
        await PortfolioService.ensure_meta(db)

        h_result = await db.execute(select(Holding))
        holdings = [str(h.ticker) for h in h_result.scalars().all()]

        w_result = await db.execute(
            select(Watchlist).order_by(Watchlist.display_order)
        )
        watchlist = [str(w.ticker) for w in w_result.scalars().all()]

    logger.info(
        "Loaded from SQLite — holdings: %d, watchlist: %d",
        len(holdings), len(watchlist),
    )
    return holdings, watchlist


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ANN001
    # ── Startup ──────────────────────────────────────────────────────────────
    await _init_db()

    holdings, watchlist = await _load_tickers_from_db()
    await registry.sync_holdings(holdings)
    await registry.sync_watchlist(watchlist)
    registry.start_cleanup()

    # Wire singletons ke routers
    market.set_singletons(registry, broadcaster)
    portfolio.set_broadcaster(broadcaster)

    # OrderChecker tidak punya loop sendiri — ia di-trigger oleh DataFetcher
    # lewat callback yang di-inject ke broadcaster.
    order_checker.start(broadcaster)
    alert_checker.start(broadcaster)
    # Patch broadcaster agar memanggil order_checker.check() setelah setiap update
    _patch_broadcaster_with_order_check()

    await fetcher.start(registry, broadcaster)
    logger.info("IDX Terminal backend ready ✅")

    yield  # ── app berjalan ──

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("Shutting down...")
    await fetcher.stop()
    await registry.stop()


def _patch_broadcaster_with_order_check() -> None:
    """
    Wrap broadcaster.update_cache() agar setiap kali harga baru masuk,
    order_checker.check() dipanggil dengan snapshot harga terbaru.
    FIX B2: Tambah error handler + done_callback agar exception tidak
    ditelan diam-diam.
    """
    original_update = broadcaster.update_cache

    def _on_task_done(task: asyncio.Task) -> None:
        if task.cancelled():
            return
        exc = task.exception()
        if exc:
            logger.error(
                "OrderChecker background task failed: %s",
                exc,
                exc_info=exc,
            )

    def patched_update(data) -> None:  # noqa: ANN001
        original_update(data)

        async def _safe_check() -> None:
            try:
                snapshot = broadcaster.get_snapshot()
                prices = {
                    ticker: float(q["price"])
                    for ticker, q in snapshot.items()
                }
                await order_checker.check(prices)
                await alert_checker.check(snapshot)
            except Exception as exc:  # pylint: disable=broad-except
                logger.error(
                    "OrderChecker.check() raised: %s",
                    exc,
                    exc_info=True,
                )

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            logger.warning("OrderChecker: no running event loop, skipping check")
            return

        task = loop.create_task(_safe_check())
        task.add_done_callback(_on_task_done)

    broadcaster.update_cache = patched_update


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="IDX Terminal API", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "tauri://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market.router)
app.include_router(portfolio.router)
app.include_router(auth.router)
app.include_router(alerts_router)
app.include_router(export_router)


@app.get("/health")
async def health() -> dict:
    snap = await registry.snapshot()
    return {
        "status": "ok",
        "version": "3.0.0",
        "ws_connections": broadcaster.connection_count,
        "cached_tickers": len(broadcaster.cached_tickers),
        "registry": snap,
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8765,
        reload=False,
        log_level="info",
    )
