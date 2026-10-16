"""Unhandled errors become JSON responses that still carry CORS headers.

Starlette answers an uncaught exception from its outermost layer, outside CORSMiddleware,
so the browser saw a bare 500 without Access-Control-Allow-Origin and reported "blocked by
CORS" / "Cannot reach the server" instead of the real cause. This middleware sits inside
CORS (add it before `add_cors`) and turns the exception into a response the browser can read.
"""
import logging

import asyncpg
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

log = logging.getLogger("app.errors")

SCHEMA_OUT_OF_DATE = (
    "The server's database is behind this version of the API (a table or column is missing). "
    "An administrator must run the migrations: python -m app.migrate"
)


def classify(exc: Exception) -> tuple[int, str]:
    """Status and client-safe message for an unhandled exception."""
    if isinstance(exc, (asyncpg.UndefinedTableError, asyncpg.UndefinedColumnError)):
        return 503, SCHEMA_OUT_OF_DATE
    return 500, "Internal server error"


class ErrorBoundaryMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as exc:  # noqa: BLE001 - last line of defence; always logged
            status, detail = classify(exc)
            log.exception("unhandled error on %s %s", request.method, request.url.path)
            return JSONResponse(status_code=status, content={"detail": detail})


def add_error_boundary(app: FastAPI) -> None:
    app.add_middleware(ErrorBoundaryMiddleware)
