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
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from db.database import AsyncSessionLocal, engine
from models.portfolio import Base, Holding, Watchlist
from routers import alerts, auth, market, portfolio
from services.data_fetcher import DataFetcher
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


# ── Startup helpers ───────────────────────────────────────────────────────────

async def _init_db() -> None:
    """Buat semua tabel jika belum ada. Idempoten."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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

    Ini lebih sederhana dari event bus penuh — cukup untuk single-user app.
    Tidak mengubah interface WSBroadcaster agar mudah di-test.
    """
    original_update = broadcaster.update_cache

    def patched_update(data):  # noqa: ANN001
        original_update(data)
        # Jadwalkan pengecekan order — jangan await di sini karena
        # update_cache bukan coroutine. Gunakan create_task.
        import asyncio  # noqa: PLC0415
        prices = {t: q.price for t, q in data.items()}
        asyncio.create_task(order_checker.check(prices))

    broadcaster.update_cache = patched_update  # type: ignore[method-assign]


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
app.include_router(alerts.router)


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