# main.py
#
# FastAPI app entry point.
# Startup: inisialisasi TickerRegistry, DataFetcher, WSBroadcaster,
#          muat ticker dari portofolio.txt (jika ada).
# Shutdown: hentikan semua background tasks dengan bersih.

import json
import logging
import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import alerts, auth, market, portfolio
from services.data_fetcher import DataFetcher
from services.ticker_registry import TickerRegistry
from services.ws_broadcaster import WSBroadcaster

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ── Lokasi data portofolio (warisan dari PyQt6 app) ────────────────────────────
_PORTFOLIO_FILE = os.path.join(os.path.dirname(__file__), "..", "portfolio_data.json")


def _load_portfolio_tickers() -> tuple[list[str], list[str]]:
    """
    Baca holdings dan watchlist dari portfolio_data.json (format lama).
    Kembalikan (holdings_tickers, watchlist_tickers) sebagai list.
    Kembalikan ([], []) jika file tidak ada atau rusak.
    """
    path = os.path.abspath(_PORTFOLIO_FILE)
    if not os.path.exists(path):
        logger.info("portfolio_data.json tidak ditemukan, mulai dengan ticker kosong")
        return [], []
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        holdings = list(data.get("holdings", {}).keys())
        watchlist = data.get("watchlist", [])
        logger.info(
            "Loaded from portfolio_data.json — holdings: %d, watchlist: %d",
            len(holdings), len(watchlist),
        )
        return holdings, watchlist
    except (OSError, json.JSONDecodeError) as exc:
        logger.error("Gagal baca portfolio_data.json: %s", exc)
        return [], []


# ── Singletons ────────────────────────────────────────────────────────────────

registry = TickerRegistry()
broadcaster = WSBroadcaster()
fetcher = DataFetcher()


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ANN001
    # ── Startup ──
    holdings, watchlist = _load_portfolio_tickers()
    await registry.sync_holdings(holdings)
    await registry.sync_watchlist(watchlist)
    registry.start_cleanup()

    market.set_singletons(registry, broadcaster)

    await fetcher.start(registry, broadcaster)
    logger.info("IDX Terminal backend ready")

    yield  # app berjalan di sini

    # ── Shutdown ──
    logger.info("Shutting down...")
    await fetcher.stop()
    await registry.stop()


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="IDX Terminal API", version="2.0.0", lifespan=lifespan)

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
    return {
        "status": "ok",
        "ws_connections": broadcaster.connection_count,
        "cached_tickers": len(broadcaster.cached_tickers),
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8765,
        reload=False,        # reload=True hanya untuk dev tanpa Tauri
        log_level="info",
    )