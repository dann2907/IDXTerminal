# backend/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from db.database import get_db

router = APIRouter()


class RegisterBody(BaseModel):
    username: str
    email: str
    password: str


@router.post("/register", status_code=201)
async def register(body: RegisterBody, db: AsyncSession = Depends(get_db)):
    # TODO: delegate to AuthService
    return {"message": "User created"}


@router.post("/login")
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    # TODO: delegate to AuthService — returns JWT
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Auth not yet implemented")


@router.get("/me")
async def me():
    # TODO: decode JWT from header
    return {"message": "authenticated"}
