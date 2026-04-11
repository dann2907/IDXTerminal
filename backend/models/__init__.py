# backend/models/__init__.py
#
# Import semua model agar SQLAlchemy metadata ter-register saat init_db().
# Fase 5: tambah Alert import.

from .user      import User    # noqa: F401
from .portfolio import (       # noqa: F401
    Holding, Order, PortfolioMeta, TradeHistory, Watchlist,
    WatchlistCategory,
)
from .alert     import Alert   # noqa: F401  ← Fase 5
