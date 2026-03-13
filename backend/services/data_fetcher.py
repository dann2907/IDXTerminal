# services/data_fetcher.py
#
# Async price fetcher — tidak ada dependency PyQt6.
#
# Sumber data:
#   Market buka  → IDX GetSecuritiesStock snapshot (700+ saham, 1 request)
#                   → filter ke ticker user → yfinance fallback untuk miss
#   Market tutup → yfinance last close langsung
#
# Arsitektur snapshot (Fase 4):
#   IDX API (1 req) → parse ~700 baris → filter ticker user → broadcast
#   Jauh lebih cepat + tidak kena rate-limit vs fetch per-ticker.
#
# Format ticker internal app : "BBCA.JK"
# IDX API pakai              : "BBCA"  (tanpa .JK)
# Konversi terjadi di sini, lapisan lain tidak perlu tahu.
#
# Terms of Use IDX:
#   Data dari idx.co.id hanya untuk penggunaan personal / non-komersial.
#   https://idx.co.id/footer-menu/tautan-langsung/syarat-penggunaan/

import asyncio
import logging
from datetime import datetime
from typing import TYPE_CHECKING

import aiohttp
import yfinance as yf

from .ticker_registry import TickerRegistry

if TYPE_CHECKING:
    from .ws_broadcaster import WSBroadcaster

try:
    from zoneinfo import ZoneInfo
except ImportError:  # Python < 3.9
    from backports.zoneinfo import ZoneInfo  # type: ignore[no-redef]

logger = logging.getLogger(__name__)

# ── Jam bursa IDX ─────────────────────────────────────────────────────────────
_WIB = ZoneInfo("Asia/Jakarta")

# (jam_buka, menit_buka, jam_tutup, menit_tutup) per sesi, weekday 0=Senin
_IDX_SESSIONS: dict[int, list[tuple[int, int, int, int]]] = {
    0: [(9, 0, 12, 0), (13, 30, 15, 49)],
    1: [(9, 0, 12, 0), (13, 30, 15, 49)],
    2: [(9, 0, 12, 0), (13, 30, 15, 49)],
    3: [(9, 0, 12, 0), (13, 30, 15, 49)],
    4: [(9, 0, 11, 30), (14, 0, 15, 49)],
}

# ── IDX API constants ─────────────────────────────────────────────────────────
_IDX_SUMMARY_URL = (
    "https://www.idx.co.id/umbraco/Surface/StockData/GetStockSummary"
)
_IDX_SNAPSHOT_URL = (
    "https://www.idx.co.id/umbraco/Surface/StockData/GetSecuritiesStock"
)
_IDX_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.idx.co.id/",
    "Accept": "application/json, text/javascript, */*; q=0.01",
}
_IDX_TIMEOUT    = aiohttp.ClientTimeout(total=15)  # snapshot lebih besar, naikkan timeout
_IDX_BATCH_DELAY = 0.35   # detik antar ticker, masih dipakai oleh fallback per-ticker
_POLL_INTERVAL   = 15     # detik antar full poll cycle
_YFINANCE_TIMEOUT = 10    # detik untuk yfinance request


# ── QuoteData ─────────────────────────────────────────────────────────────────

class QuoteData:
    """Snapshot harga satu ticker."""

    __slots__ = (
        "ticker", "price", "prev_close",
        "change", "change_pct",
        "open", "high", "low", "volume",
        "timestamp", "is_live",
    )

    def __init__(
        self,
        ticker: str,
        price: float,
        prev_close: float,
        open_: float,
        high: float,
        low: float,
        volume: int,
        is_live: bool,
    ) -> None:
        self.ticker = ticker
        self.price = price
        self.prev_close = prev_close
        self.open = open_
        self.high = high
        self.low = low
        self.volume = volume
        self.is_live = is_live
        self.change = round(price - prev_close, 2)
        self.change_pct = round(
            ((price - prev_close) / prev_close) * 100 if prev_close else 0.0, 2
        )
        self.timestamp = datetime.now(_WIB).isoformat()

    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "price": self.price,
            "prev_close": self.prev_close,
            "change": self.change,
            "change_pct": self.change_pct,
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "volume": self.volume,
            "timestamp": self.timestamp,
            "is_live": self.is_live,
        }


# ── Market hours ──────────────────────────────────────────────────────────────

def is_market_open() -> bool:
    """True jika sekarang dalam sesi trading IDX (WIB)."""
    now = datetime.now(_WIB)
    sessions = _IDX_SESSIONS.get(now.weekday())
    if not sessions:
        return False
    t = now.hour * 60 + now.minute
    return any(oh * 60 + om <= t <= ch * 60 + cm for oh, om, ch, cm in sessions)


# ── DataFetcher ───────────────────────────────────────────────────────────────

