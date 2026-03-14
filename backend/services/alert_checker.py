"""
─────────────────────────────────────────────────────────────────────────────
CHECKER  (backend/services/alert_checker.py)
─────────────────────────────────────────────────────────────────────────────
Dipanggil dari _patch_broadcaster_with_order_check() di main.py,
bersama OrderChecker — ikut ritme DataFetcher setiap ~15 detik.
"""
import asyncio
import logging
from typing import TYPE_CHECKING
 
from db.database import AsyncSessionLocal
from services.alert_service import AlertService

if TYPE_CHECKING:
    from services.ws_broadcaster import WSBroadcaster


logger = logging.getLogger(__name__)
 
 
class AlertChecker:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
 
    def start(self, broadcaster: "WSBroadcaster") -> None:
        self._broadcaster = broadcaster
        logger.info("AlertChecker started")
 
    async def check(self, price_data: dict[str, dict]) -> None:
        """
        price_data: dict[ticker, QuoteData.to_dict()]
        Dicek setiap kali broadcaster.update_cache() dipanggil.
        """
        if not price_data:
            return
 
        async with self._lock:
            async with AsyncSessionLocal() as db:
                alerts = await AlertService.get_active_for_check(db)
                if not alerts:
                    return
 
                for alert in alerts:
                    q = price_data.get(alert.ticker)
                    if q is None:
                        continue
 
                    price      = float(q.get("price", 0))
                    change_pct = float(q.get("change_pct", 0))
                    volume     = int(q.get("volume", 0))
 
                    triggered = False
                    if alert.condition == "above"      and price >= alert.threshold:
                        triggered = True
                    elif alert.condition == "below"    and price <= alert.threshold:
                        triggered = True
                    elif alert.condition == "change_pct" and abs(change_pct) >= alert.threshold:
                        triggered = True
                    elif alert.condition == "volume_spike" and volume >= alert.threshold:
                        triggered = True
 
                    if not triggered:
                        continue
 
                    await AlertService.mark_triggered(db, alert.id)
                    logger.info(
                        "Alert %s triggered: %s %s %.2f (price=%.0f chg=%.2f%%)",
                        alert.id, alert.ticker, alert.condition,
                        alert.threshold, price, change_pct,
                    )
 
                    symbol = "Rp" if alert.ticker.endswith(".JK") else "$"
                    await self._broadcaster.broadcast({
                        "type": "alert_triggered",
                        "data": {
                            "id":        alert.id,
                            "ticker":    alert.ticker,
                            "condition": alert.condition,
                            "threshold": alert.threshold,
                            "price":     price,
                            "symbol":    symbol,
                            "note":      alert.note or "",
                            "message":   _fmt_message(alert, price, change_pct, volume, symbol),
                        },
                    })
 
 
def _fmt_message(alert, price: float, change_pct: float, volume: int, symbol: str) -> str:
    sym = alert.ticker.replace(".JK", "")
    if alert.condition == "above":
        return f"{sym} menyentuh {symbol}{price:,.0f} (target ≥ {symbol}{alert.threshold:,.0f})"
    if alert.condition == "below":
        return f"{sym} turun ke {symbol}{price:,.0f} (target ≤ {symbol}{alert.threshold:,.0f})"
    if alert.condition == "change_pct":
        sign = "+" if change_pct >= 0 else ""
        return f"{sym} bergerak {sign}{change_pct:.2f}% (threshold {alert.threshold:.1f}%)"
    if alert.condition == "volume_spike":
        return f"{sym} volume {volume:,} lembar (threshold {int(alert.threshold):,})"
    return f"Alert {alert.condition} {alert.ticker} terpicu"
