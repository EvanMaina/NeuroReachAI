"""
Celery tasks for AI Insights.

The `refresh_ai_insights` task is the async path for the
`POST /api/ai-insights/refresh` endpoint. The endpoint triggers it with
`.delay()` and returns immediately; the task then calls AI model (20–50s on
the AI model), writes the result to Redis, and exits. This is the lesson from
the April 2026 shared-ALB p99 incident — never call the AI provider synchronously
from an ALB-fronted HTTP handler.
"""

from __future__ import annotations

import logging

from celery import shared_task

from ..core.database import SessionLocal
from ..services.ai_insights_service import refresh_insights_sync

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="src.tasks.ai_insights_tasks.refresh_ai_insights",
    max_retries=2,
    default_retry_delay=30,
)
def refresh_ai_insights(self) -> dict:
    """
    Regenerate the AI Insights dashboard and write it to Redis.

    Returns a small status dict (no PHI) so Flower / result backend can
    confirm the task ran without storing the full payload twice.
    """
    db = SessionLocal()
    try:
        result = refresh_insights_sync(db)
        logger.info(
            "AI Insights refreshed (%d recommendations, health score %s)",
            len(result.get("recommendations") or []),
            (result.get("health_score") or {}).get("score"),
        )
        return {
            "ok": True,
            "health_score": (result.get("health_score") or {}).get("score"),
            "recommendation_count": len(result.get("recommendations") or []),
        }
    except Exception as exc:
        logger.exception("refresh_ai_insights failed: %s", exc)
        raise self.retry(exc=exc)
    finally:
        db.close()

