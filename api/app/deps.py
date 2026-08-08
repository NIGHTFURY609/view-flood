"""FastAPI dependency wiring.

Routers depend on these aliases, never on a concrete client, so swapping the
read path from PostgREST to asyncpg is a change in this module only.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from app.core.auth_utils import AdminUser, require_admin_cookie
from app.core.security import AdminAuth
from app.db.session import Database
from app.db.supabase_rest import SupabaseRest
from app.services.admin_service import AdminService
from app.services.camps_service import CampsService
from app.services.camps_sql_service import CampsSqlService
from app.services.image_service import ImageService
from app.services.needs_service import NeedsService
from app.services.otp_service import OtpService
from app.services.report_service import ReportService
from app.services.requirement_service import RequirementService


def get_rest(request: Request) -> SupabaseRest:
    rest: SupabaseRest = request.app.state.rest
    return rest


def get_db(request: Request) -> Database:
    database: Database = request.app.state.db
    return database


def get_camps_service(request: Request) -> CampsService | CampsSqlService:
    """Prefer direct Postgres once it is configured.

    Serving reads from PostgREST while writes go to a database would put them in
    different places — a freshly submitted report would be invisible in the
    list. The REST path stays only as the no-credentials fallback.
    """
    database: Database = request.app.state.db
    if database.configured:
        return CampsSqlService(database)
    return CampsService(request.app.state.rest)


def get_otp_service(request: Request) -> OtpService:
    service: OtpService = request.app.state.otp_service
    return service


def get_image_service(request: Request) -> ImageService:
    service: ImageService = request.app.state.image_service
    return service


def get_report_service(request: Request) -> ReportService:
    service: ReportService = request.app.state.report_service
    return service


def get_needs_service(request: Request) -> NeedsService:
    service: NeedsService = request.app.state.needs_service
    return service


def get_requirement_service(request: Request) -> RequirementService:
    service: RequirementService = request.app.state.requirement_service
    return service


def get_admin_service(request: Request) -> AdminService:
    service: AdminService = request.app.state.admin_service
    return service


def get_admin_auth(request: Request) -> AdminAuth:
    auth: AdminAuth = request.app.state.admin_auth
    return auth


RestDep = Annotated[SupabaseRest, Depends(get_rest)]
DatabaseDep = Annotated[Database, Depends(get_db)]
CampsServiceDep = Annotated[CampsService | CampsSqlService, Depends(get_camps_service)]
OtpServiceDep = Annotated[OtpService, Depends(get_otp_service)]
ImageServiceDep = Annotated[ImageService, Depends(get_image_service)]
ReportServiceDep = Annotated[ReportService, Depends(get_report_service)]
NeedsServiceDep = Annotated[NeedsService, Depends(get_needs_service)]
RequirementServiceDep = Annotated[RequirementService, Depends(get_requirement_service)]
AdminServiceDep = Annotated[AdminService, Depends(get_admin_service)]
AdminAuthDep = Annotated[AdminAuth, Depends(get_admin_auth)]
CurrentAdminDep = Annotated[AdminUser, Depends(require_admin_cookie)]
