from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.security import AdminAuth
from app.db.session import Database
from app.db.supabase_rest import SupabaseRest
from app.routers import auth, camps, geography, weather, writes
from app.routers.admin import camps as admin_camps
from app.routers.admin import legacy as admin_legacy
from app.routers.admin import logs as admin_logs
from app.services.admin_service import AdminService
from app.services.checkin_service import CheckInService
from app.services.image_service import ImageService
from app.services.needs_service import NeedsService
from app.services.otp_service import OtpService
from app.services.report_service import ReportService
from app.sms.base import get_sms_provider
from app.storage.supabase_storage import SupabaseStorage

logging.basicConfig(level=logging.INFO, format="%(message)s")
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ]
)
log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()

    rest = SupabaseRest(settings)
    database = Database(settings)
    storage = SupabaseStorage(settings)

    await rest.start()
    await database.start()
    await storage.start()

    otp_service = OtpService(get_sms_provider(settings.sms_provider), settings.otp_pepper)
    image_service = ImageService(storage)

    app.state.settings = settings
    app.state.rest = rest
    app.state.db = database
    app.state.storage = storage
    app.state.otp_service = otp_service
    app.state.image_service = image_service
    app.state.report_service = ReportService(otp_service, image_service)
    app.state.checkin_service = CheckInService()
    app.state.needs_service = NeedsService(otp_service)
    app.state.admin_service = AdminService()
    app.state.admin_auth = AdminAuth(settings)

    log.info(
        "api_started",
        environment=settings.environment,
        read_path="postgres" if database.configured else "postgrest",
        writes_enabled=database.configured,
        storage_enabled=storage.configured,
    )
    if not database.configured:
        log.warning(
            "writes_disabled",
            detail=(
                "No SUPABASE_DB_URL. Reads are live; OTP, reports, check-ins, pledges and "
                "the admin portal return 503 until it is set in apps/api/.env."
            ),
        )
    if settings.otp_pepper == "dev-only-pepper-change-me":
        log.warning(
            "otp_pepper_is_default",
            detail="Set OTP_PEPPER before accepting real submissions.",
        )

    try:
        yield
    finally:
        await storage.close()
        await database.close()
        await rest.close()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Kerala Camp Check API",
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,  # required for httpOnly cookie auth
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    register_exception_handlers(app)

    for router in (
        geography.router,
        camps.router,
        weather.router,
        writes.router,
        admin_legacy.router,
        admin_camps.router,
        admin_logs.router,
        auth.router,
    ):
        app.include_router(router, prefix="/api/v1")

    @app.get("/api/v1/health", tags=["meta"])
    async def health() -> dict[str, object]:
        database: Database = app.state.db
        storage: SupabaseStorage = app.state.storage
        return {
            "ok": True,
            "read_path": "postgres" if database.configured else "postgrest",
            "writes_enabled": database.configured,
            "storage_enabled": storage.configured,
        }

    return app


app = create_app()
