# scripts/migrate_json.py
#
# Script migrasi satu kali dari portfolio_data.json (format lama)
# ke SQLite (format baru).
#
# Cara pakai:
#   cd D:\MyBroker\IDXTerminal\backend
#   python scripts/migrate_json.py
#
# Script ini AMAN dijalankan berulang kali:
#   - Jika DB sudah ada datanya, script akan berhenti (tidak overwrite).
#   - Gunakan --force untuk overwrite.
#
# Yang dimigrate:
#   cash, starting_cash         → portfolio_meta
#   holdings                    → holdings
#   history (BUY/SELL)          → trade_history
#   orders (semua status)       → orders
#   watchlist                   → watchlist

import argparse
import asyncio
import json
import os
import sys
import uuid
from datetime import datetime

# Tambah parent dir ke path agar bisa import dari backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import AsyncSessionLocal, engine
from models.portfolio import Base, Holding, Order, PortfolioMeta, TradeHistory, Watchlist

# ── Lokasi default portfolio_data.json ───────────────────────────────────────
DEFAULT_JSON = os.path.join(
    os.path.dirname(__file__), "..", "..", "portfolio_data.json"
)


def _parse_dt(date_str: str | None) -> datetime:
    """Parse tanggal dari format lama ke datetime. Fallback ke utcnow."""
    if not date_str:
        return datetime.utcnow()
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return datetime.utcnow()


def _decode_blob(blob: str, field_name: str) -> list | dict:
    """
    Decode field yang dikompresi dengan gzip+base64 oleh storage.py lama.

    Format yang disimpan storage.py:
        "{field}_encoding": "gzip+base64"
        "{field}_blob":     "<base64 string>"

    Jika decode gagal, kembalikan nilai default yang aman (list kosong
    untuk history, dict kosong untuk orders) dan cetak warning eksplisit
    agar user tahu ada data yang tidak bisa dimigrate — tidak diam-diam.
    """
    import base64  # noqa: PLC0415
    import gzip    # noqa: PLC0415

    default: list | dict = [] if field_name == "history" else {}
    try:
        zipped = base64.b64decode(blob.encode("ascii"))
        raw_bytes = gzip.decompress(zipped)
        result = json.loads(raw_bytes.decode("utf-8"))
        print(f"  [decode] {field_name}: berhasil decode blob "
              f"({len(blob)} chars → {len(raw_bytes)} bytes)")
        return result
    except Exception as exc:  # noqa: BLE001
        # Cetak warning eksplisit — jangan telan error ini diam-diam
        print(f"  [WARN] Gagal decode {field_name}_blob: {exc}")
        print(f"  [WARN] {field_name} akan dikosongkan di DB.")
        return default


def _load_json(path: str) -> dict:
    """
    Baca portfolio_data.json dan decode field yang dikompres.

    storage.py lama menyimpan history dan orders dalam dua format:
      1. Langsung sebagai list/dict jika ukuran < 8000 bytes (tidak dikompres)
      2. Sebagai gzip+base64 blob jika ukuran >= 8000 bytes (dikompres)

    Script ini menangani kedua format secara self-contained — tidak
    bergantung pada storage.py agar tetap berfungsi meski file tersebut
    tidak ada di PATH atau sudah dihapus.
    """
    abs_path = os.path.abspath(path)
    if not os.path.exists(abs_path):
        print(f"[ERROR] File tidak ditemukan: {abs_path}")
        sys.exit(1)

    with open(abs_path, encoding="utf-8") as f:
        raw = json.load(f)

    _ENCODING = "gzip+base64"

    # Decode history — bisa berupa list langsung atau blob terkompresi
    if "history_blob" in raw:
        if raw.get("history_encoding") != _ENCODING:
            print(f"[WARN] history_encoding tidak dikenali: "
                  f"{raw.get('history_encoding')} — field dilewati.")
            history = []
        else:
            history = _decode_blob(raw["history_blob"], "history")
    else:
        # Tidak dikompres — langsung pakai
        history = raw.get("history", [])
        if history:
            print(f"  [decode] history: tidak dikompres ({len(history)} entri)")

    # Validasi hasil decode — pastikan benar-benar list of dict
    if not isinstance(history, list):
        print(f"[WARN] history bukan list setelah decode "
              f"(tipe: {type(history).__name__}) — dikosongkan.")
        history = []

    # Decode orders — sama, bisa blob atau dict langsung
    if "orders_blob" in raw:
        if raw.get("orders_encoding") != _ENCODING:
            print(f"[WARN] orders_encoding tidak dikenali: "
                  f"{raw.get('orders_encoding')} — field dilewati.")
            orders = {}
        else:
            orders = _decode_blob(raw["orders_blob"], "orders")
    else:
        orders = raw.get("orders", {})
        if orders:
            print(f"  [decode] orders: tidak dikompres ({len(orders)} ticker)")

    if not isinstance(orders, dict):
        print(f"[WARN] orders bukan dict setelah decode "
              f"(tipe: {type(orders).__name__}) — dikosongkan.")
        orders = {}

    return {
        "cash":          raw.get("cash", 100_000_000),
        "starting_cash": raw.get("starting_cash", 100_000_000),
        "holdings":      raw.get("holdings", {}),
        "watchlist":     raw.get("watchlist", []),
        "history":       history,
        "orders":        orders,
    }


