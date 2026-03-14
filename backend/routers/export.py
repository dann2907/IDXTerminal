# backend/routers/export.py
#
# Endpoint export portfolio ke CSV.
#   GET /api/export/history.csv   — riwayat transaksi
#   GET /api/export/holdings.csv  — holdings saat ini + avg cost
#
# FIX: versi sebelumnya pakai `r.price if hasattr(r, "price") else r.avg_cost`
# yang tidak perlu — Holding tidak punya kolom price, hanya avg_cost.

import csv
import io

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from db.database import AsyncSessionLocal
from models.portfolio import Holding, TradeHistory

export_router = APIRouter(prefix="/api/export", tags=["export"])


@export_router.get("/history.csv")
async def export_history() -> StreamingResponse:
    """
    Download riwayat transaksi sebagai CSV.
    Kolom: id, action, ticker, shares, lots, price, total, source, traded_at
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TradeHistory).order_by(TradeHistory.traded_at.desc())
        )
        rows = result.scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "action", "ticker", "shares", "lots",
        "price", "total", "source", "traded_at",
    ])
    for r in rows:
        writer.writerow([
            r.id, r.action, r.ticker, r.shares,
            r.lots if r.lots is not None else "",
            r.price, r.total, r.source,
            r.traded_at.isoformat(),
        ])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=history.csv"},
    )


@export_router.get("/holdings.csv")
async def export_holdings() -> StreamingResponse:
    """
    Download holdings saat ini sebagai CSV.
    Kolom: ticker, shares, lots, avg_cost

    FIX: pakai r.avg_cost langsung — Holding tidak punya kolom price.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Holding).order_by(Holding.ticker)
        )
        rows = result.scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["ticker", "shares", "lots", "avg_cost"])
    for r in rows:
        # Lots hanya relevan untuk saham IDX (.JK)
        lots = r.shares // 100 if r.ticker.endswith(".JK") else ""
        writer.writerow([r.ticker, r.shares, lots, r.avg_cost])  # FIX: r.avg_cost

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=holdings.csv"},
    )