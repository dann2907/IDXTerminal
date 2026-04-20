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
_IDX_SUMMARY_URL = "https://www.idx.co.id/umbraco/Surface/StockData/GetStockSummary"
_IDX_SNAPSHOT_URL = "https://www.idx.co.id/primary/Home/GetTradeSummary?lang=id"
_IDX_SNAPSHOT_FALLBACK_URL = (
    "https://www.idx.co.id/umbraco/Surface/StockData/GetSecuritiesStock"
)
_IDX_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/147.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.7",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Referer": "https://www.idx.co.id/id",
    "Origin": "https://www.idx.co.id",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Sec-GPC": "1",
    "egrum": "isAjax:true",
}
_IDX_TIMEOUT    = aiohttp.ClientTimeout(total=15)  # snapshot lebih besar, naikkan timeout
_IDX_BATCH_DELAY = 0.35   # detik antar ticker, masih dipakai oleh fallback per-ticker
_POLL_INTERVAL   = 15     # detik antar full poll cycle
_YFINANCE_TIMEOUT = 10    # detik untuk yfinance request
_YFINANCE_RETRIES = 1      
_YFINANCE_RETRY_DELAY = 2 # detik tunggu sebelum retry

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

        if not results and missing:
            logger.info(
                "IDX snapshot kosong; mencoba fallback per-ticker IDX untuk %d ticker",
                len(missing),
            )
            idx_recovered: list[str] = []
            for ticker in list(missing):
                quote = await self._fetch_idx(ticker)
                if quote:
                    results[ticker] = quote
                    idx_recovered.append(ticker)
                await asyncio.sleep(_IDX_BATCH_DELAY)
            if idx_recovered:
                missing = [ticker for ticker in missing if ticker not in results]
                logger.info(
                    "IDX per-ticker fallback recovered %d ticker",
                    len(idx_recovered),
                )

        # Fallback yfinance untuk ticker yang tidak ada di snapshot IDX
        # atau tetap gagal di endpoint per-ticker.
        for ticker in missing:
            quote = await self._fetch_yfinance(ticker)
            if quote:
                results[ticker] = quote
            else:
                logger.warning("No data for %s (IDX miss + yfinance fail)", ticker)

        return results

    async def _request_idx_payload(
        self,
        url: str,
        label: str,
        *,
        params: dict[str, str] | None = None,
    ) -> object | None:
        """Request helper dengan logging yang lebih jelas saat IDX menolak."""
        assert self._session is not None
        try:
            async with self._session.get(url, params=params) as resp:
                body = await resp.text()
                if resp.status != 200:
                    snippet = " ".join(body.split())[:180]
                    logger.warning(
                        "%s HTTP %d | url=%s | body=%s",
                        label,
                        resp.status,
                        str(resp.url),
                        snippet or "<empty>",
                    )
                    return None
                try:
                    return await resp.json(content_type=None)
                except Exception:
                    snippet = " ".join(body.split())[:180]
                    logger.warning(
                        "%s non-JSON response | url=%s | body=%s",
                        label,
                        str(resp.url),
                        snippet or "<empty>",
                    )
                    return None
        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            logger.error("%s request failed: %s", label, exc)
            return None
        except Exception as exc:  # pylint: disable=broad-except
            logger.error("%s unexpected error: %s", label, exc)
            return None

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
        raw = await self._request_idx_payload(_IDX_SNAPSHOT_URL, "IDX snapshot")
        if raw is None:
            raw = await self._request_idx_payload(
                _IDX_SNAPSHOT_FALLBACK_URL,
                "IDX snapshot fallback",
            )
        if raw is None:
            return {}

        rows = _extract_idx_rows(raw)
        if not rows:
            logger.warning(
                "IDX snapshot payload tidak berisi rows yang dikenali (type=%s)",
                type(raw).__name__,
            )
            return {}

        results: dict[str, QuoteData] = {}
        skipped = 0

        for row in rows:
            try:
                quote = _parse_idx_row(row)
                if quote is None:
                    skipped += 1
                    continue
                results[quote.ticker] = quote
                continue
                # StockCode adalah field utama di GetSecuritiesStock
                code = (
                    row.get("StockCode") or row.get("Code") or row.get("code") or ""
                ).strip()
                if not code:
                    skipped += 1
                    continue

                ticker = f"{code}.JK"

                # FIX: Snapshot pakai "Close", bukan "LastPrice"
                price = float(
                    row.get("Close") or row.get("LastPrice") or row.get("lastPrice") or 0
                )
                if price <= 0:
                    skipped += 1
                    continue

                # FIX: "Previous" bukan "PreviousPrice"
                prev_close = float(
                    row.get("Previous") or row.get("PreviousPrice")
                    or row.get("previousPrice") or price
                )
                open_ = float(row.get("OpenPrice") or row.get("openPrice") or price)
                # FIX: "High"/"Low" bukan "HighPrice"/"LowPrice"
                high = float(
                    row.get("High") or row.get("HighPrice") or row.get("highPrice") or price
                )
                low = float(
                    row.get("Low") or row.get("LowPrice") or row.get("lowPrice") or price
                )
                # Volume snapshot sudah dalam satuan LEMBAR — tidak perlu konversi lot
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
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug("IDX snapshot: skip row error: %s | row=%s", exc, row)
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
        raw = await self._request_idx_payload(
            _IDX_SUMMARY_URL,
            f"IDX summary {code}",
            params=params,
        )
        if raw is None:
            return None
        return _parse_idx_response(ticker_jk, raw)

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
        Fetch last-close dari yfinance secara async.
        FIX B6: Satu retry pada TimeoutError sebelum menyerah.
        Non-timeout error (delisted, bad response) tidak di-retry.
        """
        loop = asyncio.get_running_loop()
        for attempt in range(1 + _YFINANCE_RETRIES):
            try:
                quote = await asyncio.wait_for(
                    loop.run_in_executor(None, _blocking_yfinance, ticker_jk),
                    timeout=_YFINANCE_TIMEOUT,
                )
                return quote
            except asyncio.TimeoutError:
                if attempt < _YFINANCE_RETRIES:
                    logger.debug(
                        "yfinance timeout %s (attempt %d/%d), retry dalam %ds",
                        ticker_jk, attempt + 1,
                        1 + _YFINANCE_RETRIES, _YFINANCE_RETRY_DELAY,
                    )
                    await asyncio.sleep(_YFINANCE_RETRY_DELAY)
                else:
                    logger.debug(
                        "yfinance timeout %s setelah %d percobaan",
                        ticker_jk, 1 + _YFINANCE_RETRIES,
                    )
                    return None
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug("yfinance error %s: %s", ticker_jk, exc)
                return None  # Jangan retry non-timeout error

        return None


# ── Parsers (modul-level, bukan method, mudah di-test) ───────────────────────

def _parse_idx_response(ticker_jk: str, raw: object) -> QuoteData | None:
    """
    Parse respons JSON dari IDX API.
    Kembalikan None jika field penting kosong/nol.
    """
    if not isinstance(raw, dict):
        logger.debug("IDX parse error for %s: payload bukan dict | raw=%s", ticker_jk, raw)
        return None

    try:
        normalized = _normalize_idx_record(raw)
        price = float(normalized.get("LastPrice") or 0)
        if price <= 0:
            return None

        prev_close = float(normalized.get("PreviousPrice") or price)
        open_ = float(normalized.get("OpenPrice") or price)
        high = float(normalized.get("HighPrice") or price)
        low = float(normalized.get("LowPrice") or price)

        # Volume dari IDX kadang dalam satuan lot, kalikan 100
        raw_vol = normalized.get("Volume") or 0
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


def _extract_idx_rows(raw: object) -> list[dict]:
    """Coba beberapa bentuk payload IDX yang sering berubah antar endpoint."""
    if isinstance(raw, list):
        return [row for row in raw if isinstance(row, dict)]

    if not isinstance(raw, dict):
        return []

    direct_keys = (
        "data",
        "Data",
        "Results",
        "results",
        "Table",
        "table",
        "List",
        "list",
        "Stocks",
        "stocks",
    )
    for key in direct_keys:
        rows = raw.get(key)
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, dict)]

    for value in raw.values():
        if isinstance(value, list) and all(isinstance(row, dict) for row in value):
            return value
        if isinstance(value, dict):
            nested = _extract_idx_rows(value)
            if nested:
                return nested

    return []


def _normalize_idx_record(raw: dict) -> dict[str, object]:
    """Samakan beberapa nama field dari endpoint IDX yang berbeda."""
    return {
        "StockCode": (
            raw.get("StockCode")
            or raw.get("Code")
            or raw.get("code")
            or raw.get("Ticker")
            or raw.get("ticker")
            or raw.get("Symbol")
            or raw.get("symbol")
            or ""
        ),
        "LastPrice": (
            raw.get("LastPrice")
            or raw.get("Close")
            or raw.get("close")
            or raw.get("Last")
            or raw.get("last")
            or raw.get("Price")
            or raw.get("price")
            or 0
        ),
        "PreviousPrice": (
            raw.get("PreviousPrice")
            or raw.get("Previous")
            or raw.get("Prev")
            or raw.get("prev")
            or raw.get("previousPrice")
            or 0
        ),
        "OpenPrice": raw.get("OpenPrice") or raw.get("Open") or raw.get("open") or 0,
        "HighPrice": raw.get("HighPrice") or raw.get("High") or raw.get("high") or 0,
        "LowPrice": raw.get("LowPrice") or raw.get("Low") or raw.get("low") or 0,
        "Volume": raw.get("Volume") or raw.get("volume") or raw.get("Vol") or raw.get("vol") or 0,
    }


def _parse_idx_row(raw: dict) -> QuoteData | None:
    """Parse satu row snapshot IDX yang field-nya bisa berubah antar endpoint."""
    normalized = _normalize_idx_record(raw)
    code = str(normalized.get("StockCode") or "").strip().upper()
    if not code:
        return None

    ticker = f"{code}.JK"
    return _parse_idx_response(ticker, normalized)


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
