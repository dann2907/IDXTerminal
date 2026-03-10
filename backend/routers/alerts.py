# backend/routers/alerts.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db

router = APIRouter()


@router.get("/")
async def list_alerts(db: AsyncSession = Depends(get_db)):
    return []


@router.post("/", status_code=201)
async def create_alert(body: dict, db: AsyncSession = Depends(get_db)):
    # body: {ticker, condition, threshold}
    # conditions: "above" | "below" | "change_pct" | "volume_spike"
    return {"ok": True}


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str, db: AsyncSession = Depends(get_db)):
    return {"ok": True}
