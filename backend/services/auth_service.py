"""
services/auth_service.py

Local auth with bcrypt password hashing and JWT access tokens.
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User

logger = logging.getLogger(__name__)

# Config
# SECRET_KEY is read from env; the fallback is for local dev only.
_SECRET_KEY: str = os.environ.get(
    "IDX_JWT_SECRET",
    "CHANGE_ME_in_production_use_32_random_bytes",
)
_ALGORITHM = "HS256"
_ACCESS_TOKEN_TTL = 60 * 24 * 7  # 7 days in minutes
_BCRYPT_MAX_BYTES = 72


def _hash_password(plain: str) -> str:
    plain_bytes = plain.encode("utf-8")
    if len(plain_bytes) > _BCRYPT_MAX_BYTES:
        raise ValueError(
            f"Password terlalu panjang. Maksimal {_BCRYPT_MAX_BYTES} byte."
        )
    return bcrypt.hashpw(plain_bytes, bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    try:
        plain_bytes = plain.encode("utf-8")
        if len(plain_bytes) > _BCRYPT_MAX_BYTES:
            return False
        return bcrypt.checkpw(plain_bytes, hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: str, username: str) -> str:
    """Create a JWT access token with expiry."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "username": username,
        "iat": now,
        "exp": now + timedelta(minutes=_ACCESS_TOKEN_TTL),
    }
    return jwt.encode(payload, _SECRET_KEY, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT, raising JWTError when invalid."""
    return jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])


class AuthService:
    @staticmethod
    async def register(
        db: AsyncSession,
        username: str,
        email: str,
        password: str,
    ) -> tuple[bool, str]:
        """
        Register a new user.
        Returns (True, "") on success, or (False, error_message) on failure.
        """
        username = username.strip()
        email = email.strip().lower()

        if len(username) < 3:
            return False, "Username minimal 3 karakter."
        if len(password) < 8:
            return False, "Password minimal 8 karakter."

        dup_u = await db.execute(select(User).where(User.username == username))
        if dup_u.scalar_one_or_none():
            return False, f"Username '{username}' sudah dipakai."

        dup_e = await db.execute(select(User).where(User.email == email))
        if dup_e.scalar_one_or_none():
            return False, "Email sudah terdaftar."

        try:
            hashed_pw = _hash_password(password)
        except ValueError as exc:
            return False, str(exc)

        user = User(username=username, email=email, hashed_pw=hashed_pw)
        db.add(user)

        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            return False, "Username atau email sudah terdaftar."
        except OperationalError as exc:
            await db.rollback()
            logger.exception("Failed to register user")
            if "readonly" in str(exc).lower():
                return False, "Database tidak bisa ditulis. Periksa izin folder data aplikasi."
            return False, "Registrasi gagal karena database sedang bermasalah."
        except Exception:
            await db.rollback()
            logger.exception("Failed to register user")
            return False, "Registrasi gagal. Coba lagi beberapa saat lagi."

        logger.info("User registered: %s", username)
        return True, ""

    @staticmethod
    async def login(
        db: AsyncSession,
        username: str,
        password: str,
    ) -> tuple[Optional[str], str]:
        """
        Login with username + password.
        Returns (token, "") on success, or (None, error_message) on failure.
        """
        result = await db.execute(select(User).where(User.username == username.strip()))
        user = result.scalar_one_or_none()

        if user is None or not _verify_password(password, user.hashed_pw):
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
        Verify a JWT and return the ORM user object.
        Returns None if the token is invalid or expired.
        """
        try:
            payload = decode_access_token(token)
            user_id: str = payload["sub"]
        except (JWTError, KeyError):
            return None

        return await db.get(User, user_id)
