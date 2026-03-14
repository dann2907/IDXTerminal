"""
─────────────────────────────────────────────────────────────────────────────
SERVICE  (backend/services/alert_service.py)
─────────────────────────────────────────────────────────────────────────────
"""
import logging
from datetime import datetime
from typing import Optional, TYPE_CHECKING
 
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.alert import Alert
 
if TYPE_CHECKING:
    from services.ws_broadcaster import WSBroadcaster
 
logger = logging.getLogger(__name__)
 
_VALID_CONDITIONS = {"above", "below", "change_pct", "volume_spike"}
 
 
class AlertService:
 
    @staticmethod
    async def create(
        db: AsyncSession,
        ticker: str,
        condition: str,
        threshold: float,
        note: Optional[str] = None,
    ) -> tuple[bool, str]:
        """Pasang alert baru."""
        ticker    = ticker.upper().strip()
        condition = condition.lower().strip()
 
        if condition not in _VALID_CONDITIONS:
            return False, f"Kondisi tidak valid: {condition}. Pilih: {', '.join(_VALID_CONDITIONS)}"
        if threshold <= 0:
            return False, "Threshold harus lebih dari 0."
 
        # Cegah duplikat alert aktif yang identik
        dup = await db.execute(
            select(Alert).where(
                Alert.ticker    == ticker,
                Alert.condition == condition,
                Alert.threshold == threshold,
                Alert.is_active == True,   # noqa: E712
            )
        )
        if dup.scalar_one_or_none():
            return False, "Alert identik sudah aktif."
 
        db.add(Alert(
            ticker=ticker,
            condition=condition,
            threshold=threshold,
            note=note or "",
        ))
        await db.commit()
        return True, f"Alert dipasang: {ticker} {condition} {threshold}"
 
    @staticmethod
    async def delete(db: AsyncSession, alert_id: str) -> tuple[bool, str]:
        """Hapus alert (aktif maupun sudah terpicu)."""
        result = await db.execute(select(Alert).where(Alert.id == alert_id))
        alert  = result.scalar_one_or_none()
        if alert is None:
            return False, f"Alert {alert_id} tidak ditemukan."
        await db.delete(alert)
        await db.commit()
        return True, f"Alert {alert_id} dihapus."
 
    @staticmethod
    async def list_alerts(
        db: AsyncSession,
        ticker: Optional[str] = None,
        active_only: bool = False,
    ) -> list[dict]:
        q = select(Alert).order_by(Alert.created_at.desc())
        if ticker:
            q = q.where(Alert.ticker == ticker.upper().strip())
        if active_only:
            q = q.where(Alert.is_active == True)   # noqa: E712
        rows = (await db.execute(q)).scalars().all()
        return [
            {
                "id":           a.id,
                "ticker":       a.ticker,
                "condition":    a.condition,
                "threshold":    a.threshold,
                "note":         a.note,
                "is_active":    a.is_active,
                "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
                "created_at":   a.created_at.isoformat(),
            }
            for a in rows
        ]
 
    @staticmethod
    async def get_active_for_check(db: AsyncSession) -> list:
        """Kembalikan semua alert aktif sebagai ORM objects."""
        result = await db.execute(
            select(Alert).where(Alert.is_active == True)   # noqa: E712
        )
        return result.scalars().all()
 
    @staticmethod
    async def mark_triggered(db: AsyncSession, alert_id: str) -> None:
        await db.execute(
            update(Alert)
            .where(Alert.id == alert_id)
            .values(is_active=False, triggered_at=datetime.utcnow())
        )
        await db.commit()
