"""
services/auth_service.py

Autentikasi lokal: bcrypt password hashing + JWT access token.
Single-user app — tidak ada role/permission system.

Deps (tambah ke requirements.txt):
  python-jose[cryptography]>=3.3
  passlib[bcrypt]>=1.7
"""
import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
# SECRET_KEY dibaca dari env; fallback ke random bytes hanya untuk dev.
# Production: set IDX_JWT_SECRET di environment.
_SECRET_KEY: str = os.environ.get(
    "IDX_JWT_SECRET",
    "CHANGE_ME_in_production_use_32_random_bytes",
)
_ALGORITHM        = "HS256"
_ACCESS_TOKEN_TTL = 60 * 24 * 7  # 7 hari (dalam menit)

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def _verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)


def create_access_token(user_id: str, username: str) -> str:
    """Buat JWT access token dengan expiry."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "username": username,
        "iat": now,
        "exp": now + timedelta(minutes=_ACCESS_TOKEN_TTL),
    }
    return jwt.encode(payload, _SECRET_KEY, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode dan verifikasi JWT.
    Raise JWTError jika invalid atau expired.
    """
    return jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])


# ── AuthService ───────────────────────────────────────────────────────────────

class AuthService:

    @staticmethod
    async def register(
        db: AsyncSession,
        username: str,
        email: str,
        password: str,
    ) -> tuple[bool, str]:
        """
        Daftarkan user baru.
        Return (True, "") jika berhasil, (False, pesan_error) jika gagal.
        """
        username = username.strip()
        email    = email.strip().lower()

        if len(username) < 3:
            return False, "Username minimal 3 karakter."
        if len(password) < 8:
            return False, "Password minimal 8 karakter."

        # Cek duplikat username
        dup_u = await db.execute(select(User).where(User.username == username))
        if dup_u.scalar_one_or_none():
            return False, f"Username '{username}' sudah dipakai."

        # Cek duplikat email
        dup_e = await db.execute(select(User).where(User.email == email))
        if dup_e.scalar_one_or_none():
            return False, "Email sudah terdaftar."

        user = User(
            username=username,
            email=email,
            hashed_pw=_hash_password(password),
        )
        db.add(user)
        await db.commit()
        logger.info("User registered: %s", username)
        return True, ""

    @staticmethod
    async def login(
        db: AsyncSession,
        username: str,
        password: str,
    ) -> tuple[Optional[str], str]:
        """
        Login dengan username + password.
        Return (token, "") jika berhasil, (None, pesan_error) jika gagal.
        """
        result = await db.execute(select(User).where(User.username == username.strip()))
        user = result.scalar_one_or_none()

        if user is None or not _verify_password(password, user.hashed_pw):
            # Pesan yang sama untuk keduanya — hindari username enumeration
            return None, "Username atau password salah."

        token = create_access_token(user.id, user.username)
        logger.info("User logged in: %s", user.username)
        return token, ""

    @staticmethod
    async def get_user_from_token(
        db: AsyncSession,
        token: str,
    ) -> Optional[User]:
        """
        Verifikasi JWT dan kembalikan User ORM object.
        Return None jika token invalid/expired.
        """
        try:
            payload = decode_access_token(token)
            user_id: str = payload["sub"]
        except (JWTError, KeyError):
            return None

        return await db.get(User, user_id)