class DataFetcher:
    def __init__(self) -> None:
        self._session: aiohttp.ClientSession | None = None
        self._task: asyncio.Task | None = None

    async def start(
        self,
        registry: TickerRegistry,
        broadcaster: "WSBroadcaster",
    ) -> None:
        """Mulai background polling loop. Panggil sekali saat app startup."""
        self._session = aiohttp.ClientSession(
            headers=_IDX_HEADERS, timeout=_IDX_TIMEOUT
        )
        self._task = asyncio.create_task(
            self._poll_loop(registry, broadcaster)
        )
        logger.info("DataFetcher started (interval=%ds)", _POLL_INTERVAL)

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._session:
            await self._session.close()

    # ── Poll loop ─────────────────────────────────────────────────────────────

    async def _poll_loop(
        self,
        registry: TickerRegistry,
        broadcaster: "WSBroadcaster",
    ) -> None:
        while True:
            try:
                tickers = await registry.get_all()
                if tickers:
                    results = await self._fetch_all(tickers)
                    if results:
                        broadcaster.update_cache(results)
                        await broadcaster.broadcast({
                            "type": "update",
                            "data": {t: q.to_dict() for t, q in results.items()},
                        })
            except asyncio.CancelledError:
                logger.info("DataFetcher poll loop cancelled")
                return
            except Exception as exc:  # pylint: disable=broad-except
                logger.error("DataFetcher poll error: %s", exc, exc_info=True)
            await asyncio.sleep(_POLL_INTERVAL)

    # ── Fetch all tickers ─────────────────────────────────────────────────────

    async def _fetch_all(
        self, tickers: set[str]
    ) -> dict[str, QuoteData]:
        """
        Strategi baru (Fase 4):

        Market BUKA:
          1. Ambil snapshot seluruh IDX dalam SATU request (~700 saham)
          2. Filter ke tickers yang dibutuhkan user
          3. Ticker yang tidak ada di snapshot → fallback yfinance (saham baru, dll)

        Market TUTUP:
          Langsung yfinance last-close (IDX API kembalikan data stale).

        Manfaat snapshot:
          - 1 request vs N request (N = jumlah ticker user)
          - Tidak kena rate-limit IDX
          - Latency jauh lebih stabil
        """
        if not is_market_open():
            return await self._fetch_all_yfinance(tickers)

        # ── Market buka: snapshot IDX ──────────────────────────────────────
        snapshot = await self._fetch_idx_snapshot()

        results: dict[str, QuoteData] = {}
        missing: list[str] = []

        for ticker in tickers:
            if ticker in snapshot:
                results[ticker] = snapshot[ticker]
            else:
                missing.append(ticker)

        logger.info(
            "IDX snapshot: %d/%d hit, %d fallback ke yfinance",
            len(results), len(tickers), len(missing),
        )

        # Fallback yfinance untuk ticker yang tidak ada di snapshot IDX
        # (saham baru listing, warrant, ETF non-IDX, dll)
        for ticker in missing:
            quote = await self._fetch_yfinance(ticker)
            if quote:
                results[ticker] = quote
            else:
                logger.warning("No data for %s (IDX miss + yfinance fail)", ticker)

        return results

    async def _fetch_all_yfinance(
        self, tickers: set[str]
    ) -> dict[str, QuoteData]:
        """Fetch semua ticker via yfinance — dipakai saat market tutup."""
        results: dict[str, QuoteData] = {}
        for ticker in tickers:
            quote = await self._fetch_yfinance(ticker)
            if quote:
                results[ticker] = quote
            else:
                logger.warning("No data for %s (market closed, yfinance fail)", ticker)
        return results

    # ── IDX Snapshot (seluruh pasar, 1 request) ───────────────────────────────

    async def _fetch_idx_snapshot(self) -> dict[str, QuoteData]:
        """
        Ambil seluruh saham IDX dalam SATU request.
        Endpoint GetSecuritiesStock mengembalikan 700+ saham sekaligus.

        Return dict ticker → QuoteData.
        Return {} jika request gagal — caller akan fallback ke yfinance.
        """
        assert self._session is not None
        try:
            async with self._session.get(_IDX_SNAPSHOT_URL) as resp:
                if resp.status != 200:
                    logger.warning("IDX snapshot HTTP %d", resp.status)
                    return {}
                raw = await resp.json(content_type=None)
        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            logger.error("IDX snapshot request failed: %s", exc)
            return {}
        except Exception as exc:  # pylint: disable=broad-except
            logger.error("IDX snapshot unexpected error: %s", exc)
            return {}

        rows = raw if isinstance(raw, list) else raw.get("data", raw.get("Data", []))
        results: dict[str, QuoteData] = {}
        skipped = 0

        for row in rows:
            try:
                code = (
                    row.get("Code") or row.get("StockCode") or row.get("code") or ""
                ).strip()
                if not code:
                    skipped += 1
                    continue

                ticker = f"{code}.JK"
                price = float(row.get("LastPrice") or row.get("lastPrice") or 0)
                if price <= 0:
                    skipped += 1
                    continue

                prev_close = float(row.get("PreviousPrice") or row.get("previousPrice") or price)
                open_  = float(row.get("OpenPrice")  or row.get("openPrice")  or price)
                high   = float(row.get("HighPrice")  or row.get("highPrice")  or price)
                low    = float(row.get("LowPrice")   or row.get("lowPrice")   or price)
                volume = int(float(row.get("Volume") or row.get("volume") or 0))

                results[ticker] = QuoteData(
                    ticker=ticker,
                    price=price,
                    prev_close=prev_close,
                    open_=open_,
                    high=high,
                    low=low,
                    volume=volume,
                    is_live=True,
                )
            except Exception:  # pylint: disable=broad-except
                skipped += 1
                continue

        logger.info(
            "IDX snapshot parsed: %d saham, %d dilewati",
            len(results), skipped,
        )
        return results

    # ── IDX per-ticker fallback (masih dipakai jika snapshot gagal total) ──────

    async def _fetch_idx(self, ticker_jk: str) -> QuoteData | None:
        """
        Fetch satu ticker dari IDX internal API.
        Kembalikan None jika gagal atau data tidak valid.
        """
        code = ticker_jk.upper().replace(".JK", "")
        params = {"StockCode": code}
        try:
            assert self._session is not None
            async with self._session.get(
                _IDX_SUMMARY_URL, params=params
            ) as resp:
                if resp.status != 200:
                    logger.debug("IDX API %s → HTTP %d", code, resp.status)
                    return None
                raw = await resp.json(content_type=None)
        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            logger.debug("IDX API request failed for %s: %s", code, exc)
            return None

        return _parse_idx_response(ticker_jk, raw)

    # ── yfinance fetch ────────────────────────────────────────────────────────

    async def _fetch_yfinance(self, ticker_jk: str) -> QuoteData | None:
        """
        Fetch last-close dari yfinance secara async
        (jalankan blocking call di thread pool agar tidak block event loop).
        """
        loop = asyncio.get_event_loop()
        try:
            quote = await asyncio.wait_for(
                loop.run_in_executor(None, _blocking_yfinance, ticker_jk),
                timeout=_YFINANCE_TIMEOUT,
            )
            return quote
        except asyncio.TimeoutError:
            logger.debug("yfinance timeout: %s", ticker_jk)
            return None
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug("yfinance error %s: %s", ticker_jk, exc)
            return None


