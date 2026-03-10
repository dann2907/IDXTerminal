# routers/portfolio.py
#
# REST endpoints untuk operasi portofolio.
#
# Semua endpoint menerima harga terkini dari WSBroadcaster cache
# (bukan query ke IDX/yfinance ulang) agar response cepat.
#
# Endpoint list:
#   GET  /api/portfolio/summary
#   GET  /api/portfolio/holdings
#   POST /api/portfolio/buy
#   POST /api/portfolio/sell
#   GET  /api/portfolio/history
#   GET  /api/portfolio/performance
#   GET  /api/portfolio/orders
#   POST /api/portfolio/orders
#   POST /api/portfolio/orders/{order_id}/confirm
#   POST /api/portfolio/orders/{order_id}/dismiss
#   DELETE /api/portfolio/orders/{order_id}
#   GET  /api/portfolio/watchlist
#   POST /api/portfolio/watchlist
#   DELETE /api/portfolio/watchlist/{ticker}

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from db.database import AsyncSessionLocal
from services.portfolio_service import PortfolioService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

# ── Broadcaster injector (di-set oleh main.py) ────────────────────────────────
_broadcaster = None  # WSBroadcaster


def set_broadcaster(broadcaster) -> None:  # noqa: ANN001
    global _broadcaster  # noqa: PLW0603
    _broadcaster = broadcaster


def _current_prices() -> dict[str, float]:
    """Ambil snapshot harga dari cache broadcaster."""
    if _broadcaster is None:
        return {}
    snap = _broadcaster.get_snapshot()
    return {ticker: float(data["price"]) for ticker, data in snap.items()}


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class BuyRequest(BaseModel):
    ticker: str
    lots: int = Field(..., gt=0, description="Jumlah lot (IDX: 1 lot = 100 lembar)")
    price: float = Field(..., gt=0)

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        v = v.upper().strip()
        if not v.endswith(".JK"):
            v += ".JK"
        return v


class SellRequest(BaseModel):
    ticker: str
    lots: int = Field(..., gt=0)
    price: float = Field(..., gt=0)

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        v = v.upper().strip()
        if not v.endswith(".JK"):
            v += ".JK"
        return v


class OrderRequest(BaseModel):
    ticker: str
    order_type: str = Field(..., pattern=r"^(TP|SL|tp|sl)$")
    trigger_price: float = Field(..., gt=0)
    lots: int = Field(..., gt=0)

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        v = v.upper().strip()
        if not v.endswith(".JK"):
            v += ".JK"
        return v

    @field_validator("order_type")
    @classmethod
    def normalize_type(cls, v: str) -> str:
        return v.upper()


class WatchlistRequest(BaseModel):
    ticker: str

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        v = v.upper().strip()
        if not v.endswith(".JK"):
            v += ".JK"
        return v


class ConfirmOrderRequest(BaseModel):
    price: float = Field(..., gt=0, description="Harga eksekusi aktual")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/summary")
async def get_summary() -> JSONResponse:
    """Kas, total nilai portfolio, floating P&L, realized P&L."""
    prices = _current_prices()
    async with AsyncSessionLocal() as db:
        data = await PortfolioService.get_summary(db, prices)
    return JSONResponse(data)


@router.get("/holdings")
async def get_holdings() -> JSONResponse:
    """Semua saham yang dipegang saat ini dengan P&L per posisi."""
    prices = _current_prices()
    async with AsyncSessionLocal() as db:
        data = await PortfolioService.get_holdings(db, prices)
    return JSONResponse(data)


@router.post("/buy")
async def buy(req: BuyRequest) -> JSONResponse:
    """
    Beli saham. Price dikirim dari frontend (user bisa override dari harga live).
    Jika price tidak dikirim di body, ambil dari cache broadcaster.
    """
    async with AsyncSessionLocal() as db:
        ok, msg = await PortfolioService.buy(db, req.ticker, req.lots, req.price)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    # Setelah buy, sync holdings ke TickerRegistry agar harga ticker ini di-track
    await _sync_registry_after_trade()
    return JSONResponse({"ok": True, "message": msg})


@router.post("/sell")
async def sell(req: SellRequest) -> JSONResponse:
    """Jual saham."""
    async with AsyncSessionLocal() as db:
        ok, msg = await PortfolioService.sell(db, req.ticker, req.lots, req.price)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    await _sync_registry_after_trade()
    return JSONResponse({"ok": True, "message": msg})


@router.get("/history")
async def get_history(
    ticker: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
) -> JSONResponse:
    """Riwayat transaksi. Filter optional per ticker."""
    async with AsyncSessionLocal() as db:
        data = await PortfolioService.get_history(db, ticker=ticker, limit=limit)
    return JSONResponse(data)


@router.get("/performance")
async def get_performance(
    period: str = Query("all", pattern=r"^(day|week|month|all)$")
) -> JSONResponse:
    """Metrik performa: P&L per ticker, win rate, best/worst trade."""
    prices = _current_prices()
    async with AsyncSessionLocal() as db:
        data = await PortfolioService.get_performance(db, prices, period=period)
    return JSONResponse(data)


