from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.permissions import current_user, permissions_for
from app.core.security import create_token, verify_password
from app.db import get_conn

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    identifier: str  # email or student_code
    password: str


import re
from pydantic import Field


class ProfileUpdateIn(BaseModel):
    phone_e164: str | None = Field(default=None, max_length=16)


async def _profile(conn, user_id: int) -> dict | None:
    row = await conn.fetchrow(
        """SELECT u.id, u.role, u.campus_id, u.name, u.email, u.student_code, u.phone_e164,
                  ca.name AS campus_name
           FROM users u LEFT JOIN campus ca ON ca.id = u.campus_id WHERE u.id=$1""",
        user_id,
    )
    if row is None:
        return None
    out = dict(row)
    out["permissions"] = permissions_for(row["role"])
    return out


@router.post("/login")
async def login(body: LoginIn, conn=Depends(get_conn)):
    identifier = body.identifier.strip()
    u = await conn.fetchrow(
        "SELECT * FROM users WHERE lower(email)=lower($1) OR student_code=$1 ORDER BY id LIMIT 1",
        identifier,
    )
    if u is None or not verify_password(body.password, u["pw_hash"]):
        raise HTTPException(401, "Invalid credentials")
    claims = {"id": u["id"], "role": u["role"], "campus_id": u["campus_id"]}
    return {
        "access_token": create_token(claims),
        "token_type": "bearer",
        "user": await _profile(conn, u["id"]),
    }


@router.get("/me")
async def me(user: dict = Depends(current_user), conn=Depends(get_conn)):
    """The server's view of the signed-in account. The frontend uses this, not
    browser storage, to decide which interface to show."""
    profile = await _profile(conn, user["id"])
    if profile is None:
        raise HTTPException(401, "Account no longer exists")
    if profile["role"] != user["role"] or profile["campus_id"] != user["campus_id"]:
        # Role or campus changed since the token was issued: force a new login
        # rather than act with stale privileges.
        raise HTTPException(401, "Your access changed; sign in again")
    return profile


@router.put("/profile")
async def update_profile(body: ProfileUpdateIn, user: dict = Depends(current_user), conn=Depends(get_conn)):
    phone = (body.phone_e164 or "").strip() or None
    if phone and not re.fullmatch(r"\+[1-9][0-9]{7,14}", phone):
        raise HTTPException(422, "Phone number must be in E.164 format, e.g. +14155552671")
    async with conn.transaction():
        await conn.execute("UPDATE users SET phone_e164=$2 WHERE id=$1", user["id"], phone)
        if phone:
            await conn.execute(
                """INSERT INTO whatsapp_preferences (user_id, phone_e164, opted_in, opted_in_at)
                   VALUES ($1, $2, true, now())
                   ON CONFLICT (user_id) DO UPDATE SET phone_e164=EXCLUDED.phone_e164, opted_in=true, opted_in_at=now()""",
                user["id"], phone,
            )
        else:
            await conn.execute(
                "UPDATE whatsapp_preferences SET opted_in=false, opted_out_at=now() WHERE user_id=$1",
                user["id"],
            )
    return await _profile(conn, user["id"])

