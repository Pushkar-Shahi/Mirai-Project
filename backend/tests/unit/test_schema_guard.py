"""A database that is behind the code must be detected, and API errors must stay readable
to the browser (BUGFIX_LOG.md, root cause A)."""
import asyncio
import os
import uuid

import asyncpg
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.cors import add_cors
from app.core.errors import SCHEMA_OUT_OF_DATE, add_error_boundary, classify
from app.migrate import MIGRATIONS_DIR, apply_migrations, migration_files, pending_migrations

ORIGIN = "https://mirai-student.pages.dev"


def client(exc: Exception) -> TestClient:
    app = FastAPI()

    @app.get("/boom")
    def boom():
        raise exc

    add_error_boundary(app)  # same order as app.main: error boundary first, CORS outside it
    add_cors(app, Settings(database_url="postgresql://x", jwt_secret="x" * 32, cors_origins=ORIGIN))
    return TestClient(app, raise_server_exceptions=False)


def test_unhandled_error_is_json_and_has_cors_headers():
    r = client(RuntimeError("secret internals")).get("/boom", headers={"Origin": ORIGIN})
    assert r.status_code == 500
    assert r.json() == {"detail": "Internal server error"}
    assert r.headers["access-control-allow-origin"] == ORIGIN  # was missing: browser said "CORS"


def test_missing_table_is_a_503_that_names_the_fix():
    r = client(asyncpg.UndefinedTableError("relation notifications does not exist")).get(
        "/boom", headers={"Origin": ORIGIN})
    assert r.status_code == 503
    assert r.json()["detail"] == SCHEMA_OUT_OF_DATE
    assert "python -m app.migrate" in r.json()["detail"]
    assert r.headers["access-control-allow-origin"] == ORIGIN


def test_classify_other_errors_hide_details():
    assert classify(ValueError("x")) == (500, "Internal server error")
    assert classify(asyncpg.UndefinedColumnError("c"))[0] == 503


def _admin_url() -> str:
    return os.environ.get("DATABASE_URL", "")


def _run(coro):
    return asyncio.run(coro)


@pytest.mark.skipif(not _admin_url().startswith("postgres"), reason="needs a reachable PostgreSQL (DATABASE_URL)")
def test_pending_migrations_detects_a_stale_database_and_clears_after_migrating():
    async def scenario():
        admin = await asyncpg.connect(_admin_url())
        name = "stale_" + uuid.uuid4().hex[:8]
        try:
            await admin.execute(f'CREATE DATABASE "{name}"')
        except Exception:
            await admin.close()
            pytest.skip("cannot create a scratch database")
        base = _admin_url().rsplit("/", 1)[0]
        conn = await asyncpg.connect(f"{base}/{name}")
        try:
            files = [p.name for p in migration_files()]
            assert await pending_migrations(conn) == files  # untracked database: everything pending
            for path in migration_files()[:5]:  # a deployment that stopped at 005
                await conn.execute(path.read_text())
            await conn.execute("CREATE TABLE schema_migrations (version text primary key, applied_at timestamptz default now())")
            await conn.executemany("INSERT INTO schema_migrations(version) VALUES ($1)", [(f,) for f in files[:5]])
            assert await pending_migrations(conn) == files[5:]
            await apply_migrations(conn, MIGRATIONS_DIR)
            assert await pending_migrations(conn) == []
        finally:
            await conn.close()
            await admin.execute(f'DROP DATABASE "{name}" WITH (FORCE)')
            await admin.close()

    _run(scenario())
