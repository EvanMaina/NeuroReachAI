"""
AI Insights HTTP endpoints.

    GET  /api/ai-insights
        Return the cached dashboard immediately. If the cache is cold, return
        an instant-fallback stub and fire-and-forget a Celery refresh.

    POST /api/ai-insights/refresh
        Explicitly kick off a Celery refresh and return the task id.

    GET  /api/ai-insights/email-draft/{lead_id}
        Per-lead AI-drafted outreach email. Small + fast, runs inline
        (no Celery). Cached per lead for 30 minutes.
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.lead import Lead
from ..services.ai_insights_service import (
    generate_email_draft,
    get_insights,
    refresh_live_insights_snapshot,
)
from ..tasks.ai_insights_tasks import refresh_ai_insights

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-insights", tags=["AI Insights"])


@router.get(
    "",
    summary="AI Insights dashboard",
    description=(
        "Return the current insight dashboard. Served from a 1h "
        "Redis cache. If the cache is cold, an instant stub is returned and a "
        "Celery refresh is kicked off so the next call gets fresh data."
    ),
    dependencies=[Depends(get_current_user)],
)
async def get_ai_insights(db: Session = Depends(get_db)) -> dict:
    payload, source = get_insights(db, force_refresh=False)

    # Cold cache → kick off the async refresh so the next caller gets fresh data.
    if source == "stub":
        try:
            refresh_ai_insights.delay()
        except Exception as exc:
            logger.warning("Could not queue ai_insights refresh: %s", exc)

    return {"source": source, **payload}


@router.post(
    "/refresh",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Kick off an async AI Insights refresh",
    description=(
        "Recomputes live database metrics immediately, writes that snapshot "
        "to Redis, then queues a Celery task to regenerate the AI narrative "
        "with the configured AI model."
    ),
    dependencies=[Depends(get_current_user)],
)
async def post_refresh_ai_insights(db: Session = Depends(get_db)) -> dict:
    # Refresh the numbers synchronously from the database so the dashboard does
    # not keep showing a stale Redis payload while the model task is running.
    # Celery then upgrades the deterministic snapshot with AI-authored narrative.
    snapshot = refresh_live_insights_snapshot(db)
    try:
        async_result = refresh_ai_insights.delay()
    except Exception as exc:
        logger.exception("Could not queue AI narrative refresh: %s", exc)
        return {
            "task_id": None,
            "status": "live_data_refreshed_queue_unavailable",
            "insights": {"source": "live", **snapshot},
        }
    return {
        "task_id": async_result.id,
        "status": "live_data_refreshed_ai_queued",
        "insights": {"source": "live", **snapshot},
    }


@router.get(
    "/email-draft/{lead_id}",
    summary="AI-drafted outreach email for a lead",
    description=(
        "Generate a personalised outreach email for the given lead. Result "
        "is cached per-lead for 30 minutes."
    ),
    dependencies=[Depends(get_current_user)],
)
async def get_email_draft(
    lead_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    lead = (
        db.query(Lead).filter(Lead.id == lead_id, Lead.deleted_at.is_(None)).first()
    )
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    try:
        draft = generate_email_draft(db, lead)
    except RuntimeError as exc:
        # Surface configuration / contract failures honestly so the UI shows
        # a real error instead of a silent template under the "AI Recommended"
        # label. "API key is not configured" is a 503 (operator action needed);
        # anything else from the model is a 502 (upstream weirdness).
        msg = str(exc)
        logger.error("AI email draft failed for lead %s: %s", lead_id, msg)
        if "API key is not configured" in msg:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "AI email drafts are unavailable because the AI provider "
                    "key is not configured. Pick a template from the list to "
                    "send manually, or contact your administrator."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service returned an unexpected response: {msg}",
        )
    except Exception as exc:
        logger.exception("AI email draft failed (unexpected): %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not generate an AI email draft. Please try again shortly.",
        )
    return draft
