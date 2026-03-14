# services/portfolio_service.py
#
# Async rewrite dari portofolio.py — semua logika bisnis sama persis,
# hanya persistence berpindah dari JSON ke SQLite via SQLAlchemy async.
#
# Prinsip desain:
#   - Setiap operasi yang mengubah state (buy/sell/order) dibungkus dalam
#     satu DB transaction. Jika ada yang gagal di tengah, semua di-rollback.
#   - Method yang bisa dipanggil berkali-kali tanpa side effect (pure query)
#     tidak perlu transaction eksplisit.
#   - Semua kalkulasi avg_cost, locked_shares, cleanup OCO tetap sama
#     dengan portofolio.py asli untuk menghindari regresi.

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import AsyncSessionLocal
from models.portfolio import Holding, Order, PortfolioMeta, TradeHistory, Watchlist

LOT_SIZE = 100
IDX_SUFFIX = ".JK"


def _is_idx(ticker: str) -> bool:
    return ticker.upper().endswith(IDX_SUFFIX)


def _to_shares(lots: int) -> int:
    return lots * LOT_SIZE


def _to_lots(shares: int) -> int:
    return shares // LOT_SIZE


# ── PortfolioService ──────────────────────────────────────────────────────────

class PortfolioService:
    """
    Semua operasi portofolio dalam satu kelas.
    Setiap method menerima AsyncSession sebagai parameter pertama agar
    unit test bisa inject session palsu tanpa menyentuh DB sungguhan.
    """

    # ── Bootstrap ─────────────────────────────────────────────────────────────

    @staticmethod
    async def ensure_meta(db: AsyncSession) -> PortfolioMeta:
        """
        Pastikan baris PortfolioMeta (id=1) selalu ada.
        Dipanggil saat startup — idempoten.
        """
        result = await db.get(PortfolioMeta, 1)
        if result is None:
            meta = PortfolioMeta(id=1)
            db.add(meta)
            await db.commit()
            await db.refresh(meta)
            return meta
        return result

    # ── Summary ───────────────────────────────────────────────────────────────

    @staticmethod
    async def get_summary(db: AsyncSession, prices: dict[str, float]) -> dict:
        """
        Kembalikan ringkasan portofolio: kas, total nilai, floating P&L.
        Realized P&L dihitung dari seluruh history (BUY modal vs SELL hasil).
        """
        meta = await db.get(PortfolioMeta, 1)
        if meta is None:
            return {"cash": 0, "total_value": 0, "floating_pnl": 0, "realized_pnl": 0}

        holdings_result = await db.execute(select(Holding))
        holdings = holdings_result.scalars().all()

        floating = sum(
            (prices.get(h.ticker, h.avg_cost) - h.avg_cost) * h.shares
            for h in holdings
        )
        stock_value = sum(
            prices.get(h.ticker, h.avg_cost) * h.shares
            for h in holdings
        )
        total_value = meta.cash + stock_value

        # Realized P&L = (total kas sekarang + nilai saham) - modal awal
        # Ekuivalen dengan menjumlah semua laba/rugi tiap SELL
        realized = total_value - meta.starting_cash - floating

        return {
            "cash": round(meta.cash, 2),
            "starting_cash": round(meta.starting_cash, 2),
            "total_value": round(total_value, 2),
            "floating_pnl": round(floating, 2),
            "realized_pnl": round(realized, 2),
        }

    # ── Holdings ──────────────────────────────────────────────────────────────

    @staticmethod
    async def get_holdings(db: AsyncSession, prices: dict[str, float]) -> list[dict]:
        result = await db.execute(select(Holding).order_by(Holding.ticker))
        rows = result.scalars().all()
        out = []
        for h in rows:
            cur = prices.get(h.ticker, h.avg_cost)
            market_val = cur * h.shares
            pnl_rp = (cur - h.avg_cost) * h.shares
            pnl_pct = ((cur - h.avg_cost) / h.avg_cost * 100) if h.avg_cost else 0
            out.append({
                "ticker": h.ticker,
                "shares": h.shares,
                "lots": _to_lots(h.shares) if _is_idx(h.ticker) else None,
                "avg_cost": round(h.avg_cost, 2),
                "current_price": round(cur, 2),
                "market_value": round(market_val, 2),
                "pnl_rp": round(pnl_rp, 2),
                "pnl_pct": round(pnl_pct, 2),
                "first_buy": h.first_buy.isoformat() if h.first_buy else None,
            })
        return out

    # ── Buy ───────────────────────────────────────────────────────────────────

    @staticmethod
    async def buy(
        db: AsyncSession,
        ticker: str,
        lots_or_shares: int,
        price: float,
        source: str = "MANUAL",
    ) -> tuple[bool, str]:
        """
        Beli saham. Untuk IDX, lots_or_shares dalam lot (×100 lembar).
        Untuk non-IDX, lots_or_shares dalam lembar langsung.
        Gagal jika kas tidak cukup.
        """
        ticker = ticker.upper().strip()
        is_idx = _is_idx(ticker)
        shares = _to_shares(lots_or_shares) if is_idx else lots_or_shares
        cost = shares * price
        unit_label = (
            f"{lots_or_shares} lot ({shares} lembar)" if is_idx
            else f"{shares} shares"
        )
        symbol = "Rp" if is_idx else "$"

        meta = await db.get(PortfolioMeta, 1)
        if meta is None or meta.cash < cost:
            avail = meta.cash if meta else 0
            return False, (
                f"Dana tidak cukup. Butuh {symbol}{cost:,.0f}, "
                f"saldo {symbol}{avail:,.0f}"
            )

        async with db.begin_nested():
            # Update kas
            meta.cash -= cost

            # Update atau buat holding
            result = await db.execute(
                select(Holding).where(Holding.ticker == ticker)
            )
            holding = result.scalar_one_or_none()

            if holding:
                # Weighted average cost
                new_total = holding.shares + shares
                holding.avg_cost = (
                    holding.avg_cost * holding.shares + cost
                ) / new_total
                holding.shares = new_total
            else:
                holding = Holding(
                    ticker=ticker,
                    shares=shares,
                    avg_cost=price,
                    first_buy=datetime.utcnow(),
                )
                db.add(holding)

            # Catat ke history
            db.add(TradeHistory(
                action="BUY",
                ticker=ticker,
                shares=shares,
                lots=lots_or_shares if is_idx else None,
                price=price,
                total=cost,
                source=source,
                traded_at=datetime.utcnow(),
            ))

        await db.commit()
        return True, f"Beli {unit_label} {ticker} @ {symbol}{price:,.0f}"

    # ── Sell ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def sell(
        db: AsyncSession,
        ticker: str,
        lots_or_shares: int,
        price: float,
        source: str = "MANUAL",
    ) -> tuple[bool, str]:
        """
        Jual saham. Gagal jika tidak punya saham atau jumlah tidak cukup.
        Saat semua saham terjual, baris holding dihapus dan semua order
        yang masih ACTIVE di-cancel (sama dengan portofolio.py asli).
        """
        ticker = ticker.upper().strip()
        is_idx = _is_idx(ticker)
        shares = _to_shares(lots_or_shares) if is_idx else lots_or_shares
        symbol = "Rp" if is_idx else "$"
        unit_label = (
            f"{lots_or_shares} lot ({shares} lembar)" if is_idx
            else f"{shares} shares"
        )

        result = await db.execute(
            select(Holding).where(Holding.ticker == ticker)
        )
        holding = result.scalar_one_or_none()

        if holding is None:
            return False, f"Kamu tidak punya saham {ticker}"
        if holding.shares < shares:
            owned_disp = _to_lots(holding.shares) if is_idx else holding.shares
            unit = "lot" if is_idx else "shares"
            return False, (
                f"Saham tidak cukup. Kamu punya {owned_disp} {unit}"
            )

        proceeds = shares * price

        async with db.begin_nested():
            meta = await db.get(PortfolioMeta, 1)
            meta.cash += proceeds
            holding.shares -= shares

            if holding.shares == 0:
                await db.delete(holding)
                # Cancel semua order aktif untuk ticker ini
                await db.execute(
                    update(Order)
                    .where(Order.ticker == ticker, Order.status == "ACTIVE")
                    .values(status="CANCELLED")
                )
            else:
                # avg_cost tidak berubah saat sell (FIFO tidak dipakai)
                pass

            db.add(TradeHistory(
                action="SELL",
                ticker=ticker,
                shares=shares,
                lots=lots_or_shares if is_idx else None,
                price=price,
                total=proceeds,
                source=source,
                traded_at=datetime.utcnow(),
            ))

        await db.commit()
        return True, f"Jual {unit_label} {ticker} @ {symbol}{price:,.0f}"

    # ── Trade History ─────────────────────────────────────────────────────────

    @staticmethod
    async def get_history(
        db: AsyncSession,
        ticker: Optional[str] = None,
        limit: int = 200,
    ) -> list[dict]:
        q = select(TradeHistory).order_by(TradeHistory.traded_at.desc()).limit(limit)
        if ticker:
            q = q.where(TradeHistory.ticker == ticker.upper().strip())
        result = await db.execute(q)
        rows = result.scalars().all()
        return [
            {
                "id": r.id,
                "action": r.action,
                "ticker": r.ticker,
                "shares": r.shares,
                "lots": r.lots,
                "price": r.price,
                "total": r.total,
                "source": r.source,
                "traded_at": r.traded_at.isoformat(),
            }
            for r in rows
        ]

    # ── Orders ────────────────────────────────────────────────────────────────

    
    @staticmethod
    async def order_add(
        db: AsyncSession,
        ticker: str,
        order_type: str,
        trigger_price: float,
        lots: int,
    ) -> tuple[bool, str]:
        """
        Pasang TP atau SL.
        Validasi sama persis dengan portofolio.py:
          - Ticker harus ada di holdings
          - TP harus di atas avg_cost, SL di bawah
          - Locked shares (sisi TP atau SL mana yang lebih besar)
            tidak boleh melebihi total kepemilikan
        """
        ticker = ticker.upper().strip()
        order_type = order_type.upper()
        shares = _to_shares(lots)
        is_idx = _is_idx(ticker)
        symbol = "Rp" if is_idx else "$"

        result = await db.execute(
            select(Holding).where(Holding.ticker == ticker)
        )
        holding = result.scalar_one_or_none()
        if holding is None:
            return False, f"Kamu tidak punya saham {ticker}"

        # Hitung locked shares untuk OCO validation
        active = await db.execute(
            select(Order).where(
                Order.ticker == ticker,
                Order.status == "ACTIVE",
            )
        )
        active_orders = active.scalars().all()

        tp_locked = sum(o.shares for o in active_orders if o.order_type == "TP")
        sl_locked = sum(o.shares for o in active_orders if o.order_type == "SL")

        if order_type == "TP":
            locked_after = max(tp_locked + shares, sl_locked)
        else:
            locked_after = max(tp_locked, sl_locked + shares)

        if locked_after > holding.shares:
            over = _to_lots(locked_after - holding.shares) if is_idx else locked_after - holding.shares
            unit = "lot" if is_idx else "shares"
            return False, (
                f"Melebihi kepemilikan sebesar {over} {unit}."
            )

        avg_cost = holding.avg_cost
        if order_type == "TP":
            if trigger_price == avg_cost:
                return False, (
                f"Take Profit ({symbol}{trigger_price:,.0f}) sama dengan avg cost — "
                f"tidak ada keuntungan. Gunakan harga di atas {symbol}{avg_cost:,.0f}."
                )
            if trigger_price < avg_cost:
                return False, (
                f"Take Profit ({symbol}{trigger_price:,.0f}) harus lebih tinggi "
                f"dari avg cost ({symbol}{avg_cost:,.0f})."
                )
        elif order_type == "SL":
            if trigger_price == avg_cost:
                return False, (
                f"Stop Loss ({symbol}{trigger_price:,.0f}) sama dengan avg cost — "
                f"tidak ada perlindungan modal. Gunakan harga di bawah {symbol}{avg_cost:,.0f}."
                )
            if trigger_price > avg_cost:
                return False, (
                f"Stop Loss ({symbol}{trigger_price:,.0f}) harus lebih rendah "
                f"dari avg cost ({symbol}{avg_cost:,.0f})."
                )

        oid = str(uuid.uuid4())[:8]
        db.add(Order(
            order_id=oid,
            ticker=ticker,
            order_type=order_type,
            trigger_price=trigger_price,
            lots=lots,
            shares=shares,
            status="ACTIVE",
            created_at=datetime.utcnow(),
        ))
        await db.commit()
        unit = "lot" if is_idx else "shares"
        return True, (
            f"Order {order_type} dipasang: jual {lots} {unit} "
            f"{ticker} saat harga menyentuh {symbol}{trigger_price:,.0f}"
        )

    _CANCELLABLE_STATUSES = {"ACTIVE", "PENDING_CONFIRM"}

    @staticmethod
    async def order_cancel(
        db: AsyncSession, order_id: str
    ) -> tuple[bool, str]:
        """
        Cancel order. Berlaku untuk status ACTIVE dan PENDING_CONFIRM.
        EXECUTED dan CANCELLED sudah final.
        """
        result = await db.execute(
            select(Order).where(Order.order_id == order_id)
        )
        order = result.scalar_one_or_none()

        if order is None:
            return False, f"Order {order_id} tidak ditemukan"

        if order.status not in PortfolioService._CANCELLABLE_STATUSES:
            return False, (
                f"Order {order_id} tidak bisa dibatalkan "
                f"(status saat ini: {order.status})"
            )

        order.status = "CANCELLED"
        await db.commit()
        return True, f"Order {order_id} dibatalkan"

    @staticmethod
    async def get_orders(
        db: AsyncSession,
        ticker: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[dict]:
        q = select(Order).order_by(Order.created_at.desc())
        if ticker:
            q = q.where(Order.ticker == ticker.upper().strip())
        if status:
            q = q.where(Order.status == status.upper())
        result = await db.execute(q)
        rows = result.scalars().all()
        return [
            {
                "order_id": o.order_id,
                "ticker": o.ticker,
                "order_type": o.order_type,
                "trigger_price": o.trigger_price,
                "lots": o.lots,
                "shares": o.shares,
                "status": o.status,
                "created_at": o.created_at.isoformat(),
                "triggered_at": o.triggered_at.isoformat() if o.triggered_at else None,
            }
            for o in rows
        ]

    @staticmethod
    async def get_active_orders_for_check(
        db: AsyncSession,
    ) -> list[Order]:
        """
        Kembalikan ORM objects langsung (bukan dict) agar order_checker
        bisa langsung mengubah status tanpa query ulang.
        """
        result = await db.execute(
            select(Order).where(Order.status == "ACTIVE")
        )
        return result.scalars().all()

    @staticmethod
    async def mark_order_pending(
        db: AsyncSession, order_id: str, current_price: float
    ) -> None:
        """
        Set status order menjadi PENDING_CONFIRM dan catat waktu trigger.
        Dipanggil oleh OrderChecker saat harga menyentuh level TP/SL.
        """
        await db.execute(
            update(Order)
            .where(Order.order_id == order_id)
            .values(
                status="PENDING_CONFIRM",
                triggered_at=datetime.utcnow(),
            )
        )
        await db.commit()

    @staticmethod
    async def confirm_order(
        db: AsyncSession, order_id: str, price: float
    ) -> tuple[bool, str]:
        """
        User mengkonfirmasi eksekusi order dari notifikasi.
        Flow: ambil order → sell → tandai EXECUTED → cancel sisi OCO lawan.
        """
        result = await db.execute(
            select(Order).where(
                Order.order_id == order_id,
                Order.status == "PENDING_CONFIRM",
            )
        )
        order = result.scalar_one_or_none()
        if order is None:
            return False, f"Order {order_id} tidak ditemukan atau sudah diproses"

        # Eksekusi sell
        ok, msg = await PortfolioService.sell(
            db, order.ticker, order.lots, price, source=order.order_type
        )
        if not ok:
            # Kembalikan ke ACTIVE jika sell gagal (misalnya shares berubah)
            order.status = "ACTIVE"
            await db.commit()
            return False, msg

        # Tandai order ini sebagai EXECUTED
        order.status = "EXECUTED"
        order.triggered_at = datetime.utcnow()

        # OCO: cancel sisi lawan yang masih ACTIVE
        opposite = "SL" if order.order_type == "TP" else "TP"
        await db.execute(
            update(Order)
            .where(
                Order.ticker == order.ticker,
                Order.order_type == opposite,
                Order.status == "ACTIVE",
            )
            .values(status="CANCELLED")
        )
        await db.commit()
        return True, msg

    @staticmethod
    async def dismiss_order(
        db: AsyncSession, order_id: str
    ) -> tuple[bool, str]:
        """
        User menolak eksekusi order. Kembalikan ke ACTIVE.
        Ini memungkinkan order untuk terpicu lagi saat harga menyentuh level
        di poll berikutnya — perilaku yang disengaja agar user tidak kehilangan
        kesempatan jika harga terus bergerak melewati level.
        """
        result = await db.execute(
            select(Order).where(
                Order.order_id == order_id,
                Order.status == "PENDING_CONFIRM",
            )
        )
        order = result.scalar_one_or_none()
        if order is None:
            return False, f"Order {order_id} tidak ditemukan"
        order.status = "ACTIVE"
        await db.commit()
        return True, f"Order {order_id} dikembalikan ke ACTIVE"

    # ── Watchlist ─────────────────────────────────────────────────────────────

    @staticmethod
    async def watchlist_add(db: AsyncSession, ticker: str) -> tuple[bool, str]:
        ticker = ticker.upper().strip()
        existing = await db.execute(
            select(Watchlist).where(Watchlist.ticker == ticker)
        )
        if existing.scalar_one_or_none():
            return False, f"{ticker} sudah ada di watchlist"
        # display_order = max + 1 agar selalu di bawah
        max_result = await db.execute(select(Watchlist))
        count = len(max_result.scalars().all())
        db.add(Watchlist(ticker=ticker, display_order=count))
        await db.commit()
        return True, f"{ticker} ditambahkan ke watchlist"

    @staticmethod
    async def watchlist_remove(db: AsyncSession, ticker: str) -> tuple[bool, str]:
        ticker = ticker.upper().strip()
        result = await db.execute(
            select(Watchlist).where(Watchlist.ticker == ticker)
        )
        row = result.scalar_one_or_none()
        if row is None:
            return False, f"{ticker} tidak ada di watchlist"
        await db.delete(row)
        await db.commit()
        return True, f"{ticker} dihapus dari watchlist"

    @staticmethod
    async def get_watchlist(db: AsyncSession) -> list[str]:
        result = await db.execute(
            select(Watchlist).order_by(Watchlist.display_order, Watchlist.ticker)
        )
        return [w.ticker for w in result.scalars().all()]

    # ── Performance metrics ───────────────────────────────────────────────────

    @staticmethod
    async def get_performance(
        db: AsyncSession,
        prices: dict[str, float],
        period: str = "all",
    ) -> dict:
        """
        Hitung metrik performa per ticker.
        Logic sama dengan performance_metrics.py dari PyQt6 app:
        - Replay seluruh history untuk cost basis yang akurat
        - Filter sell dalam periode yang dipilih
        - Hitung win rate, best/worst trade
        """
        result = await db.execute(
            select(TradeHistory).order_by(TradeHistory.traded_at.asc())
        )
        history = result.scalars().all()

        # Tentukan cutoff waktu untuk filter periode
        now = datetime.utcnow()
        if period == "day":
            cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            from datetime import timedelta
            cutoff = (now - timedelta(days=now.weekday())).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
        elif period == "month":
            cutoff = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            cutoff = None

        # Replay inventory untuk cost basis
        inventory: dict[str, dict] = {}
        stats: dict[str, dict] = {}
        trade_results: list[float] = []

        for trade in history:
            ticker = trade.ticker
            shares = float(trade.shares)
            price = float(trade.price)
            inv = inventory.setdefault(ticker, {"shares": 0.0, "avg_cost": 0.0})
            in_period = cutoff is None or trade.traded_at >= cutoff

            if trade.action == "BUY":
                total_shares = inv["shares"] + shares
                if total_shares > 0:
                    inv["avg_cost"] = (
                        inv["avg_cost"] * inv["shares"] + shares * price
                    ) / total_shares
                inv["shares"] = total_shares

                if in_period:
                    s = stats.setdefault(ticker, _empty_stat())
                    s["buy_total"] += shares * price
                    s["trades"] += 1

            elif trade.action == "SELL":
                sell_sh = min(shares, inv["shares"]) if inv["shares"] > 0 else 0.0
                modal = inv["avg_cost"] * sell_sh
                realized = price * sell_sh - modal
                inv["shares"] = max(0.0, inv["shares"] - sell_sh)
                if inv["shares"] == 0:
                    inv["avg_cost"] = 0.0

                if in_period:
                    s = stats.setdefault(ticker, _empty_stat())
                    s["sell_total"] += shares * price
                    s["trades"] += 1
                    s["realized"] += realized
                    s["realized_modal"] += modal
                    trade_results.append(realized)

        # Hitung ringkasan
        for ticker_key, s in stats.items():
            modal = s["realized_modal"]
            s["pnl_rp"] = round(s["realized"], 2)
            s["pnl_pct"] = round(
                (s["realized"] / modal * 100) if modal > 0 else 0.0, 2
            )

        # Floating P&L dari holdings aktif
        hold_result = await db.execute(select(Holding))
        holdings = {h.ticker: h for h in hold_result.scalars().all()}
        floating = sum(
            (prices.get(t, h.avg_cost) - h.avg_cost) * h.shares
            for t, h in holdings.items()
        )

        wins = sum(1 for r in trade_results if r > 0)
        win_rate = (wins / len(trade_results) * 100) if trade_results else 0.0

        return {
            "period": period,
            "by_ticker": stats,
            "per_ticker": stats,
            "floating_pnl": round(floating, 2),
            "total_realized": round(sum(s["pnl_rp"] for s in stats.values()), 2),
            "win_rate": round(win_rate, 2),
            "total_trades": len(trade_results),
            "best_trade": round(max(trade_results), 2) if trade_results else 0,
            "worst_trade": round(min(trade_results), 2) if trade_results else 0,
        }

def _empty_stat() -> dict:
    return {
        "buy_total": 0.0,
        "sell_total": 0.0,
        "trades": 0,
        "realized": 0.0,
        "realized_modal": 0.0,
        "pnl_rp": 0.0,
        "pnl_pct": 0.0,
    }
