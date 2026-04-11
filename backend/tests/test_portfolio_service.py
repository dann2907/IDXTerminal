import sys
import tempfile
import unittest
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from models.portfolio import Base, Holding, Order  # noqa: E402
import services.order_checker as order_checker_module  # noqa: E402
from services.order_checker import OrderChecker  # noqa: E402
from services.portfolio_service import PortfolioService  # noqa: E402


class FakeBroadcaster:
    def __init__(self) -> None:
        self.messages: list[dict] = []

    async def broadcast(self, payload: dict) -> None:
        self.messages.append(payload)


class PortfolioServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self._tmpdir.name) / "test.db"
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
        self.SessionLocal = async_sessionmaker(self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with self.SessionLocal() as db:
            await PortfolioService.ensure_meta(db)

    async def asyncTearDown(self) -> None:
        await self.engine.dispose()
        self._tmpdir.cleanup()

    async def test_partial_sell_keeps_avg_cost_and_realizes_correct_pnl(self) -> None:
        async with self.SessionLocal() as db:
            ok, _ = await PortfolioService.buy(db, "AAPL", 100, 100.0)
            self.assertTrue(ok)
            ok, _ = await PortfolioService.buy(db, "AAPL", 100, 120.0)
            self.assertTrue(ok)
            ok, _ = await PortfolioService.sell(db, "AAPL", 50, 150.0)
            self.assertTrue(ok)

            holding = await db.scalar(select(Holding).where(Holding.ticker == "AAPL"))
            self.assertIsNotNone(holding)
            assert holding is not None
            self.assertEqual(holding.shares, 150)
            self.assertAlmostEqual(holding.avg_cost, 110.0)

            summary = await PortfolioService.get_summary(db, {})
            self.assertAlmostEqual(summary["floating_pnl"], 0.0)
            self.assertAlmostEqual(summary["realized_pnl"], 2000.0)

    async def test_manual_full_exit_cancels_existing_orders(self) -> None:
        async with self.SessionLocal() as db:
            ok, _ = await PortfolioService.buy(db, "BBCA.JK", 10, 1000.0)
            self.assertTrue(ok)
            ok, _ = await PortfolioService.order_add(db, "BBCA.JK", "TP", 1200.0, 10)
            self.assertTrue(ok)

            ok, _ = await PortfolioService.sell(db, "BBCA.JK", 10, 1100.0)
            self.assertTrue(ok)

            holding = await db.scalar(select(Holding).where(Holding.ticker == "BBCA.JK"))
            self.assertIsNone(holding)

            orders = (
                await db.execute(select(Order).where(Order.ticker == "BBCA.JK"))
            ).scalars().all()
            self.assertEqual(len(orders), 1)
            self.assertEqual(orders[0].status, "CANCELLED")

    async def test_order_checker_allows_only_one_pending_per_ticker(self) -> None:
        async with self.SessionLocal() as db:
            ok, _ = await PortfolioService.buy(db, "BBCA.JK", 2, 1000.0)
            self.assertTrue(ok)
            ok, _ = await PortfolioService.order_add(db, "BBCA.JK", "TP", 1100.0, 1)
            self.assertTrue(ok)
            ok, _ = await PortfolioService.order_add(db, "BBCA.JK", "TP", 1150.0, 1)
            self.assertTrue(ok)

        fake_broadcaster = FakeBroadcaster()
        checker = OrderChecker()
        checker.start(fake_broadcaster)

        original_session_local = order_checker_module.AsyncSessionLocal
        order_checker_module.AsyncSessionLocal = self.SessionLocal
        try:
            await checker.check({"BBCA.JK": 1200.0})
            await checker.check({"BBCA.JK": 1200.0})
        finally:
            order_checker_module.AsyncSessionLocal = original_session_local

        async with self.SessionLocal() as db:
            orders = (
                await db.execute(
                    select(Order).where(Order.ticker == "BBCA.JK").order_by(Order.order_id)
                )
            ).scalars().all()

        statuses = sorted(order.status for order in orders)
        self.assertEqual(statuses, ["ACTIVE", "PENDING_CONFIRM"])
        self.assertEqual(len(fake_broadcaster.messages), 1)
        self.assertEqual(fake_broadcaster.messages[0]["type"], "order_triggered")

    async def test_watchlist_supports_multiple_categories_for_same_ticker(self) -> None:
        async with self.SessionLocal() as db:
            default_category = await PortfolioService.ensure_default_watchlist_category(db)
            ok, _, category = await PortfolioService.create_watchlist_category(db, "Saham Gold")
            self.assertTrue(ok)
            assert category is not None

            ok, _ = await PortfolioService.watchlist_add(db, "ANTM.JK", default_category.id)
            self.assertTrue(ok)
            ok, _ = await PortfolioService.watchlist_add(db, "ANTM.JK", category["id"])
            self.assertTrue(ok)

            grouped = await PortfolioService.get_watchlist_categories(db)
            antr = {
                item["ticker"]
                for group in grouped
                if group["name"] in {"Watchlist Utama", "Saham Gold"}
                for item in group["tickers"]
            }
            self.assertEqual(antr, {"ANTM.JK"})

            tickers = await PortfolioService.get_watchlist_tickers(db)
            self.assertEqual(tickers, ["ANTM.JK"])

    async def test_watchlist_remove_only_affects_selected_category(self) -> None:
        async with self.SessionLocal() as db:
            default_category = await PortfolioService.ensure_default_watchlist_category(db)
            ok, _, category = await PortfolioService.create_watchlist_category(db, "Dividend")
            self.assertTrue(ok)
            assert category is not None

            await PortfolioService.watchlist_add(db, "BBCA.JK", default_category.id)
            await PortfolioService.watchlist_add(db, "BBCA.JK", category["id"])

            ok, _ = await PortfolioService.watchlist_remove(db, "BBCA.JK", category["id"])
            self.assertTrue(ok)

            grouped = await PortfolioService.get_watchlist_categories(db)
            default_items = next(
                group["tickers"]
                for group in grouped
                if group["id"] == default_category.id
            )
            dividend_items = next(
                group["tickers"]
                for group in grouped
                if group["id"] == category["id"]
            )
            self.assertEqual([item["ticker"] for item in default_items], ["BBCA.JK"])
            self.assertEqual(dividend_items, [])


if __name__ == "__main__":
    unittest.main()
