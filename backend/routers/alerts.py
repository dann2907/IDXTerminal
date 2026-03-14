# backend/routers/alerts.py  (full implementation)
#
# Endpoint:
#   GET    /api/alerts           — daftar alert
#   POST   /api/alerts           — buat alert baru
#   DELETE /api/alerts/{id}      — hapus alert
#
# ─────────────────────────────────────────────────────────────────────────────
# backend/routers/export.py  (file terpisah, disatukan di sini untuk review)
#
# Endpoint export portfolio ke CSV:
#   GET /api/export/history.csv   — riwayat transaksi
#   GET /api/export/holdings.csv  — holdings saat ini
#
# CSV dipilih karena:
#   - Tidak butuh library tambahan (stdlib csv)
#   - Bisa dibuka langsung di Excel/Numbers/Sheets
#   - Untuk XLSX murni butuh openpyxl yang berat; user bisa import CSV ke Excel

import csv
import io
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import AsyncSessionLocal, get_db
from models.portfolio import Holding, TradeHistory
from services.alert_service import AlertService

logger = logging.getLogger(__name__)

# ── Alerts router ─────────────────────────────────────────────────────────────

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class AlertCreateBody(BaseModel):
    ticker:    str
    condition: str = Field(..., pattern=r"^(above|below|change_pct|volume_spike)$")
    threshold: float = Field(..., gt=0)
    note:      Optional[str] = Field(None, max_length=200)


@router.get("")
async def list_alerts(
    ticker:      Optional[str] = Query(None),
    active_only: bool          = Query(False),
    db:          AsyncSession  = Depends(get_db),
) -> JSONResponse:
    """Daftar alert. Filter optional per ticker dan active_only."""
    data = await AlertService.list_alerts(db, ticker=ticker, active_only=active_only)
    return JSONResponse(data)


@router.post("", status_code=201)
async def create_alert(
    body: AlertCreateBody,
    db:   AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Pasang alert baru."""
    ok, msg = await AlertService.create(
        db,
        ticker=body.ticker,
        condition=body.condition,
        threshold=body.threshold,
        note=body.note,
    )
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return JSONResponse({"ok": True, "message": msg}, status_code=201)


@router.delete("/{alert_id}")
async def delete_alert(
    alert_id: str,
    db:       AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Hapus alert."""
    ok, msg = await AlertService.delete(db, alert_id)
    if not ok:
        raise HTTPException(status_code=404, detail=msg)
    return JSONResponse({"ok": True, "message": msg})


# ── Export router ─────────────────────────────────────────────────────────────

export_router = APIRouter(prefix="/api/export", tags=["export"])


@export_router.get("/history.csv")
async def export_history() -> StreamingResponse:
    """
    Download riwayat transaksi sebagai CSV.
    Langsung streamable — tidak perlu simpan file sementara.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TradeHistory).order_by(TradeHistory.traded_at.desc())
        )
        rows = result.scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "action", "ticker", "shares", "lots", "price", "total", "source", "traded_at"])
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
    """Download holdings saat ini sebagai CSV."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Holding).order_by(Holding.ticker)
        )
        rows = result.scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["ticker", "shares", "lots", "avg_cost"])
    for r in rows:
        lots = r.shares // 100 if r.ticker.endswith(".JK") else ""
        writer.writerow([r.ticker, r.shares, lots, r.price if hasattr(r, "price") else r.avg_cost])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=holdings.csv"},
    )