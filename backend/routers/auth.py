# backend/routers/auth.py
#
# Endpoint autentikasi:
#   POST /auth/register  — daftar user baru
#   POST /auth/login     — login, return JWT
#   GET  /auth/me        — info user yang sedang login

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from services.auth_service import AuthService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# OAuth2 scheme — frontend kirim token sebagai Bearer di Authorization header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterBody(BaseModel):
    username: str
    email:    str
    password: str


# ── Dependency: current user ──────────────────────────────────────────────────

async def get_current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)],
    db:    AsyncSession = Depends(get_db),
):
    """
    FastAPI dependency — inject ke endpoint yang butuh autentikasi.
    Raise 401 jika token tidak ada atau tidak valid.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak ditemukan. Login terlebih dahulu.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = await AuthService.get_user_from_token(db, token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau sudah expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
async def register(
    body: RegisterBody,
    db:   AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Daftar user baru. App single-user — registrasi hanya boleh sekali."""
    ok, msg = await AuthService.register(db, body.username, body.email, body.password)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return JSONResponse({"ok": True, "message": "Registrasi berhasil."}, status_code=201)


@router.post("/login")
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db:   AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Login dengan username + password. Return JWT access token."""
    token, err = await AuthService.login(db, form.username, form.password)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err,
            headers={"WWW-Authenticate": "Bearer"},
        )
    return JSONResponse({
        "access_token": token,
        "token_type":   "bearer",
    })


@router.get("/me")
async def me(
    user=Depends(get_current_user),
) -> JSONResponse:
    """Info user yang sedang login (dari JWT)."""
    return JSONResponse({
        "id":         user.id,
        "username":   user.username,
        "email":      user.email,
        "created_at": user.created_at.isoformat(),
    })