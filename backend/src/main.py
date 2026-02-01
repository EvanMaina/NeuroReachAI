"""
NeuroReach AI Backend - FastAPI Application Entry Point

HIPAA-compliant patient intake and lead generation platform
for TMS therapy clinics.

Performance optimized with:
- Redis caching layer
- Response compression (gzip/brotli)
- Performance monitoring middleware
- Database query optimization
"""

import os
import time
import logging
from collections import defaultdict
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator, Dict, List

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from .core.config import settings
from .core.database import engine, Base
from .api import health_router, leads_router, analytics_router, metrics_router, calls_router, source_analytics_router, platform_analytics_router, webhooks_router, providers_router, google_ads_analytics_router, communications_router, auth_router, users_router, widget_router, callrail_router, notes_router
from .services.cache import get_cache


logger = logging.getLogger(__name__)


# =============================================================================
# Rate Limiting Middleware
# =============================================================================

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware using sliding window algorithm.

    Limits requests per IP address to prevent abuse.
    Returns HTTP 429 when limit exceeded.
    """

    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.window_size = 60  # seconds
        # Store request timestamps per IP: {ip: [timestamp1, timestamp2, ...]}
        self.request_log: Dict[str, List[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        # Check X-Forwarded-For header (for proxied requests)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        # Fall back to direct client IP
        if request.client:
            return request.client.host
        return "unknown"

    def _clean_old_requests(self, ip: str, current_time: float) -> None:
        """Remove requests outside the sliding window."""
        cutoff = current_time - self.window_size
        self.request_log[ip] = [
            ts for ts in self.request_log[ip] if ts > cutoff
        ]

    def _is_rate_limited(self, ip: str) -> bool:
        """Check if IP has exceeded rate limit."""
        current_time = time.time()
        self._clean_old_requests(ip, current_time)

        if len(self.request_log[ip]) >= self.requests_per_minute:
            return True

        # Log this request
        self.request_log[ip].append(current_time)
        return False

    async def dispatch(self, request: Request, call_next):
        """Process request with rate limiting."""
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/health/ready", "/health/live"]:
            return await call_next(request)

        client_ip = self._get_client_ip(request)

        if self._is_rate_limited(client_ip):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "success": False,
                    "error": "rate_limit_exceeded",
                    "message": f"Too many requests. Please try again later. Limit: {self.requests_per_minute} requests per minute.",
                },
                headers={
                    "Retry-After": "60",
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Remaining": "0",
                },
            )

        # Add rate limit headers to response
        response = await call_next(request)
        remaining = max(0, self.requests_per_minute -
                        len(self.request_log[client_ip]))
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)

        return response


# =============================================================================
# Performance Monitoring Middleware
# =============================================================================

class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """
    Middleware to track API response times and log slow requests.

    Logs warnings for requests exceeding 500ms.
    Adds X-Response-Time header to all responses.
    """

    SLOW_REQUEST_THRESHOLD_MS = 500

    async def dispatch(self, request: Request, call_next):
        """Process request with timing."""
        start_time = time.time()

        response = await call_next(request)

        # Calculate response time
        process_time_ms = (time.time() - start_time) * 1000

        # Add timing header
        response.headers["X-Response-Time"] = f"{process_time_ms:.2f}ms"

        # Log slow requests (>500ms)
        if process_time_ms > self.SLOW_REQUEST_THRESHOLD_MS:
            logger.warning(
                f"Slow request: {request.method} {request.url.path} "
                f"took {process_time_ms:.2f}ms"
            )

        # Log all request times in debug mode
        if settings.debug:
            logger.debug(
                f"{request.method} {request.url.path} - {process_time_ms:.2f}ms"
            )

        return response


# =============================================================================
# Application Lifespan
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan handler.

    Handles startup and shutdown events.
    Initializes cache service and performs health checks.
    """
    # Startup
    print(f"Starting {settings.app_name} v{settings.app_version}")
    print(f"Environment: {settings.environment}")

    # =========================================================================
    # PRODUCTION SECRET VALIDATION
    # Refuse to start in production with insecure defaults
    # =========================================================================
    _insecure_secrets = []
    if settings.secret_key == "dev-secret-key-change-in-production":
        _insecure_secrets.append("SECRET_KEY")
    if settings.encryption_key.rstrip("0") == "dev-encryption-key-32bytes!":
        _insecure_secrets.append("ENCRYPTION_KEY")

    if _insecure_secrets and settings.is_production:
        print("=" * 60)
        print("  FATAL: INSECURE SECRETS DETECTED IN PRODUCTION")
        print(f"  The following env vars still use dev defaults: {', '.join(_insecure_secrets)}")
        print("  Set strong, unique values before deploying to production!")
        print("  Refusing to start. Exiting.")
        print("=" * 60)
        import sys
        sys.exit(1)
    elif _insecure_secrets:
        print("=" * 60)
        print("  WARNING: Dev-default secrets in use:")
        print(f"     {', '.join(_insecure_secrets)}")
        print("  This is fine for development, but MUST be changed for production.")
        print("=" * 60)

    # Initialize cache service
    cache = get_cache()
    if cache.is_connected:
        print("Redis cache connected")
    else:
        print("Redis cache not available - operating without cache")

    # In development, we can create tables (production should use Alembic)
    if settings.is_development:
        print("Development mode - tables managed by init SQL script")

    # Admin seeding is handled by the setup_fresh_admin.py script.
    # Run it after first deployment:
    #   docker exec -it neuroreach-backend python /app/scripts/setup_fresh_admin.py --email you@clinic.com
    try:
        from .core.database import SessionLocal
        from .models.user import User

        db = SessionLocal()
        try:
            user_count = db.query(User).count()
            if user_count == 0:
                print("=" * 60)
                print("  NO USERS FOUND")
                print("  Run the setup script to create the first admin:")
                print("    docker exec -it neuroreach-backend python /app/scripts/setup_fresh_admin.py --email admin@clinic.com")
                print("=" * 60)
        finally:
            db.close()
    except Exception as e:
        print(f"[WARNING] Could not check user table: {e}")

    yield

    # Shutdown
    print("Shutting down...")
    engine.dispose()


