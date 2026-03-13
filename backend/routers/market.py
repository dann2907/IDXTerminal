# routers/market.py
#
# Endpoint pasar:
#   GET  /api/market/quotes              → semua harga cached
#   GET  /api/market/quotes/{ticker}     → satu ticker (+ refresh TTL)
#   GET  /api/market/candles/{ticker}    → OHLCV historis dari yfinance
#   GET  /api/market/search/{query}      → cari + daftarkan sebagai search_temp
#   GET  /api/market/status              → jam bursa + registry snapshot
#   GET  /api/market/index               → IHSG + LQ45 live dari yfinance
#   WS   /ws/prices                      → stream harga real-time

import asyncio
import logging
from typing import Annotated

import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from services.data_fetcher import is_market_open
from services.ticker_registry import TickerRegistry, _normalize

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Dependency injection helpers (di-set oleh main.py) ───────────────────────
# Kita pakai simple module-level singletons yang di-inject via dependency,
# bukan global var, agar mudah di-mock saat test.

_registry: TickerRegistry | None = None
_broadcaster = None  # WSBroadcaster, hindari circular import di type hint


def set_singletons(registry: TickerRegistry, broadcaster) -> None:  # noqa: ANN001
    global _registry, _broadcaster  # noqa: PLW0603
    _registry = registry
    _broadcaster = broadcaster


def _get_registry() -> TickerRegistry:
    if _registry is None:
        raise RuntimeError("TickerRegistry not initialised")
    return _registry


def _get_broadcaster():  # noqa: ANN201
    if _broadcaster is None:
        raise RuntimeError("WSBroadcaster not initialised")
    return _broadcaster


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws/prices")
async def ws_prices(websocket: WebSocket) -> None:
    """
    WebSocket stream harga real-time.
    Pesan pertama: snapshot seluruh cache.
    Pesan berikutnya: update inkremental setiap ~15 detik.
    """
    broadcaster = _get_broadcaster()
    await broadcaster.connect(websocket)
    try:
        # Keep-alive: tunggu message dari client (ping/pong atau close)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug("WS receive error: %s", exc)
    finally:
        await broadcaster.disconnect(websocket)


# ── REST endpoints ─────────────────────────────────────────────────────────────

@router.get("/api/market/status")
async def market_status() -> JSONResponse:
    """Jam bursa IDX + snapshot registry + jumlah WS connections."""
    registry = _get_registry()
    broadcaster = _get_broadcaster()
    snap = await registry.snapshot()
    return JSONResponse({
        "market_open": is_market_open(),
        "ws_connections": broadcaster.connection_count,
        "cached_tickers": broadcaster.cached_tickers,
        "registry": snap,
    })


@router.get("/api/market/quotes")
async def get_quotes() -> JSONResponse:
    """Kembalikan seluruh cache harga terakhir."""
    broadcaster = _get_broadcaster()
    return JSONResponse(broadcaster.get_snapshot())


@router.get("/api/market/quotes/{ticker}")
async def get_quote(ticker: str) -> JSONResponse:
    """
    Kembalikan harga satu ticker dari cache.
    Juga me-refresh TTL jika ticker ada di search_temp
    (artinya user masih aktif melihat).
    """
    registry = _get_registry()
    broadcaster = _get_broadcaster()
    t = _normalize(ticker)

    await registry.refresh_search(t)

    snapshot = broadcaster.get_snapshot()
    data = snapshot.get(t)
    if data is None:
        raise HTTPException(status_code=404, detail=f"{t} not in cache")
    return JSONResponse(data)


@router.get("/api/market/search/{query}")
async def search_ticker(
    query: str,
    registry: Annotated[TickerRegistry, Depends(_get_registry)],
) -> JSONResponse:
    """
    Cari ticker dan daftarkan sebagai search_temp (TTL 5 menit).
    Langsung fetch harga via yfinance dan kembalikan hasilnya.
    """
    t = _normalize(query)

    # Validasi: cek apakah ticker valid di yfinance
    loop = asyncio.get_event_loop()
    try:
        info = await asyncio.wait_for(
            loop.run_in_executor(None, _fetch_ticker_info, t),
            timeout=10,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="yfinance timeout")

    if info is None:
        raise HTTPException(status_code=404, detail=f"Ticker {t} tidak ditemukan")

    await registry.add_search(t)
    logger.info("Search registered: %s", t)

    return JSONResponse({
        "ticker": t,
        "found": True,
        "name": info.get("longName") or info.get("shortName") or t,
        "sector": info.get("sector", ""),
        "ttl_seconds": 300,
        **({} if not (price := info.get("currentPrice") or info.get("previousClose")) else {
            "price": price,
        }),
    })


