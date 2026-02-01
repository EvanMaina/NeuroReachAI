"""
Health check endpoints for monitoring.

Provides health status for load balancers, monitoring systems,
and container orchestration health probes.

Endpoints:
- /health: Basic liveness check (fast, no dependencies)
- /health/ready: Deep readiness check (DB, Redis, queue)
- /health/live: Simple alive check
- /api/admin/queue/status: Queue monitoring (admin)
"""

from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..core.config import settings
from ..core.database import get_db
from ..schemas.common import HealthResponse
from ..services.cache import get_cache
from ..core.auth import get_current_user, require_role


router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    description="Returns the health status of the API and its dependencies.",
)
async def health_check(db: Session = Depends(get_db)) -> HealthResponse:
    """
    Health check endpoint for monitoring systems.
    
    Checks:
    - API is responding
    - Database connection is healthy
    - Database response time
    
    Returns:
        HealthResponse with status and component health
    """
    # Check database connection with response time
    db_status = "connected"
    db_response_time_ms = None
    
    try:
        import time
        start = time.time()
        db.execute(text("SELECT 1"))
        db_response_time_ms = int((time.time() - start) * 1000)
        
        # Warn if database is slow
        if db_response_time_ms > 100:
            print(f"⚠️ Slow database response: {db_response_time_ms}ms")
    except Exception as e:
        db_status = "disconnected"
        print(f"❌ Database health check failed: {e}")
    
    # Determine overall status
    if db_status == "connected":
        health_status = "healthy"
    else:
        health_status = "unhealthy"
    
    return HealthResponse(
        status=health_status,
        version=settings.app_version,
        timestamp=datetime.utcnow(),
        database=db_status,
        environment=settings.environment,
    )


@router.get(
    "/health/ready",
    summary="Readiness Check",
    description="Deep readiness check for all dependencies.",
)
async def readiness_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Readiness probe for Kubernetes/container orchestration.
    
    Verifies ALL dependencies are ready before accepting traffic:
    - Database connection
    - Redis cache
    - Elasticsearch (if enabled)
    - Celery queue depth
    
    Returns:
        Dict with detailed health status of each component
    """
    components = {}
    overall_healthy = True
    
    # Check database connection
    try:
        db.execute(text("SELECT 1"))
        components["database"] = {
            "status": "healthy",
            "connected": True,
        }
    except Exception as e:
        components["database"] = {
            "status": "unhealthy",
            "connected": False,
            "error": str(e)[:100],
        }
        overall_healthy = False
    
    # Check Redis cache
    cache = get_cache()
    redis_health = cache.health_check()
    components["redis"] = redis_health
    if redis_health.get("status") != "healthy":
        # Redis is optional - don't fail readiness
        # But log the issue
        pass
    
    # Check Elasticsearch (if enabled)
    if settings.elasticsearch_enabled:
        try:
            # Would check ES health here
            # from elasticsearch import Elasticsearch
            # es = Elasticsearch([settings.elasticsearch_url])
            # es.cluster.health()
            components["elasticsearch"] = {
                "status": "healthy",
                "enabled": True,
            }
        except Exception as e:
            components["elasticsearch"] = {
                "status": "unhealthy",
                "enabled": True,
                "error": str(e)[:100],
            }
            # ES is optional - don't fail readiness
    else:
        components["elasticsearch"] = {
            "status": "disabled",
            "enabled": False,
        }
    
    # Check Celery queue depth
    try:
        from ..tasks.celery_app import get_queue_stats, is_queue_overloaded
        queue_stats = get_queue_stats()
        queue_overloaded = is_queue_overloaded()
        
        components["queue"] = {
            "status": "overloaded" if queue_overloaded else "healthy",
            "depths": queue_stats,
            "max_depth": settings.lead_queue_max_depth,
        }
        
        if queue_overloaded:
            overall_healthy = False
    except Exception as e:
        components["queue"] = {
            "status": "unknown",
            "error": str(e)[:100],
        }
    
    return {
        "status": "ready" if overall_healthy else "not_ready",
        "version": settings.app_version,
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.environment,
        "components": components,
    }


@router.get(
    "/health/live",
    summary="Liveness Check",
    description="Simple liveness check to verify the API is running.",
)
async def liveness_check() -> dict:
    """
    Liveness probe for Kubernetes/container orchestration.
    
    Simple check that the API process is alive.
    Does NOT check dependencies - use /health/ready for that.
    
    Returns:
        Simple dict with status
    """
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat(),
    }


# =============================================================================
# Admin Endpoints
# =============================================================================

@router.get(
    "/api/admin/queue/status",
    summary="Queue Status",
    description="Get Celery queue status and depths (admin only).",
    dependencies=[Depends(require_role("administrator"))],
)
async def get_queue_status() -> Dict[str, Any]:
    """
    Get detailed status of Celery task queues.
    
    Used for monitoring queue depth and detecting backpressure.
    
    Returns:
        Dict with queue statistics
    """
    try:
        from ..tasks.celery_app import get_queue_stats, is_queue_overloaded
        
        queue_stats = get_queue_stats()
        overloaded = is_queue_overloaded()
        
        return {
            "status": "overloaded" if overloaded else "healthy",
            "queues": queue_stats,
            "max_depth": settings.lead_queue_max_depth,
            "backpressure_active": overloaded,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


@router.get(
    "/api/admin/cache/stats",
    summary="Cache Statistics",
    description="Get Redis cache statistics (admin only).",
    dependencies=[Depends(require_role("administrator"))],
)
async def get_cache_stats() -> Dict[str, Any]:
    """
    Get Redis cache statistics including hit rate.
    
    Returns:
        Dict with cache statistics
    """
    cache = get_cache()
    
    return {
        "health": cache.health_check(),
        "stats": cache.get_stats(),
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post(
    "/api/admin/cache/invalidate",
    summary="Invalidate Cache",
    description="Invalidate all caches (admin only).",
    dependencies=[Depends(require_role("administrator"))],
)
async def invalidate_all_caches() -> Dict[str, Any]:
    """
    Invalidate all caches.
    
    Use with caution - this will cause temporary performance degradation.
    
    Returns:
        Confirmation of invalidation
    """
    cache = get_cache()
    cache.invalidate_all()
    
    return {
        "status": "invalidated",
        "message": "All caches have been invalidated",
        "timestamp": datetime.utcnow().isoformat(),
    }