async def _has_existing_data() -> bool:
    """True jika DB sudah punya data (bukan kosong)."""
    async with AsyncSessionLocal() as db:
        result = await db.get(PortfolioMeta, 1)
        return result is not None


async def migrate(data: dict, force: bool = False) -> None:
    # Buat tabel jika belum ada
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    if not force and await _has_existing_data():
        print(
            "[SKIP] Database sudah berisi data. Gunakan --force untuk overwrite."
        )
        return

    async with AsyncSessionLocal() as db:
        # Bersihkan semua data lama jika --force
        if force:
            for model in [TradeHistory, Order, Holding, Watchlist, PortfolioMeta]:
                from sqlalchemy import delete as _del  # noqa: PLC0415
                await db.execute(_del(model))
            await db.commit()
            print("[FORCE] Data lama dihapus.")

        # ── portfolio_meta ─────────────────────────────────────────────────
        meta = PortfolioMeta(
            id=1,
            cash=float(data.get("cash", 100_000_000)),
            starting_cash=float(data.get("starting_cash", 100_000_000)),
        )
        db.add(meta)
        print(f"[meta] cash={meta.cash:,.0f}  starting={meta.starting_cash:,.0f}")

        # ── holdings ───────────────────────────────────────────────────────
        holdings_raw: dict = data.get("holdings", {})
        holding_count = 0
        for ticker, h in holdings_raw.items():
            db.add(Holding(
                ticker=ticker.upper(),
                shares=int(h.get("shares", 0)),
                avg_cost=float(h.get("avg_cost", 0)),
            ))
            holding_count += 1
        print(f"[holdings] {holding_count} ticker dimigrate")

        # ── trade_history ──────────────────────────────────────────────────
        history_raw: list = data.get("history", [])
        # Pertama, replay untuk mencari first_buy per ticker
        first_buy: dict[str, datetime] = {}
        for trade in history_raw:
            if trade.get("action") == "BUY":
                ticker = trade["ticker"].upper()
                dt = _parse_dt(trade.get("date"))
                if ticker not in first_buy or dt < first_buy[ticker]:
                    first_buy[ticker] = dt

        # Update first_buy ke holding yang baru di-insert
        for ticker, dt in first_buy.items():
            from sqlalchemy import select  # noqa: PLC0415
            result = await db.execute(
                select(Holding).where(Holding.ticker == ticker)
            )
            h = result.scalar_one_or_none()
            if h:
                h.first_buy = dt

        hist_count = 0
        for trade in history_raw:
            action = trade.get("action", "").upper()
            if action not in ("BUY", "SELL"):
                continue
            ticker = trade["ticker"].upper()
            shares = int(trade.get("shares", 0))
            lots = trade.get("lots")
            price = float(trade.get("price", 0))
            db.add(TradeHistory(
                action=action,
                ticker=ticker,
                shares=shares,
                lots=int(lots) if lots is not None else None,
                price=price,
                total=float(trade.get("total", shares * price)),
                source=trade.get("source", "MANUAL"),
                traded_at=_parse_dt(trade.get("date")),
            ))
            hist_count += 1
        print(f"[history] {hist_count} transaksi dimigrate")

        # ── orders ─────────────────────────────────────────────────────────
        orders_raw: dict = data.get("orders", {})
        order_count = 0
        for ticker, ticker_orders in orders_raw.items():
            if not isinstance(ticker_orders, list):
                continue
            for o in ticker_orders:
                # Pastikan order_id unik
                oid = o.get("id") or str(uuid.uuid4())[:8]
                lots = int(o.get("lots_or_shares", 0))
                shares = int(o.get("shares", lots * 100))
                db.add(Order(
                    order_id=oid,
                    ticker=ticker.upper(),
                    order_type=o.get("type", "TP").upper(),
                    trigger_price=float(o.get("trigger_price", 0)),
                    lots=lots,
                    shares=shares,
                    status=o.get("status", "ACTIVE").upper(),
                    created_at=_parse_dt(o.get("created_at")),
                    triggered_at=_parse_dt(o.get("triggered_at")) if o.get("triggered_at") else None,
                ))
                order_count += 1
        print(f"[orders] {order_count} order dimigrate")

        # ── watchlist ──────────────────────────────────────────────────────
        watchlist_raw: list = data.get("watchlist", [])
        for i, ticker in enumerate(watchlist_raw):
            db.add(Watchlist(
                ticker=ticker.upper(),
                display_order=i,
            ))
        print(f"[watchlist] {len(watchlist_raw)} ticker dimigrate")

        await db.commit()
        print("\n✅ Migrasi selesai!")


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate portfolio_data.json ke SQLite")
    parser.add_argument(
        "--json", default=DEFAULT_JSON,
        help="Path ke portfolio_data.json (default: ../portfolio_data.json)"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Hapus data DB yang ada sebelum migrasi"
    )
    args = parser.parse_args()

    data = _load_json(args.json)
    asyncio.run(migrate(data, force=args.force))


if __name__ == "__main__":
    main()