@router.get("/api/market/candles/{ticker}")
async def get_candles(
    ticker: str,
    period: Annotated[str, Query(pattern=r"^(1d|5d|1mo|3mo|6mo|1y|2y|5y)$")] = "3mo",
    interval: Annotated[str, Query(pattern=r"^(1m|5m|15m|30m|1h|1d|1wk|1mo)$")] = "1d",
) -> JSONResponse:
    """
    OHLCV historis untuk chart. Data dari yfinance.
    period  : 1d | 5d | 1mo | 3mo | 6mo | 1y | 2y | 5y
    interval: 1m | 5m | 15m | 30m | 1h | 1d | 1wk | 1mo
    """
    t = _normalize(ticker)
    loop = asyncio.get_event_loop()
    try:
        candles = await asyncio.wait_for(
            loop.run_in_executor(None, _fetch_candles, t, period, interval),
            timeout=15,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="yfinance timeout")

    if candles is None:
        raise HTTPException(status_code=404, detail=f"No candle data for {t}")

    return JSONResponse({"ticker": t, "period": period, "interval": interval, "candles": candles})


@router.get("/api/market/ihsg")
async def get_ihsg() -> JSONResponse:
    """
    Kembalikan data IHSG (^JKSE) dari yfinance.
    Cache 60 detik di sisi server — topbar boleh polling tanpa throttle sendiri.

    Response:
      { "price": 7284.5, "change": 31.2, "change_pct": 0.43 }
    Kembalikan {} jika yfinance gagal (topbar tampilkan "—").
    """
    import time  # noqa: PLC0415
    now = time.monotonic()

    if _ihsg_cache["data"] is not None and now - _ihsg_cache["ts"] < 60:
        return JSONResponse(_ihsg_cache["data"])

    loop = asyncio.get_event_loop()
    try:
        data = await asyncio.wait_for(
            loop.run_in_executor(None, _fetch_ihsg),
            timeout=10,
        )
    except asyncio.TimeoutError:
        if _ihsg_cache["data"] is not None:
            return JSONResponse(_ihsg_cache["data"])
        raise HTTPException(status_code=504, detail="yfinance timeout fetching IHSG")

    if data:
        _ihsg_cache["data"] = data
        _ihsg_cache["ts"] = now

    return JSONResponse(data or {})


# Cache modul-level untuk IHSG — reset saat server restart
_ihsg_cache: dict = {"data": None, "ts": 0.0}


# ── Blocking helpers (untuk run_in_executor) ──────────────────────────────────

def _fetch_ticker_info(ticker_jk: str) -> dict | None:
    """Ambil info ticker dari yfinance. Kembalikan None jika tidak valid."""
    try:
        tk = yf.Ticker(ticker_jk)
        info = tk.info or {}
        # yfinance mengembalikan dict kecil dengan quoteType jika ticker valid
        if not info.get("quoteType"):
            return None
        return info
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug("yfinance info error %s: %s", ticker_jk, exc)
        return None


def _fetch_candles(ticker_jk: str, period: str, interval: str) -> list[dict] | None:
    """Ambil OHLCV historis dari yfinance dan konversi ke list of dict."""
    try:
        tk = yf.Ticker(ticker_jk)
        hist = tk.history(period=period, interval=interval)
        if hist.empty:
            return None

        result = []
        for ts, row in hist.iterrows():
            result.append({
                "time": int(ts.timestamp()),            # unix timestamp
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row.get("Volume", 0)),
            })
        return result
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug("yfinance candles error %s: %s", ticker_jk, exc)
        return None


def _fetch_ihsg() -> dict:
    """
    Fetch IHSG (^JKSE) dari yfinance. Dijalankan di thread pool — blocking call.
    Kembalikan dict kosong jika gagal; caller akan pakai cache lama.
    """
    try:
        tk = yf.Ticker("^JKSE")
        hist = tk.history(period="2d", interval="1d")
        if hist.empty:
            return {}
        last = hist.iloc[-1]
        prev = hist.iloc[-2] if len(hist) >= 2 else hist.iloc[-1]
        price = round(float(last["Close"]), 2)
        prev_close = round(float(prev["Close"]), 2)
        change = round(price - prev_close, 2)
        change_pct = round((change / prev_close * 100) if prev_close else 0.0, 2)
        return {"price": price, "change": change, "change_pct": change_pct}
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug("IHSG fetch error: %s", exc)
        return {}