@router.get("/orders")
async def get_orders(
    ticker: Optional[str] = Query(None),
    status: Optional[str] = Query(None, pattern=r"^(ACTIVE|PENDING_CONFIRM|EXECUTED|CANCELLED)$"),
) -> JSONResponse:
    """Daftar order TP/SL. Filter optional per ticker dan status."""
    async with AsyncSessionLocal() as db:
        data = await PortfolioService.get_orders(db, ticker=ticker, status=status)
    return JSONResponse(data)


@router.post("/orders")
async def add_order(req: OrderRequest) -> JSONResponse:
    """Pasang order TP atau SL baru."""
    async with AsyncSessionLocal() as db:
        ok, msg = await PortfolioService.order_add(
            db, req.ticker, req.order_type, req.trigger_price, req.lots
        )
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return JSONResponse({"ok": True, "message": msg})


@router.post("/orders/{order_id}/confirm")
async def confirm_order(
    order_id: str,
    req: ConfirmOrderRequest,
) -> JSONResponse:
    """
    User mengkonfirmasi eksekusi order yang sudah terpicu.
    Menjalankan sell di backend dan mencatat ke trade_history.
    """
    async with AsyncSessionLocal() as db:
        ok, msg = await PortfolioService.confirm_order(db, order_id, req.price)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    await _sync_registry_after_trade()
    return JSONResponse({"ok": True, "message": msg})


@router.post("/orders/{order_id}/dismiss")
async def dismiss_order(order_id: str) -> JSONResponse:
    """
    User menolak eksekusi order. Order dikembalikan ke status ACTIVE
    sehingga bisa terpicu lagi di poll berikutnya.
    """
    async with AsyncSessionLocal() as db:
        ok, msg = await PortfolioService.dismiss_order(db, order_id)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return JSONResponse({"ok": True, "message": msg})


@router.delete("/orders/{order_id}")
async def cancel_order(order_id: str) -> JSONResponse:
    """Cancel order secara manual (sebelum terpicu)."""
    async with AsyncSessionLocal() as db:
        ok, msg = await PortfolioService.order_cancel(db, order_id)
    if not ok:
        raise HTTPException(status_code=404, detail=msg)
    return JSONResponse({"ok": True, "message": msg})


@router.get("/watchlist")
async def get_watchlist() -> JSONResponse:
    """Daftar ticker di watchlist beserta harga terkini dari cache."""
    prices = _current_prices()
    async with AsyncSessionLocal() as db:
        tickers = await PortfolioService.get_watchlist(db)

    result = []
    for ticker in tickers:
        quote = prices.get(ticker, {})
        result.append({
            "ticker": ticker,
            "price": quote if isinstance(quote, (int, float)) else prices.get(ticker),
        })
    return JSONResponse(result)


@router.post("/watchlist")
async def add_to_watchlist(req: WatchlistRequest) -> JSONResponse:
    """Tambah ticker ke watchlist dan daftarkan ke TickerRegistry."""
    async with AsyncSessionLocal() as db:
        ok, msg = await PortfolioService.watchlist_add(db, req.ticker)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    # Promosikan ticker ke tier watchlist di registry
    await _promote_to_watchlist(req.ticker)
    return JSONResponse({"ok": True, "message": msg})


@router.delete("/watchlist/{ticker}")
async def remove_from_watchlist(ticker: str) -> JSONResponse:
    """Hapus ticker dari watchlist."""
    ticker = ticker.upper().strip()
    if not ticker.endswith(".JK"):
        ticker += ".JK"
    async with AsyncSessionLocal() as db:
        ok, msg = await PortfolioService.watchlist_remove(db, ticker)
    if not ok:
        raise HTTPException(status_code=404, detail=msg)
    return JSONResponse({"ok": True, "message": msg})


# ── Registry sync helpers ─────────────────────────────────────────────────────

async def _sync_registry_after_trade() -> None:
    """
    Setelah buy/sell/confirm, sync holdings terbaru ke TickerRegistry
    agar DataFetcher selalu track ticker yang dipegang.
    Juga panggil TickerRegistry.promote() untuk ticker yang baru dibeli
    jika sebelumnya ada di search_temp.
    """
    from routers.market import _registry  # noqa: PLC0415 — hindari circular import top-level
    if _registry is None:
        return
    async with AsyncSessionLocal() as db:
        holdings_result = await db.execute(
            __import__("sqlalchemy", fromlist=["select"]).select(
                __import__("models.portfolio", fromlist=["Holding"]).Holding
            )
        )
        tickers = [h.ticker for h in holdings_result.scalars().all()]
    await _registry.sync_holdings(tickers)


async def _promote_to_watchlist(ticker: str) -> None:
    """Promosikan ticker dari search_temp ke tier watchlist di TickerRegistry."""
    from routers.market import _registry  # noqa: PLC0415
    if _registry is None:
        return
    await _registry.promote(ticker, to="watchlist")