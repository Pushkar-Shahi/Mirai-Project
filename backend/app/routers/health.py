from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app import db, redis_client
from app.config import settings
from app.migrate import pending_migrations

router = APIRouter(tags=["health"])


@router.get("/health/live")
async def live():
    """Process is up. No dependencies, so it answers even while the database wakes."""
    return {"status": "ok"}


@router.get("/health")
async def health():
    async with db.pool.acquire() as conn:
        await conn.fetchval("SELECT 1")
        migrations = await conn.fetchval(
            "SELECT max(version) FROM schema_migrations"
        ) if await conn.fetchval("SELECT to_regclass('public.schema_migrations')") else None
        pending = await pending_migrations(conn)
    await redis_client.redis.ping()
    body = {
        "status": "ok" if not pending else "schema_out_of_date",
        "schema_current": not pending,
        "pending_migrations": pending,
        "mode": settings.app_mode,
        "cache": "memory" if settings.app_mode == "local" else "redis",
        "background_jobs": "in_process" if settings.app_mode == "local" else "celery",
        "schema": migrations,
        "email": "configured" if settings.email_enabled else "disabled",
    }
    return JSONResponse(body, status_code=200 if not pending else 503)


@router.get("/config/public")
async def public_config():
    """Non-secret branding and labels the static frontend needs before login."""
    return {
        "app_name": settings.app_name,
        "app_short_name": settings.app_short_name,
        "institution_name": settings.institution_name,
        "timezone": settings.app_timezone,
        "role_labels": {
            "student": "Student",
            "coordinator": "Club coordinator",
            "advisor": "Faculty advisor",
            "campus_admin": "Campus manager",
            "super_admin": "Super admin",
        },
    }