# ── Parsers (modul-level, bukan method, mudah di-test) ───────────────────────

def _parse_idx_response(ticker_jk: str, raw: dict) -> QuoteData | None:
    """
    Parse respons JSON dari IDX API.
    Kembalikan None jika field penting kosong/nol.
    """
    try:
        price = float(raw.get("LastPrice") or 0)
        if price <= 0:
            return None

        prev_close = float(raw.get("PreviousPrice") or price)
        open_ = float(raw.get("OpenPrice") or price)
        high = float(raw.get("HighPrice") or price)
        low = float(raw.get("LowPrice") or price)

        # Volume dari IDX kadang dalam satuan lot, kalikan 100
        raw_vol = raw.get("Volume") or 0
        volume = int(float(raw_vol))

        return QuoteData(
            ticker=ticker_jk,
            price=price,
            prev_close=prev_close,
            open_=open_,
            high=high,
            low=low,
            volume=volume,
            is_live=True,
        )
    except (TypeError, ValueError, KeyError) as exc:
        logger.debug("IDX parse error for %s: %s | raw=%s", ticker_jk, exc, raw)
        return None


def _blocking_yfinance(ticker_jk: str) -> QuoteData | None:
    """
    Blocking yfinance call — harus dijalankan di executor.

    Beberapa saham IDX gagal di period="2d" (delisted warning palsu,
    atau empty JSON dari server). Strategy:
      1. Coba period="5d" — lebih stabil, dapat prev_close dari hari sebelumnya
      2. Fallback period="1mo" — hampir selalu berhasil, ambil baris terakhir
      3. Jika masih gagal → return None (DataFetcher akan skip ticker)
    """
    tk = yf.Ticker(ticker_jk)

    for period in ("5d", "1mo"):
        try:
            hist = tk.history(period=period, auto_adjust=True, actions=False)
            if hist.empty:
                continue

            row = hist.iloc[-1]
            price = float(row["Close"])
            if price <= 0:
                continue

            prev_close = float(hist.iloc[-2]["Close"]) if len(hist) >= 2 else price
            open_   = float(row.get("Open",   price))
            high    = float(row.get("High",   price))
            low     = float(row.get("Low",    price))
            volume  = int(row.get("Volume", 0))

            return QuoteData(
                ticker=ticker_jk,
                price=price,
                prev_close=prev_close,
                open_=open_,
                high=high,
                low=low,
                volume=volume,
                is_live=False,
            )
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug("yfinance %s (period=%s) error: %s", ticker_jk, period, exc)
            continue

    logger.warning("yfinance: semua period gagal untuk %s", ticker_jk)
    return None