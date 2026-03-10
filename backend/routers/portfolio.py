# backend/routers/portfolio.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db

router = APIRouter()


@router.get("/")
async def get_portfolio(db: AsyncSession = Depends(get_db)):
    # TODO: load from DB by current user
    return {"holdings": {}, "cash": 100_000_000, "watchlist": [], "orders": {}}


@router.post("/buy")
async def buy(body: dict, db: AsyncSession = Depends(get_db)):
    # body: {ticker, lots, price}
    return {"ok": True, "message": "TODO"}


@router.post("/sell")
async def sell(body: dict, db: AsyncSession = Depends(get_db)):
    return {"ok": True, "message": "TODO"}


@router.post("/reset")
async def reset(db: AsyncSession = Depends(get_db)):
    return {"ok": True}


@router.get("/history")
async def get_history(db: AsyncSession = Depends(get_db)):
    return []


@router.post("/orders")
async def add_order(body: dict, db: AsyncSession = Depends(get_db)):
    return {"ok": True}


@router.delete("/orders/{order_id}")
async def cancel_order(order_id: str, db: AsyncSession = Depends(get_db)):
    return {"ok": True}
