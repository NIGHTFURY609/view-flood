"""Error taxonomy and the single response envelope the React client consumes.

Services raise these; one handler turns them into
``{"error": {"code", "message", "fields"}}``. Internal details never cross the
boundary — the traceback is logged, the client gets a correlation id.
"""

from __future__ import annotations

import uuid

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = structlog.get_logger()


class AppError(Exception):
    """Base class for every deliberate, client-visible failure."""

    status_code: int = 400
    code: str = "bad_request"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        fields: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.fields = fields
        if code:
            self.code = code


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class RateLimitedError(AppError):
    status_code = 429
    code = "rate_limited"


class OtpError(AppError):
    status_code = 400
    code = "otp_failed"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"


class ServiceUnavailableError(AppError):
    """Raised when a privileged path is hit but no service credentials exist."""

    status_code = 503
    code = "service_unavailable"


def _envelope(code: str, message: str, fields: dict[str, str] | None = None) -> dict[str, object]:
    return {"error": {"code": code, "message": message, "fields": fields}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(exc.code, exc.message, exc.fields),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields: dict[str, str] = {}
        for error in exc.errors():
            # loc is like ("body", "phone") — drop the source segment.
            location = ".".join(str(part) for part in error["loc"][1:]) or "body"
            fields[location] = error["msg"]
        return JSONResponse(
            status_code=422,
            content=_envelope("validation_error", "Some fields need attention", fields),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        correlation_id = uuid.uuid4().hex[:12]
        log.exception(
            "unhandled_error",
            correlation_id=correlation_id,
            path=request.url.path,
            method=request.method,
            error=str(exc),
        )
        return JSONResponse(
            status_code=500,
            content=_envelope(
                "internal_error",
                f"Something went wrong. Reference: {correlation_id}",
            ),
        )
