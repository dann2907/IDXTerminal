# models/portfolio.py
#
# SQLAlchemy ORM models untuk data portofolio.
#
# Desain schema sengaja flat dan sederhana karena single-user:
# tidak ada kolom user_id, tidak ada foreign key antar tabel kecuali
# yang benar-benar diperlukan untuk integritas.
#
# 4 tabel:
#   portfolio_meta  — kas dan modal awal (selalu 1 baris)
#   holdings        — kepemilikan saham aktif
#   trade_history   — log setiap BUY / SELL (immutable, append-only)
#   orders          — TP / SL aktif / historical
#   watchlist       — daftar ticker yang dipantau

from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Float,
    ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class PortfolioMeta(Base):
    """
    Selalu hanya 1 baris (id=1).
    Menyimpan kas tersedia dan modal awal.
    """
    __tablename__ = "portfolio_meta"

    id             = Column(Integer, primary_key=True, default=1)
    cash           = Column(Float, nullable=False, default=100_000_000.0)
    starting_cash  = Column(Float, nullable=False, default=100_000_000.0)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Holding(Base):
    """
    Satu baris per ticker yang saat ini dipegang.
    Baris dihapus saat shares == 0 (sudah dijual semua).
    avg_cost dihitung ulang setiap kali ada BUY tambahan.
    """
    __tablename__ = "holdings"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    ticker     = Column(String(16), nullable=False, unique=True, index=True)
    shares     = Column(Integer, nullable=False)          # total lembar
    avg_cost   = Column(Float, nullable=False)            # rata-rata harga beli
    first_buy  = Column(DateTime, nullable=True)          # tanggal BUY pertama


class TradeHistory(Base):
    """
    Append-only log setiap transaksi.
    Tidak pernah diubah setelah INSERT — hanya ditambah.
    'lots' adalah turunan dari shares // 100, disimpan untuk kemudahan display.
    'source' membedakan MANUAL vs order yang di-trigger (TP/SL) — untuk Fase 3,
    semua konfirmasi dari user sehingga source bisa "MANUAL" atau "TP"/"SL".
    """
    __tablename__ = "trade_history"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    action     = Column(String(4), nullable=False)        # "BUY" | "SELL"
    ticker     = Column(String(16), nullable=False, index=True)
    shares     = Column(Integer, nullable=False)
    lots       = Column(Integer, nullable=True)           # None untuk non-IDX
    price      = Column(Float, nullable=False)
    total      = Column(Float, nullable=False)            # shares * price
    source     = Column(String(8), nullable=False, default="MANUAL")  # MANUAL/TP/SL
    traded_at  = Column(DateTime, nullable=False, default=datetime.utcnow)


class Order(Base):
    """
    TP (Take Profit) dan SL (Stop Loss) per ticker.
    Status: ACTIVE → PENDING_CONFIRM → EXECUTED | CANCELLED
    PENDING_CONFIRM adalah state baru: order sudah terpicu di backend
    tapi menunggu konfirmasi user sebelum eksekusi.
    """
    __tablename__ = "orders"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    order_id      = Column(String(8), nullable=False, unique=True, index=True)
    ticker        = Column(String(16), nullable=False, index=True)
    order_type    = Column(String(2), nullable=False)     # "TP" | "SL"
    trigger_price = Column(Float, nullable=False)
    lots          = Column(Integer, nullable=False)       # dalam lot (IDX)
    shares        = Column(Integer, nullable=False)       # lots * 100
    status        = Column(String(16), nullable=False, default="ACTIVE")
    created_at    = Column(DateTime, nullable=False, default=datetime.utcnow)
    triggered_at  = Column(DateTime, nullable=True)


class WatchlistCategory(Base):
    """
    Kategori watchlist buatan user.
    Minimal selalu ada 1 kategori default agar flow lama tetap berjalan.
    """
    __tablename__ = "watchlist_categories"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    name          = Column(String(64), nullable=False, unique=True, index=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_default    = Column(Boolean, nullable=False, default=False)
    created_at    = Column(DateTime, nullable=False, default=datetime.utcnow)

    items = relationship(
        "Watchlist",
        back_populates="category",
        cascade="all, delete-orphan",
    )


class Watchlist(Base):
    """
    Daftar ticker yang dipantau user per kategori.
    Satu ticker bisa ada di beberapa kategori berbeda.
    """
    __tablename__ = "watchlist"
    __table_args__ = (
        UniqueConstraint("category_id", "ticker", name="uq_watchlist_category_ticker"),
    )

    id            = Column(Integer, primary_key=True, autoincrement=True)
    ticker        = Column(String(16), nullable=False, index=True)
    category_id   = Column(
        Integer,
        ForeignKey("watchlist_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    display_order = Column(Integer, nullable=False, default=0)
    added_at      = Column(DateTime, nullable=False, default=datetime.utcnow)

    category = relationship("WatchlistCategory", back_populates="items")
