# models/__init__.py
# Import models di sini agar SQLAlchemy metadata ter-register saat init_db() dipanggil.
# Uncomment seiring model dibuat:

from .user import User  # noqa: F401
# from .portfolio import Portfolio, Holding, TradeHistory, Order  # Fase 3
# from .alert import Alert                                         # Fase 3