# =============================================================================
# Application Factory
# =============================================================================

def create_application() -> FastAPI:
    """
    Create and configure the FastAPI application.

    Returns:
        Configured FastAPI application instance
    """
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "HIPAA-compliant patient intake and lead generation API "
            "for TMS therapy clinics. Performance optimized with Redis caching."
        ),
        docs_url="/docs" if settings.is_development else None,
        redoc_url="/redoc" if settings.is_development else None,
        openapi_url="/openapi.json" if settings.is_development else None,
        lifespan=lifespan,
    )

    # Add GZip compression middleware (compress responses > 1KB)
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Add performance monitoring middleware
    app.add_middleware(PerformanceMonitoringMiddleware)

    # Configure CORS
    # NOTE: allow_origins includes "*" to support the embeddable widget
    # being loaded on external sites (WordPress, etc.) that need to POST
    # to /api/leads/submit. Starlette's CORSMiddleware will reflect the
    # specific request Origin header when credentials are sent, keeping
    # dashboard auth secure while allowing widget submissions from any origin.
    cors_origins = settings.cors_origins_list
    allow_all = "*" in cors_origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if allow_all else cors_origins,
        allow_credentials=not allow_all,  # credentials not compatible with wildcard
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=[
            "X-Request-ID",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-Response-Time",
        ],
    )

    # Add rate limiting middleware (60 requests per minute per IP)
    app.add_middleware(RateLimitMiddleware,
                       requests_per_minute=settings.rate_limit_per_minute)

    # Register routers
    app.include_router(health_router)
    app.include_router(leads_router)
    app.include_router(analytics_router)
    app.include_router(source_analytics_router)
    app.include_router(platform_analytics_router)
    app.include_router(google_ads_analytics_router)
    app.include_router(metrics_router)
    app.include_router(calls_router)
    app.include_router(webhooks_router)
    app.include_router(providers_router)
    app.include_router(communications_router)
    app.include_router(auth_router)
    app.include_router(users_router)
    app.include_router(widget_router)
    app.include_router(callrail_router)
    app.include_router(notes_router)

    return app


# =============================================================================
# Exception Handlers
# =============================================================================

app = create_application()

# =============================================================================
# Mount Static Files (for email logo, etc.)
# Serves files at /static/ -- e.g., /static/images/logo.png
# No authentication required so email clients can fetch the logo.
# Checks two locations: /app/static (Docker) and src/static (legacy).
# =============================================================================
_static_dir = Path("/app/static")
if not _static_dir.is_dir():
    _static_dir = Path(__file__).resolve().parent / "static"
if _static_dir.is_dir():
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")
    logger.info("Static files mounted at /static from %s", _static_dir)
else:
    logger.warning("Static directory not found -- /static will not be available")


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    """
    Handle ValueError exceptions.

    Returns user-friendly error response without exposing internals.
    """
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error": "validation_error",
            "message": str(exc),
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle unhandled exceptions.

    Logs error and returns generic message (never expose PHI or internals).
    """
    # In production, log to secure logging system
    # NEVER log PHI or sensitive data
    if settings.is_development:
        print(f"Unhandled exception: {type(exc).__name__}")

    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "internal_error",
            "message": "An unexpected error occurred. Please try again later.",
        },
    )


# =============================================================================
# Root Endpoint
# =============================================================================

@app.get("/", tags=["Root"])
async def root() -> dict:
    """
    Root endpoint returning API information.
    """
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs": "/docs" if settings.is_development else "disabled",
    }


# =============================================================================
# Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.is_development,
        log_level="debug" if settings.debug else "info",
    )
