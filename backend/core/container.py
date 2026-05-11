# backend/core/container.py
# Central container for service singletons.

from services.ticker_registry import TickerRegistry
from services.ws_broadcaster import WSBroadcaster
from services.data_fetcher import DataFetcher
from services.order_checker import OrderChecker
from services.alert_checker import AlertChecker

# ── Singletons ────────────────────────────────────────────────────────────────

registry      = TickerRegistry()
broadcaster   = WSBroadcaster()
fetcher       = DataFetcher()
order_checker = OrderChecker()
alert_checker = AlertChecker()
