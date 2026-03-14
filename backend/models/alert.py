"""
models/alert.py + services/alert_service.py + services/alert_checker.py
 
Alert adalah notifikasi one-shot ketika kondisi harga/volume terpenuhi.
Berbeda dari Order TP/SL — alert tidak melakukan transaksi, hanya notifikasi.
 
Kondisi yang didukung:
  above       — harga >= threshold
  below       — harga <= threshold
  change_pct  — |change_pct| >= threshold (kenaikan/penurunan besar)
  volume_spike— volume hari ini >= threshold * volume rata-rata (kasar)
 
Setelah alert terpicu, status berubah ke TRIGGERED dan tidak bisa terpicu lagi.
User bisa buat alert baru untuk kondisi yang sama.
 
─────────────────────────────────────────────────────────────────────────────
MODEL  (backend/models/alert.py)
─────────────────────────────────────────────────────────────────────────────
"""
import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, String
from db.database import Base
 
 
class Alert(Base):
    """
    Satu baris per alert yang dipasang user.
    Setelah terpicu, is_active=False sehingga tidak di-cek lagi.
    """
    __tablename__ = "alerts"
 
    id          = Column(String(36), primary_key=True,
                         default=lambda: str(uuid.uuid4())[:8])
    ticker      = Column(String(16), nullable=False, index=True)
    condition   = Column(String(16), nullable=False)   # above|below|change_pct|volume_spike
    threshold   = Column(Float, nullable=False)
    note        = Column(String(200), nullable=True)   # catatan user opsional
    is_active   = Column(Boolean, nullable=False, default=True)
    triggered_at= Column(DateTime, nullable=True)
    created_at  = Column(DateTime, nullable=False, default=datetime.utcnow)
