"""
services/auth_service.py

Local auth with bcrypt password hashing and JWT access tokens.
Fase 5 update: token revocation, brute force protection, change password.
"""

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User, RevokedToken

logger = logging.getLogger(__name__)

# Config
_SECRET_KEY: str = os.environ.get(
    "IDX_JWT_SECRET",
    "CHANGE_ME_in_production_use_32_random_bytes",
)
_ALGORITHM = "HS256"
_ACCESS_TOKEN_TTL = 60 * 24 * 7  # 7 days in minutes
_BCRYPT_MAX_BYTES = 72

# Brute force protection (simple in-memory)
# Format: {username: {"count": int, "blocked_until": datetime}}
_login_attempts: dict[str, dict] = {}
_MAX_ATTEMPTS = 5
_LOCKOUT_MINUTES = 15


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
    """Create a JWT access token with expiry and unique JTI."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "username": username,
        "iat": now,
        "exp": now + timedelta(minutes=_ACCESS_TOKEN_TTL),
        "jti": str(uuid.uuid4()),
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
        Register a new user with validation.
        """
        username = username.strip()
        email = email.strip().lower()

        if len(username) < 3:
            return False, "Username minimal 3 karakter."
        if len(password) < 8:
            return False, "Password minimal 8 karakter."
        if "@" not in email:
            return False, "Format email tidak valid."

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
        Login with brute force protection.
        """
        username = username.strip()
        now = datetime.now(timezone.utc)

        # Check lockout
        if username in _login_attempts:
            attempt = _login_attempts[username]
            if attempt["blocked_until"] > now:
                diff = int((attempt["blocked_until"] - now).total_seconds() / 60)
                return None, f"Akun terkunci. Coba lagi dalam {max(1, diff)} menit."

        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()

        if user is None or not _verify_password(password, user.hashed_pw):
            # Failed attempt
            if username not in _login_attempts:
                _login_attempts[username] = {"count": 0, "blocked_until": now}
            
            _login_attempts[username]["count"] += 1
            if _login_attempts[username]["count"] >= _MAX_ATTEMPTS:
                _login_attempts[username]["blocked_until"] = now + timedelta(minutes=_LOCKOUT_MINUTES)
                return None, f"Terlalu banyak percobaan. Terkunci {_LOCKOUT_MINUTES} menit."
            
            remaining = _MAX_ATTEMPTS - _login_attempts[username]["count"]
            return None, f"Username atau password salah. Sisa {remaining} percobaan."

        # Success: reset attempts
        if username in _login_attempts:
            del _login_attempts[username]

        token = create_access_token(user.id, user.username)
        logger.info("User logged in: %s", user.username)
        return token, ""

    @staticmethod
    async def logout(db: AsyncSession, token: str) -> bool:
        """Revoke a token by adding its JTI to the blacklist."""
        try:
            payload = decode_access_token(token)
            jti = payload.get("jti")
            exp = payload.get("exp")
            if not jti or not exp:
                return False
            
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
            revoked = RevokedToken(jti=jti, expires_at=expires_at)
            db.add(revoked)
            await db.commit()
            
            # Cleanup old revoked tokens occasionally
            await db.execute(delete(RevokedToken).where(RevokedToken.expires_at < datetime.now(timezone.utc)))
            await db.commit()
            
            return True
        except Exception:
            logger.exception("Failed to logout/revoke token")
            return False

    @staticmethod
    async def change_password(
        db: AsyncSession,
        user: User,
        old_password: str,
        new_password: str,
    ) -> tuple[bool, str]:
        """Verify old password and update to new one."""
        if not _verify_password(old_password, user.hashed_pw):
            return False, "Password lama salah."
        
        if len(new_password) < 8:
            return False, "Password baru minimal 8 karakter."
        
        try:
            user.hashed_pw = _hash_password(new_password)
            db.add(user)
            await db.commit()
            return True, "Password berhasil diubah."
        except Exception:
            await db.rollback()
            return False, "Gagal mengubah password."

    @staticmethod
    async def get_user_from_token(
        db: AsyncSession,
        token: str,
    ) -> Optional[User]:
        """
        Verify JWT and check if it's revoked.
        """
        try:
            payload = decode_access_token(token)
            jti = payload.get("jti")
            if not jti:
                return None
            
            # Check revocation
            rev_res = await db.execute(select(RevokedToken).where(RevokedToken.jti == jti))
            if rev_res.scalar_one_or_none():
                return None

            user_id: str = payload["sub"]
            return await db.get(User, user_id)
        except (JWTError, KeyError):
            return None
