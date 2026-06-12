"""
AI Insights service.

Pulls real numbers out of the leads table and feeds them to the configured AI model to
produce an 8-card operational insight dashboard. Expensive (the AI model call
takes 20–50s end-to-end) so we:

    - Cache the final response in Redis for 1 hour (key: ai_insights:v1).
    - Return an instant stub narrative on cold cache so the UI never blocks;
      the actual AI model call runs async via Celery.
    - Send the large static system prompt FIRST so OpenAI's automatic prompt
      caching (stable prefixes ≥1024 tokens) keeps repeated refreshes cheap —
      never interpolate timestamps or per-request data into it.

Per-lead email drafts (Send Email → "AI Recommended" tab) share the same
client + model but use a separate, lead-specific prompt. Those are small and
fast enough to run synchronously.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import func, case
from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.lead import Lead, PriorityType, LeadStatus, ContactOutcome
from ..models.user import User
from ..services.cache import get_cache
from ..services.encryption import EncryptionService

logger = logging.getLogger(__name__)

INSIGHTS_CACHE_KEY = "ai_insights:v1"
EMAIL_DRAFT_CACHE_KEY = "ai_email_draft:v1:{lead_id}"
EMAIL_DRAFT_TTL = 30 * 60  # 30 minutes


# ---------------------------------------------------------------------------
# ZIP → Location resolution (offline, via zipcodes library)
# ---------------------------------------------------------------------------
# We use the `zipcodes` library which ships a bundled JSON dataset of every
# US ZIP code. No network calls, no SQLAlchemy dependency, no hardcoded maps.
#
# Root cause of the previous failure: uszipcode==1.0.1 depends on
# sqlalchemy_mate, which dropped `ExtendedBase` in a newer version. This
# caused uszipcode to crash at import with an AttributeError that was silently
# caught by the try/except, returning None every time and causing every ZIP
# to fall back to "ZIP XXXXX".
#
# The `zipcodes` library is pure Python with a bundled JSON file — zero
# external runtime dependencies and no SQLAlchemy conflict.
# ---------------------------------------------------------------------------

# In-process LRU cache so repeated lookups for the same ZIP in a single
# aggregation run don't hit the JSON dataset multiple times.
_zip_cache: dict[str, tuple[str, str]] = {}

# Module-level flag so we only log the import warning once.
_zipcodes_available: Optional[bool] = None

# ---------------------------------------------------------------------------
# Display-name maps — convert raw DB enum values to human-readable labels.
#
# These prevent raw constants like "DEPRESSION", "google_ads", "VIDEO_CALL"
# from leaking into the coordinator dashboard, AI model prompts, or email
# drafts.  The fallback (unknown key → .replace("_", " ").title()) is a
# safety net so new enum members degrade gracefully instead of silently
# showing ugly constants.
# ---------------------------------------------------------------------------

_CONDITION_DISPLAY: dict[str, str] = {
    "DEPRESSION": "Depression",
    "ANXIETY": "Anxiety",
    "OCD": "OCD",       # acronym — keep uppercase
    "PTSD": "PTSD",     # acronym — keep uppercase
    "OTHER": "Other",
}

_SOURCE_DISPLAY: dict[str, str] = {
    "widget": "Widget",
    "google_ads": "Google Ads",
    "jotform": "Jotform",
    "referral": "Referral",
    "manual": "Manual",
    "api": "API",
    "import": "Import",
    "unknown": "Unknown",
}

_METHOD_DISPLAY: dict[str, str] = {
    "PHONE": "Phone",
    "EMAIL": "Email",
    "SMS": "SMS",            # acronym — keep uppercase
    "VIDEO_CALL": "Video Call",
    "unknown": "Unknown",
}

# Reusable helper — call everywhere we convert a raw enum value to a label.
def _display_name(raw: str, lookup: dict[str, str]) -> str:
    """Return a human-readable label for a raw enum value.

    Falls back to title-casing the raw value (replacing underscores with
    spaces) so any unmapped future enum members degrade gracefully rather
    than silently showing raw constants.
    """
    return lookup.get(raw, raw.replace("_", " ").title())


def _normalize_zip5(zip_code: Any) -> str:
    """Return a 5-digit ZIP prefix, or an empty string when unavailable."""
    digits = re.sub(r"\D", "", str(zip_code or ""))
    return digits[:5] if len(digits) >= 5 else ""


def _resolve_zip_location(zip_code: Any) -> tuple[str, str]:
    """
    Resolve a ZIP to a human-readable "City, ST" display label using the
    offline `zipcodes` bundled JSON dataset.

    Returns (label, kind):
      - kind="location" when a verified city+state is known.
      - kind="zip" when falling back to raw ZIP (e.g. invalid or 00000).

    Never raises — degrades gracefully to "ZIP XXXXX" on any failure.
    """
    global _zipcodes_available

    zip5 = _normalize_zip5(zip_code)
    if not zip5 or zip5 == "00000":
        return (f"ZIP {zip5}" if zip5 else ""), "zip"

    # Check in-process cache first
    if zip5 in _zip_cache:
        return _zip_cache[zip5]

    # Try zipcodes offline lookup
    try:
        import zipcodes as _zipcodes_lib
        _zipcodes_available = True
        results = _zipcodes_lib.matching(zip5)
        if results:
            city = results[0].get("city", "")
            state = results[0].get("state", "")
            if city and state:
                label = f"{city}, {state}"
                _zip_cache[zip5] = (label, "location")
                logger.debug("ZIP %s resolved to %s", zip5, label)
                return label, "location"
    except ImportError:
        if _zipcodes_available is not False:
            logger.warning(
                "zipcodes library not available — ZIP codes will display as raw numbers. "
                "Install with: pip install zipcodes==1.2.0"
            )
            _zipcodes_available = False
    except Exception as exc:
        logger.debug("zipcodes lookup failed for %s: %s", zip5, exc)

    # Fallback: raw ZIP display
    fallback = (f"ZIP {zip5}", "zip")
    _zip_cache[zip5] = fallback
    return fallback


def _extract_json_object(text: str) -> Any:
    """
    Parse a JSON object from a AI model text block.

    AI model usually returns pure JSON when instructed to, but sometimes wraps
    it in markdown code fences (```json ... ```), prepends a one-line preamble
    ("Here's the dashboard:"), or appends a trailing comment. We strip those
    safely and parse.

    Raises json.JSONDecodeError if no valid JSON object can be located.
    """
    if text is None:
        raise json.JSONDecodeError("Empty response", "", 0)

    s = text.strip()

    # 1) Markdown fence: ```json\n{...}\n``` or ```\n{...}\n```
    if s.startswith("```"):
        # Drop the opening fence (with optional language hint)
        first_newline = s.find("\n")
        if first_newline != -1:
            s = s[first_newline + 1 :]
        # Drop the trailing fence
        if s.rstrip().endswith("```"):
            s = s.rstrip()[: -3].rstrip()

    # 2) Try the cleaned string directly
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass

    # 3) Fall back to extracting the first balanced JSON object by brace count.
    #    This handles cases where AI model prepends prose before the object.
    start = s.find("{")
    if start == -1:
        raise json.JSONDecodeError("No JSON object found in response", text[:200], 0)
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(s)):
        ch = s[i]
        if escape:
            escape = False
            continue
        if ch == "\\" and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(s[start : i + 1])
    raise json.JSONDecodeError(
        "Unbalanced braces in response", text[:200], 0
    )

# =============================================================================
# Metrics aggregation (source of truth the model reasons over)
# =============================================================================


@dataclass
class InsightMetrics:
    total_leads: int
    new_last_7d: int
    contacted: int
    scheduled: int
    consultation_complete: int
    treatment_started: int
    not_interested: int
    unreachable: int
    in_service_area: int
    referrals: int
    hot: int
    medium: int
    low: int
    no_answer_stale: int  # NO_ANSWER outcome, last_contact > 3 days ago
    callbacks_due: int  # CALLBACK_REQUESTED where scheduled time has passed
    new_untouched: int  # NEW status with zero contact attempts — most urgent backlog

    # ---- Newly added real metrics (no AI model fabrication allowed) ------------
    # Pipeline-wide aggregates for hero metric cards.
    active_pipeline: int  # Anyone still workable (NEW + CONTACTED + SCHEDULED)
    insured_open: int  # has_insurance=True AND still in active pipeline
    avg_first_contact_hours: Optional[float]  # avg hours: created_at → first contact attempt

    # Time-of-day answer-rate based on last_contact_attempt × outcome.
    # Keys: "morning" (5-11), "midday" (11-13), "afternoon" (13-17), "evening" (17-22).
    # Value: percentage of attempts in that window that resulted in ANSWERED/SCHEDULED/COMPLETED.
    answer_rate_by_window: dict  # {window: {"attempts": int, "successes": int, "pct": float}}

    # Method-level success rate: PHONE / SMS / EMAIL / VIDEO_CALL.
    # Computed off lead.contact_method × outcome class.
    success_rate_by_method: dict  # {method: {"attempts": int, "successes": int, "pct": float}}

    # Geographic breakdown: top resolved intake locations.
    geographic_breakdown: list[dict]  # [{label, kind: "location"|"zip", count, conversions, rate_pct}]

    # Expansion opportunities: distinct lead_location strings, ordered by recency × frequency.
    expansion_opportunities: list[dict]  # [{location, lead_count, last_seen_iso}]

    top_conditions: list[dict]  # [{name, count}]
    tms_interest: list[dict]  # [{name, count, percentage}]
    lead_sources: list[dict]  # [{name, count, percentage}]
    # NOTE: leaderboard switched from `assigned_to_id` to `completed_by_user_id`
    # so this is now a CLOSER ranking, not assignment volume. See migration 027.
    coordinator_leaderboard: list[dict]  # [{name, completions, completions_30d, ...}]

    @property
    def conversion_rate(self) -> float:
        if self.total_leads == 0:
            return 0.0
        converted = self.scheduled + self.consultation_complete + self.treatment_started
        return round(100.0 * converted / self.total_leads, 1)


def collect_metrics(db: Session) -> InsightMetrics:
    """Run everything through indexed columns — no PHI is ever decrypted here."""
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    three_days_ago = now - timedelta(days=3)

    base = db.query(Lead).filter(Lead.deleted_at.is_(None))

    total_leads = base.count()
    new_last_7d = base.filter(Lead.created_at >= seven_days_ago).count()
    contacted = base.filter(Lead.status == LeadStatus.CONTACTED).count()
    scheduled = base.filter(Lead.status == LeadStatus.SCHEDULED).count()
    consultation_complete = base.filter(
        Lead.status == LeadStatus.CONSULTATION_COMPLETE
    ).count()
    treatment_started = base.filter(Lead.status == LeadStatus.TREATMENT_STARTED).count()
    # NOT_INTERESTED lives on ContactOutcome, not LeadStatus.
    not_interested = base.filter(
        Lead.contact_outcome == ContactOutcome.NOT_INTERESTED
    ).count()
    unreachable = base.filter(Lead.contact_outcome == ContactOutcome.UNREACHABLE).count()
    in_service_area = base.filter(Lead.in_service_area.is_(True)).count()
    referrals = base.filter(Lead.is_referral.is_(True)).count()
    hot = base.filter(Lead.priority == PriorityType.HOT).count()
    medium = base.filter(Lead.priority == PriorityType.MEDIUM).count()
    low = base.filter(Lead.priority == PriorityType.LOW).count()

    no_answer_stale = base.filter(
        Lead.contact_outcome == ContactOutcome.NO_ANSWER,
        Lead.last_contact_attempt != None,  # noqa: E711 — SQLAlchemy idiom
        Lead.last_contact_attempt < three_days_ago,
    ).count()

    callbacks_due = base.filter(
        Lead.contact_outcome == ContactOutcome.CALLBACK_REQUESTED,
        Lead.scheduled_callback_at != None,  # noqa: E711
        Lead.scheduled_callback_at < now,
    ).count()

    # Top conditions (indexed column, no PHI)
    cond_rows = (
        db.query(Lead.condition, func.count(Lead.id))
        .filter(Lead.deleted_at.is_(None))
        .group_by(Lead.condition)
        .order_by(func.count(Lead.id).desc())
        .limit(5)
        .all()
    )
    top_conditions = [
        {
            # Convert raw enum value ("DEPRESSION") to display label ("Depression").
            "name": _display_name(
                cond.value if hasattr(cond, "value") else str(cond),
                _CONDITION_DISPLAY,
            ),
            "count": count,
        }
        for cond, count in cond_rows
        if cond is not None
    ]

    tms_rows = (
        db.query(Lead.tms_therapy_interest, func.count(Lead.id))
        .filter(
            Lead.deleted_at.is_(None),
            Lead.tms_therapy_interest.isnot(None),
            Lead.tms_therapy_interest != "",
        )
        .group_by(Lead.tms_therapy_interest)
        .order_by(func.count(Lead.id).desc())
        .all()
    )
    tms_total = sum(int(count or 0) for _name, count in tms_rows)
    tms_interest = [
        {
            "name": str(name).replace("_", " ").title(),
            "count": int(count or 0),
            "percentage": round(100.0 * int(count or 0) / tms_total, 1) if tms_total else 0.0,
        }
        for name, count in tms_rows
    ]

    source_rows = (
        db.query(Lead.source, func.count(Lead.id))
        .filter(Lead.deleted_at.is_(None))
        .group_by(Lead.source)
        .order_by(func.count(Lead.id).desc())
        .limit(8)
        .all()
    )
    lead_sources = [
        {
            # Convert raw enum value ("google_ads") to display label ("Google Ads").
            "name": _display_name(
                src.value if hasattr(src, "value") else str(src or "unknown"),
                _SOURCE_DISPLAY,
            ),
            "count": int(count or 0),
            "percentage": round(100.0 * int(count or 0) / total_leads, 1) if total_leads else 0.0,
        }
        for src, count in source_rows
    ]

    # =========================================================================
    # REAL HERO METRICS (no AI model fabrication beyond this point)
    # =========================================================================
    new_untouched = base.filter(
        Lead.status == LeadStatus.NEW,
        # No outreach attempt yet — these are the most urgent for first-contact.
        ((Lead.contact_attempts.is_(None)) | (Lead.contact_attempts == 0)),
    ).count()

    # "Active pipeline" = workable today (NEW + CONTACTED + SCHEDULED).
    active_pipeline = base.filter(
        Lead.status.in_(
            [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.SCHEDULED]
        )
    ).count()

    # Insured leads still in the active pipeline (i.e. money-on-the-table).
    insured_open = base.filter(
        Lead.has_insurance.is_(True),
        Lead.status.in_(
            [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.SCHEDULED]
        ),
    ).count()

    # Average hours between intake and first contact attempt — speed-to-lead.
    # Computed only on leads that have had at least one contact attempt.
    avg_first_contact_hours: Optional[float] = None
    try:
        rows = (
            db.query(Lead.created_at, Lead.last_contact_attempt)
            .filter(
                Lead.deleted_at.is_(None),
                Lead.last_contact_attempt.isnot(None),
                Lead.created_at.isnot(None),
            )
            .all()
        )
        if rows:
            total_seconds = 0.0
            sample = 0
            for created, first_attempt in rows:
                if created and first_attempt and first_attempt >= created:
                    total_seconds += (first_attempt - created).total_seconds()
                    sample += 1
            if sample > 0:
                avg_first_contact_hours = round(total_seconds / sample / 3600.0, 1)
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("avg_first_contact_hours unavailable: %s", exc)

    # =========================================================================
    # ANSWER RATE BY TIME OF DAY (real DB-derived signal, not AI model guess)
    # We bucket each `last_contact_attempt` into morning/midday/afternoon/evening
    # and compute the % that landed on a successful outcome.
    # =========================================================================
    successful_outcomes = (
        ContactOutcome.ANSWERED,
        ContactOutcome.SCHEDULED,
        ContactOutcome.COMPLETED,
        ContactOutcome.CALLBACK_REQUESTED,
    )

    def _bucket(hour: int) -> str:
        if 5 <= hour < 11:
            return "morning"
        if 11 <= hour < 13:
            return "midday"
        if 13 <= hour < 17:
            return "afternoon"
        if 17 <= hour < 22:
            return "evening"
        return "off_hours"

    answer_rate_by_window: dict[str, dict[str, Any]] = {
        w: {"attempts": 0, "successes": 0, "pct": 0.0}
        for w in ("morning", "midday", "afternoon", "evening")
    }
    try:
        rows = (
            db.query(Lead.last_contact_attempt, Lead.contact_outcome)
            .filter(
                Lead.deleted_at.is_(None),
                Lead.last_contact_attempt.isnot(None),
            )
            .all()
        )
        for last_attempt, outcome in rows:
            if not last_attempt:
                continue
            bucket = _bucket(last_attempt.hour)
            if bucket not in answer_rate_by_window:
                continue
            answer_rate_by_window[bucket]["attempts"] += 1
            if outcome in successful_outcomes:
                answer_rate_by_window[bucket]["successes"] += 1
        for w, d in answer_rate_by_window.items():
            d["pct"] = (
                round(100.0 * d["successes"] / d["attempts"], 1)
                if d["attempts"] else 0.0
            )
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("answer_rate_by_window unavailable: %s", exc)

    # =========================================================================
    # SUCCESS RATE BY CONTACT METHOD (real, derived from contact_method × outcome)
    # =========================================================================
    success_rate_by_method: dict[str, dict[str, Any]] = {}
    try:
        rows = (
            db.query(Lead.contact_method, Lead.contact_outcome)
            .filter(
                Lead.deleted_at.is_(None),
                Lead.last_contact_attempt.isnot(None),
            )
            .all()
        )
        for method, outcome in rows:
            raw_key = method.value if method and hasattr(method, "value") else str(method or "unknown")
            # Use display name as key so the frontend never sees "PHONE", "VIDEO_CALL" etc.
            key = _display_name(raw_key, _METHOD_DISPLAY)
            bucket = success_rate_by_method.setdefault(
                key, {"attempts": 0, "successes": 0, "pct": 0.0}
            )
            bucket["attempts"] += 1
            if outcome in successful_outcomes:
                bucket["successes"] += 1
        for key, d in success_rate_by_method.items():
            d["pct"] = (
                round(100.0 * d["successes"] / d["attempts"], 1)
                if d["attempts"] else 0.0
            )
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("success_rate_by_method unavailable: %s", exc)

    # =========================================================================
    # GEOGRAPHIC BREAKDOWN - intake postal codes resolved to known locations.
    # Geography is powered by the postal code captured when the lead submits the
    # intake form. Coordinator-entered lead_location is intentionally reserved
    # for expansion opportunities below, because that field is collected during
    # manual outreach and is optional.
    # =========================================================================
    geographic_breakdown: list[dict] = []
    converted_status_set = (
        LeadStatus.SCHEDULED,
        LeadStatus.CONSULTATION_COMPLETE,
        LeadStatus.TREATMENT_STARTED,
    )
    converted_case = case(
        (Lead.status.in_(converted_status_set), 1),
        else_=0,
    )
    try:
        zip_rows = (
            db.query(
                Lead.zip_code,
                func.count(Lead.id).label("cnt"),
                func.sum(converted_case).label("conv"),
            )
            .filter(
                Lead.deleted_at.is_(None),
                Lead.zip_code.isnot(None),
                Lead.zip_code != "",
            )
            .group_by(Lead.zip_code)
            .order_by(func.count(Lead.id).desc(), Lead.zip_code.asc())
            .limit(15)
            .all()
        )
        buckets: dict[tuple[str, str], dict[str, Any]] = {}
        for zip_code, cnt, conv in zip_rows:
            cnt_i = int(cnt or 0)
            conv_i = int(conv or 0)
            zip5 = _normalize_zip5(zip_code)
            if not zip5:
                continue
            label, kind = _resolve_zip_location(zip5)
            key = (kind, label)
            bucket = buckets.setdefault(
                key,
                {
                    "label": label,
                    "kind": kind,
                    "count": 0,
                    "conversions": 0,
                    "zip_codes": [],
                },
            )
            bucket["count"] += cnt_i
            bucket["conversions"] += conv_i
            bucket["zip_codes"].append(zip5)

        for bucket in sorted(
            buckets.values(),
            key=lambda row: (-int(row["count"]), str(row["label"])),
        )[:10]:
            cnt_i = int(bucket["count"] or 0)
            conv_i = int(bucket["conversions"] or 0)
            bucket["rate_pct"] = round(100.0 * conv_i / cnt_i, 1) if cnt_i else 0.0
            geographic_breakdown.append(bucket)
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("geographic_breakdown unavailable: %s", exc)

    # =========================================================================
    # EXPANSION OPPORTUNITIES — distinct lead_location entries (recent × volume).
    # =========================================================================
    expansion_opportunities: list[dict] = []
    try:
        last_seen_expr = func.coalesce(
            Lead.last_updated_at,
            Lead.updated_at,
            Lead.created_at,
        )
        exp_rows = (
            db.query(
                Lead.lead_location,
                func.count(Lead.id).label("cnt"),
                func.max(last_seen_expr).label("last_seen"),
            )
            .filter(
                Lead.deleted_at.is_(None),
                Lead.lead_location.isnot(None),
                Lead.lead_location != "",
            )
            .group_by(Lead.lead_location)
            .order_by(func.count(Lead.id).desc(), func.max(last_seen_expr).desc())
            .limit(8)
            .all()
        )
        for location, cnt, last_seen in exp_rows:
            expansion_opportunities.append(
                {
                    "location": (location or "").strip(),
                    "lead_count": int(cnt or 0),
                    "last_seen_iso": last_seen.isoformat() if last_seen else None,
                }
            )
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("expansion_opportunities unavailable: %s", exc)

    # =========================================================================
    # COORDINATOR LEADERBOARD — RANKED BY COMPLETIONS (closer attribution).
    # Uses leads.completed_by_user_id (migration 027) so we credit the person
    # who actually moved the lead into a converted status, not the assignee.
    # =========================================================================
    coordinator_leaderboard: list[dict] = []
    try:
        if hasattr(Lead, "completed_by_user_id"):
            thirty_days_ago = now - timedelta(days=30)
            recent_completion_case = case(
                (
                    (Lead.completed_at.isnot(None))
                    & (Lead.completed_at >= thirty_days_ago),
                    1,
                ),
                else_=0,
            )
            # Build assignment-volume map keyed by user_id. Older schemas
            # exposed this column as `assigned_to`; newer ones use
            # `assigned_coordinator_id`. We probe both so the leaderboard
            # works on either layout without a migration.
            assignment_counts: dict[Any, int] = {}
            assignment_col = (
                getattr(Lead, "assigned_coordinator_id", None)
                or getattr(Lead, "assigned_to_id", None)
                or getattr(Lead, "assigned_to", None)
            )
            if assignment_col is not None:
                assign_rows = (
                    db.query(assignment_col, func.count(Lead.id))
                    .filter(Lead.deleted_at.is_(None), assignment_col.isnot(None))
                    .group_by(assignment_col)
                    .all()
                )
                assignment_counts = {uid: int(c or 0) for uid, c in assign_rows}

            # Explicit closer attribution wins. For older completed leads that
            # predate completed_by_user_id, fall back only to an explicit
            # assignee; otherwise surface them as unattributed instead of
            # guessing a coordinator.
            owner_expr = Lead.completed_by_user_id
            legacy_assigned_case = case((Lead.id.is_(None), 1), else_=0)
            if assignment_col is not None:
                owner_expr = func.coalesce(Lead.completed_by_user_id, assignment_col)
                legacy_assigned_case = case(
                    (
                        (Lead.completed_by_user_id.is_(None))
                        & (assignment_col.isnot(None)),
                        1,
                    ),
                    else_=0,
                )

            closed_statuses = (LeadStatus.CONSULTATION_COMPLETE, LeadStatus.TREATMENT_STARTED)
            completion_rows = (
                db.query(
                    User.id,
                    User.first_name,
                    User.last_name,
                    func.count(Lead.id).label("completions"),
                    func.sum(recent_completion_case).label("completions_30d"),
                    func.sum(legacy_assigned_case).label("legacy_assigned"),
                )
                .select_from(Lead)
                .join(User, User.id == owner_expr)
                .filter(
                    Lead.deleted_at.is_(None),
                    Lead.status.in_(closed_statuses),
                    owner_expr.isnot(None),
                )
                .group_by(User.id, User.first_name, User.last_name)
                .order_by(func.count(Lead.id).desc())
                .limit(10)
                .all()
            )

            for uid, fn, ln, completions, completions_30d, legacy_assigned in completion_rows:
                completions_i = int(completions or 0)
                completions_30d_i = int(completions_30d or 0)
                touches = assignment_counts.get(uid, completions_i)
                rate = (
                    round(100.0 * completions_i / touches, 1) if touches else 0.0
                )
                legacy_i = int(legacy_assigned or 0)
                coordinator_leaderboard.append(
                    {
                        "name": f"{fn or ''} {ln or ''}".strip() or "Unknown",
                        "touches": touches,
                        "completions": completions_i,
                        "completions_30d": completions_30d_i,
                        # `conversions` + `rate` kept for backward-compat with the
                        # existing dashboard component.
                        "conversions": completions_i,
                        "rate": rate,
                        "note": (
                            "Includes legacy assigned completions closed before closer attribution was enabled."
                            if legacy_i else None
                        ),
                    }
                )

            unattributed_filter = [
                Lead.deleted_at.is_(None),
                Lead.status.in_(closed_statuses),
                Lead.completed_by_user_id.is_(None),
            ]
            if assignment_col is not None:
                unattributed_filter.append(assignment_col.is_(None))
            unattributed = (
                db.query(
                    func.count(Lead.id),
                    func.sum(recent_completion_case),
                )
                .filter(*unattributed_filter)
                .first()
            )
            unattributed_count = int((unattributed[0] if unattributed else 0) or 0)
            if unattributed_count:
                unattributed_30d = int((unattributed[1] if unattributed else 0) or 0)
                coordinator_leaderboard.append(
                    {
                        "name": "Unattributed historical completions",
                        "touches": unattributed_count,
                        "completions": unattributed_count,
                        "completions_30d": unattributed_30d,
                        "conversions": unattributed_count,
                        "rate": 0.0,
                        "note": (
                            "These closed leads have no closer or assignee recorded, so the agent will not guess ownership."
                        ),
                    }
                )
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("coordinator leaderboard unavailable: %s", exc)

    return InsightMetrics(
        total_leads=total_leads,
        new_last_7d=new_last_7d,
        contacted=contacted,
        scheduled=scheduled,
        consultation_complete=consultation_complete,
        treatment_started=treatment_started,
        not_interested=not_interested,
        unreachable=unreachable,
        in_service_area=in_service_area,
        referrals=referrals,
        hot=hot,
        medium=medium,
        low=low,
        no_answer_stale=no_answer_stale,
        callbacks_due=callbacks_due,
        new_untouched=new_untouched,
        active_pipeline=active_pipeline,
        insured_open=insured_open,
        avg_first_contact_hours=avg_first_contact_hours,
        answer_rate_by_window=answer_rate_by_window,
        success_rate_by_method=success_rate_by_method,
        geographic_breakdown=geographic_breakdown,
        expansion_opportunities=expansion_opportunities,
        top_conditions=top_conditions,
        tms_interest=tms_interest,
        lead_sources=lead_sources,
        coordinator_leaderboard=coordinator_leaderboard,
    )


# =============================================================================
# AI model integration
# =============================================================================


SYSTEM_PROMPT = """You are an expert lead-generation consultant embedded inside
NeuroReach AI — a HIPAA-compliant patient-intake SaaS used by clinics to manage
mental-health consultations.

You receive aggregated, **non-PHI** metrics about one clinic's pipeline. Your
job is to produce a structured JSON "insight dashboard" a coordinator can act
on in the next hour.

ABSOLUTE GROUNDING RULES — read carefully, every value you emit must be
defensible from the input:

  1. NEVER invent numbers. If `avg_first_contact_hours` is in the input, you
     must use that exact value. Do not round, recompute, or guess.
  2. The `communication.best_channel` and `communication.best_time` fields
     MUST come from the input's `signals.success_rate_by_method` and
     `signals.answer_rate_by_window` — pick the highest-percentage entry that
     has at least 3 attempts. If no window/method has ≥3 attempts, return the
     literal string "Insufficient data" for the corresponding field — do not
     fabricate "SMS" or "Weekdays 10am-noon".
  3. `whats_happening` tiles must reference values that already exist in the
     input. Allowed examples:
        - new_untouched, new_last_7d
        - no_answer_stale_gt_3d, callbacks_due_now
        - insured_open, scheduled
        - active_pipeline
     Do NOT introduce metrics like "Avg first contact" with a number unless
     `avg_first_contact_hours` is non-null in the input.
  4. `geographic.note` MUST use the resolved location names from
     `signals.geographic_breakdown[].label` (e.g. "Scottsdale, AZ") — NEVER
     output raw ZIP codes like "ZIP 85032" or bare 5-digit numbers. Location
     names are pre-resolved offline and supplied in the input data. If
     `signals.geographic_breakdown` is empty, state "No intake location data
     captured yet."
  5. `expansion.signals` must come from `signals.expansion_opportunities`
     entries. If the array is empty, return a single signal of "No locations
     captured yet — encourage coordinators to fill the location field on
     calls."
  6. `coordinator_performance` should mirror the input's
     `coordinator_leaderboard` exactly (preserving names, completions,
     completions_30d, rate). You may add a 1-line `note` per coordinator that
     calls out their 30-day momentum.

Write in a direct, operational tone. Every recommendation must reference a
specific metric from the input, and must be something a coordinator can
literally do today. Avoid generic advice.

Never reference or attempt to infer individual patient information.

Return ONLY a valid JSON object matching this shape exactly:

{
  "health_score": {
    "score": int,              // 0-100
    "label": "Excellent"|"Good"|"Needs attention"|"At risk",
    "summary": string,         // one sentence, ≤120 chars
    "trend": "up"|"flat"|"down"
  },
  "whats_happening": [          // 4-5 items, all backed by input metrics
    {"label": string, "value": string, "detail": string, "tone": "positive"|"neutral"|"warning"}
  ],
  "funnel": [                   // ordered top-of-funnel → converted
    {"stage": string, "count": int, "conversion_from_prev": float|null}
  ],
  "recommendations": [          // 3-4 items
    {"title": string, "why": string, "action": string, "impact": "high"|"medium"|"low"}
  ],
  "communication": {
    "best_channel": string,     // FROM signals.success_rate_by_method or "Insufficient data"
    "best_time": string,        // FROM signals.answer_rate_by_window or "Insufficient data"
    "templates": [              // 2 items
      {"title": string, "scenario": string, "body": string}
    ]
  },
  "coordinator_performance": [  // mirrors signals.coordinator_leaderboard
    {"name": string, "touches": int, "conversions": int, "rate": float, "note": string}
  ],
   "geographic": {
     "in_service_share": float,  // %
     "note": string
   },
  "expansion": {
    "note": string,
    "signals": [string]         // 1-3 short signals
  }
}"""


def _build_user_message(metrics: InsightMetrics) -> str:
    return json.dumps(
        {
            "totals": {
                "total_leads": metrics.total_leads,
                "new_last_7d": metrics.new_last_7d,
                "in_service_area_share_pct": (
                    round(100.0 * metrics.in_service_area / metrics.total_leads, 1)
                    if metrics.total_leads
                    else 0
                ),
                "conversion_rate_pct": metrics.conversion_rate,
                "referrals": metrics.referrals,
            },
            "pipeline_counts": {
                "active_pipeline": metrics.active_pipeline,
                "new_untouched": metrics.new_untouched,
                "contacted": metrics.contacted,
                "scheduled": metrics.scheduled,
                "consultation_complete": metrics.consultation_complete,
                "treatment_started": metrics.treatment_started,
                "not_interested": metrics.not_interested,
                "unreachable": metrics.unreachable,
                "insured_open": metrics.insured_open,
            },
            "priority_mix": {
                "hot": metrics.hot,
                "medium": metrics.medium,
                "low": metrics.low,
            },
            "operational_backlog": {
                "no_answer_stale_gt_3d": metrics.no_answer_stale,
                "callbacks_due_now": metrics.callbacks_due,
            },
            "speed_to_lead": {
                # null when there's no contact-attempt data yet — AI model must
                # NOT invent a value when this is null.
                "avg_first_contact_hours": metrics.avg_first_contact_hours,
            },
            # ---- Real signals AI model is required to ground on -----------------
            "signals": {
                "answer_rate_by_window": metrics.answer_rate_by_window,
                "success_rate_by_method": metrics.success_rate_by_method,
                "geographic_breakdown": metrics.geographic_breakdown,
                "expansion_opportunities": metrics.expansion_opportunities,
                "coordinator_leaderboard": metrics.coordinator_leaderboard,
            },
            "top_conditions": metrics.top_conditions,
            "tms_therapy_interest": metrics.tms_interest,
            "lead_sources": metrics.lead_sources,
            "now_iso": datetime.now(timezone.utc).isoformat(),
        },
        indent=2,
    )


def call_ai_model_for_insights(metrics: InsightMetrics) -> dict[str, Any]:
    """
    Synchronous AI model call (OpenAI Chat Completions).

    The static system prompt is sent first, so OpenAI's automatic prompt
    caching (stable prefixes ≥1024 tokens) keeps hourly refreshes cheap.
    JSON mode guarantees the response body is a single valid JSON object.

    Raises on failure — caller is responsible for surfacing the stub fallback.
    """
    if not settings.openai_api_key:
        raise RuntimeError("AI provider API key is not configured.")

    # Import lazily so the backend still boots when the SDK isn't installed
    # (e.g. fresh dev setup before `pip install`).
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key, timeout=90.0, max_retries=2)

    response = client.chat.completions.create(
        model=settings.openai_model,
        # Generous ceiling — reasoning models spend part of this budget on
        # internal reasoning tokens before emitting the JSON payload.
        max_completion_tokens=16384,
        # JSON mode — the SYSTEM_PROMPT already specifies the exact schema.
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_message(metrics)},
        ],
    )

    text = (response.choices[0].message.content or "") if response.choices else ""
    if not text.strip():
        raise RuntimeError("AI model returned no text content.")

    try:
        parsed = _extract_json_object(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"AI model returned non-JSON content: {exc}. "
            f"First 200 chars: {text[:200]!r}"
        ) from exc

    return parsed


# =============================================================================
# Cache + fallback stub
# =============================================================================


def _best_window(metrics: InsightMetrics) -> str:
    """
    Pick the time-of-day window with the highest answer rate, requiring at
    least 3 attempts to avoid declaring a winner from a single lucky call.
    """
    eligible = [
        (window, data["pct"], data["attempts"])
        for window, data in metrics.answer_rate_by_window.items()
        if data["attempts"] >= 3
    ]
    if not eligible:
        return "Insufficient data"
    window, _pct, _ = max(eligible, key=lambda t: t[1])
    return window.capitalize()


def _best_channel(metrics: InsightMetrics) -> str:
    eligible = [
        (method, data["pct"], data["attempts"])
        for method, data in metrics.success_rate_by_method.items()
        if data["attempts"] >= 3 and method.lower() not in ("unknown", "none", "")
    ]
    if not eligible:
        return "Insufficient data"
    method, _pct, _ = max(eligible, key=lambda t: t[1])
    # Keys are already display-formatted (e.g. "Phone", "SMS", "Video Call")
    # because success_rate_by_method is built with _display_name() in collect_metrics.
    return method


def _stub_insights(metrics: InsightMetrics) -> dict[str, Any]:
    """
    Deterministic, data-driven response rendered when the cache is cold and
    we don't want to block the UI on a 30s AI model call. AI model will replace
    this once the Celery refresh task lands.

    EVERY value here is computed from real DB aggregates — no hardcoded
    "SMS" / "Weekdays 10am-noon" defaults. If the dataset is too small to
    determine a winner, we surface "Insufficient data" honestly.
    """
    conv = metrics.conversion_rate
    if conv >= 25:
        score, label, tone = 82, "Excellent", "positive"
    elif conv >= 15:
        score, label, tone = 68, "Good", "positive"
    elif conv >= 5:
        score, label, tone = 50, "Needs attention", "neutral"
    else:
        score, label, tone = 32, "At risk", "warning"

    whats_happening: list[dict[str, Any]] = [
        {
            "label": "New (untouched)",
            "value": str(metrics.new_untouched),
            "detail": "NEW leads with zero contact attempts — work first.",
            "tone": "warning" if metrics.new_untouched > 0 else "positive",
        },
        {
            "label": "No-answer backlog",
            "value": str(metrics.no_answer_stale),
            "detail": "NO_ANSWER leads not contacted in 3+ days.",
            "tone": "warning" if metrics.no_answer_stale > 5 else "neutral",
        },
        {
            "label": "Insured open",
            "value": str(metrics.insured_open),
            "detail": "Insured leads still in the active pipeline.",
            "tone": "positive" if metrics.insured_open > 0 else "neutral",
        },
        {
            "label": "Callbacks due",
            "value": str(metrics.callbacks_due),
            "detail": "CALLBACK_REQUESTED past their scheduled time.",
            "tone": "warning" if metrics.callbacks_due > 0 else "positive",
        },
        {
            "label": "Scheduled",
            "value": str(metrics.scheduled),
            "detail": "Consultations on the books.",
            "tone": tone,
        },
    ]
    # Only surface avg-first-contact when we actually computed it.
    if metrics.avg_first_contact_hours is not None:
        whats_happening.append(
            {
                "label": "Avg first contact",
                "value": f"{metrics.avg_first_contact_hours}h",
                "detail": "Mean hours between intake and first outreach.",
                "tone": (
                    "positive" if metrics.avg_first_contact_hours <= 4
                    else "warning" if metrics.avg_first_contact_hours >= 24
                    else "neutral"
                ),
            }
        )

    # Map best window string back to a human-readable time band.
    window_label_map = {
        "Morning": "Mornings (5am–11am)",
        "Midday": "Midday (11am–1pm)",
        "Afternoon": "Afternoons (1pm–5pm)",
        "Evening": "Evenings (5pm–10pm)",
    }
    best_window_raw = _best_window(metrics)
    best_window_label = window_label_map.get(best_window_raw, best_window_raw)

    expansion_signals: list[str] = []
    if metrics.expansion_opportunities:
        for opp in metrics.expansion_opportunities[:3]:
            expansion_signals.append(
                f"{opp['location']} — {opp['lead_count']} lead"
                f"{'s' if opp['lead_count'] != 1 else ''} captured"
            )
    else:
        expansion_signals.append(
            "No locations captured yet — encourage coordinators to fill the "
            "Lead Location field on calls."
        )

    geographic_note_parts: list[str] = []
    if metrics.geographic_breakdown:
        top = metrics.geographic_breakdown[0]
        geographic_note_parts.append(
            f"Top area: {top['label']} ({top['count']} leads, "
            f"{top['rate_pct']}% conversion)."
        )
    geographic_note_parts.append(
        f"{metrics.in_service_area} of {metrics.total_leads} leads are inside "
        f"the clinic service area."
    )

    return {
        "health_score": {
            "score": score,
            "label": label,
            "summary": f"Overall conversion at {conv}% across {metrics.total_leads} leads.",
            "trend": "flat",
        },
        "whats_happening": whats_happening,
        "funnel": [
            {"stage": "New", "count": metrics.total_leads, "conversion_from_prev": None},
            {
                "stage": "Contacted",
                "count": metrics.contacted,
                "conversion_from_prev": (
                    round(100.0 * metrics.contacted / metrics.total_leads, 1)
                    if metrics.total_leads
                    else 0.0
                ),
            },
            {
                "stage": "Scheduled",
                "count": metrics.scheduled,
                "conversion_from_prev": (
                    round(100.0 * metrics.scheduled / metrics.contacted, 1)
                    if metrics.contacted
                    else 0.0
                ),
            },
            {
                "stage": "Completed",
                "count": metrics.consultation_complete + metrics.treatment_started,
                "conversion_from_prev": (
                    round(
                        100.0 * (metrics.consultation_complete + metrics.treatment_started)
                        / metrics.scheduled,
                        1,
                    )
                    if metrics.scheduled
                    else 0.0
                ),
            },
        ],
        "recommendations": [
            {
                "title": "Clear the no-answer backlog",
                "why": f"{metrics.no_answer_stale} NO_ANSWER leads haven't been contacted in 3+ days.",
                "action": "Open the Follow-up queue and work down the oldest rows first.",
                "impact": "high" if metrics.no_answer_stale > 10 else "medium",
            },
            {
                "title": "Confirm scheduled consultations",
                "why": f"{metrics.scheduled} leads are scheduled — a confirmation SMS boosts show-rate.",
                "action": "Bulk-send the appointment-reminder template 24h before each slot.",
                "impact": "medium",
            },
        ],
        "communication": {
            # REAL: derived from interactions × outcome, not hardcoded.
            "best_channel": _best_channel(metrics),
            "best_time": best_window_label,
            "templates": [
                {
                    "title": "Follow-up after no answer",
                    "scenario": "Lead did not pick up on the first attempt.",
                    "body": (
                        "Hi {{first_name}}, this is the team at NeuroReach. I tried "
                        "reaching you about your recent inquiry. Is there a better "
                        "time to talk this week?"
                    ),
                },
                {
                    "title": "Appointment reminder",
                    "scenario": "Lead has a confirmed consultation in the next 24h.",
                    "body": (
                        "Hi {{first_name}}, quick reminder about your consultation "
                        "at {{time}}. Reply 'YES' to confirm or 'RESCHEDULE'."
                    ),
                },
            ],
        },
        "coordinator_performance": metrics.coordinator_leaderboard,
        "geographic": {
            "in_service_share": (
                round(100.0 * metrics.in_service_area / metrics.total_leads, 1)
                if metrics.total_leads
                else 0.0
            ),
            "note": " ".join(geographic_note_parts),
        },
        "expansion": {
            "note": (
                "Coordinator-captured locations show where conversion demand "
                "is concentrating — use this to plan expansion."
                if metrics.expansion_opportunities
                else "No locations captured yet. Encourage coordinators to fill the "
                "Lead Location field during calls — this powers expansion analysis."
            ),
            "signals": expansion_signals,
        },
        # Pass through the real signals so the frontend can render rich cards.
        "tms_interest": metrics.tms_interest,
        "lead_sources": metrics.lead_sources,
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "narrative_source": "deterministic",
            "geographic_source": "zip_code_resolved_location",
            "expansion_source": "lead_location",
        },
        "metrics": {
            "active_pipeline": metrics.active_pipeline,
            "insured_open": metrics.insured_open,
            "avg_first_contact_hours": metrics.avg_first_contact_hours,
            "new_untouched": metrics.new_untouched,
            "new_last_7d": metrics.new_last_7d,
            "no_answer_stale": metrics.no_answer_stale,
            "callbacks_due": metrics.callbacks_due,
            "scheduled": metrics.scheduled,
            "answer_rate_by_window": metrics.answer_rate_by_window,
            "success_rate_by_method": metrics.success_rate_by_method,
            "geographic_breakdown": metrics.geographic_breakdown,
            "expansion_opportunities": metrics.expansion_opportunities,
        },
    }


def get_insights(
    db: Session, force_refresh: bool = False
) -> tuple[dict[str, Any], str]:
    """
    Return the current AI Insights dict + a status label indicating where it
    came from:

        "cache"   — fresh cache hit, nothing else done.
        "stub"    — cold cache; we just returned the deterministic stub and
                    the caller should kick off the Celery refresh task.
        "fresh"   — force_refresh=True synchronously called AI model (expensive,
                    only used by tests / manual scripts).
    """
    cache = get_cache()
    if not force_refresh:
        cached = cache.get(INSIGHTS_CACHE_KEY)
        if cached:
            return cached, "cache"

    metrics = collect_metrics(db)

    if force_refresh and settings.openai_api_key:
        try:
            result = call_ai_model_for_insights(metrics)
            result = _attach_real_metrics(result, metrics)
            cache.set(
                INSIGHTS_CACHE_KEY,
                result,
                ttl=settings.ai_insights_cache_ttl,
            )
            return result, "fresh"
        except Exception as exc:
            logger.exception("force_refresh AI model call failed: %s", exc)
            # fall through to stub

    stub = _stub_insights(metrics)
    # Populate cache with the stub so rapid reloads don't re-hit the DB
    # aggregation every second. Short TTL — Celery should replace it soon.
    cache.set(INSIGHTS_CACHE_KEY, stub, ttl=60)
    return stub, "stub"


def refresh_live_insights_snapshot(db: Session) -> dict[str, Any]:
    """
    Recompute the dashboard from live database aggregates and write it to cache.

    This is the fast path used by the refresh button. It makes the visible
    numbers update immediately, then Celery can replace the deterministic copy
    with AI model-authored narrative when the model call completes.
    """
    metrics = collect_metrics(db)
    snapshot = _stub_insights(metrics)
    snapshot["metadata"] = {
        **(snapshot.get("metadata") or {}),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "narrative_source": "deterministic",
        "refresh_state": "ai_refresh_queued",
        "geographic_source": "zip_code_resolved_location",
        "expansion_source": "lead_location",
    }
    get_cache().set(
        INSIGHTS_CACHE_KEY,
        snapshot,
        # Keep the live snapshot around long enough for the UI to stay useful
        # even if the model provider is slow, but short enough that a failed
        # worker does not masquerade as a freshly generated AI narrative.
        ttl=min(settings.ai_insights_cache_ttl, 300),
    )
    return snapshot


def _attach_real_metrics(result: dict[str, Any], metrics: InsightMetrics) -> dict[str, Any]:
    """
    Overlay the model's narrative response with strictly-real metric values.
    Even if AI model tries to invent a number for `avg_first_contact_hours` or
    `best_channel`, this overwrites with what the DB actually says. The
    frontend reads `result["metrics"]` for the precise numbers and uses
    AI model's prose for the narrative copy only.
    """
    result["metrics"] = {
        "active_pipeline": metrics.active_pipeline,
        "insured_open": metrics.insured_open,
        "avg_first_contact_hours": metrics.avg_first_contact_hours,
        "new_untouched": metrics.new_untouched,
        "new_last_7d": metrics.new_last_7d,
        "no_answer_stale": metrics.no_answer_stale,
        "callbacks_due": metrics.callbacks_due,
        "scheduled": metrics.scheduled,
        "answer_rate_by_window": metrics.answer_rate_by_window,
        "success_rate_by_method": metrics.success_rate_by_method,
        "geographic_breakdown": metrics.geographic_breakdown,
        "expansion_opportunities": metrics.expansion_opportunities,
    }
    result["tms_interest"] = metrics.tms_interest
    result["lead_sources"] = metrics.lead_sources
    result["geographic"] = {
        "in_service_share": (
            round(100.0 * metrics.in_service_area / metrics.total_leads, 1)
            if metrics.total_leads
            else 0.0
        ),
        "note": (
            (
                f"Top area: {metrics.geographic_breakdown[0]['label']} "
                f"({metrics.geographic_breakdown[0]['count']} leads, "
                f"{metrics.geographic_breakdown[0]['rate_pct']}% conversion). "
            )
            if metrics.geographic_breakdown
            else "No intake location data captured yet. "
        )
        + f"{metrics.in_service_area} of {metrics.total_leads} leads are inside the clinic service area.",
    }
    if metrics.expansion_opportunities:
        result["expansion"] = {
            "note": (
                "Coordinator-captured locations show where conversion demand "
                "is concentrating — use this to plan expansion."
            ),
            "signals": [
                f"{opp['location']} — {opp['lead_count']} lead"
                f"{'s' if opp['lead_count'] != 1 else ''} captured"
                for opp in metrics.expansion_opportunities[:3]
            ],
        }
    else:
        result["expansion"] = {
            "note": (
                "No coordinator-captured locations yet. Encourage coordinators "
                "to fill the Lead Location field during calls — this powers "
                "expansion analysis."
            ),
            "signals": [
                "No locations captured yet — encourage coordinators to fill the location field on calls."
            ],
        }
    result["metadata"] = {
        **(result.get("metadata") or {}),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "narrative_source": "ai",
        "geographic_source": "zip_code_resolved_location",
        "expansion_source": "lead_location",
    }
    # Also force-correct best_channel / best_time from the DB so a stray
    # AI model hallucination cannot leak into the dashboard.
    if "communication" in result and isinstance(result["communication"], dict):
        result["communication"]["best_channel"] = _best_channel(metrics)
        win_raw = _best_window(metrics)
        result["communication"]["best_time"] = {
            "Morning": "Mornings (5am–11am)",
            "Midday": "Midday (11am–1pm)",
            "Afternoon": "Afternoons (1pm–5pm)",
            "Evening": "Evenings (5pm–10pm)",
        }.get(win_raw, win_raw)
    # Mirror coordinator leaderboard precisely (preserve the 30d momentum field).
    if metrics.coordinator_leaderboard:
        result["coordinator_performance"] = metrics.coordinator_leaderboard
    return result


def refresh_insights_sync(db: Session) -> dict[str, Any]:
    """
    Called from the Celery task. Runs the DB aggregation, releases the DB
    session, calls AI model (7-30s), then writes the result to Redis.

    CRITICAL: We commit + close the DB session BEFORE the AI model call so
    Postgres's `idle_in_transaction_session_timeout=30s` doesn't kill the
    connection mid-flight. The aggregated metrics are pure Python by the
    time we hand them to AI model, so holding the DB session through the
    network call adds zero benefit and lots of risk.
    """
    metrics = collect_metrics(db)
    # Release the DB session immediately — AI model call below can take 30s+
    # which is the postgres idle-in-transaction kill window.
    try:
        db.commit()
    except Exception:
        db.rollback()
    db.close()

    if not settings.openai_api_key:
        result = _stub_insights(metrics)
        get_cache().set(
            INSIGHTS_CACHE_KEY,
            result,
            ttl=min(settings.ai_insights_cache_ttl, 300),
        )
        return result

    result = call_ai_model_for_insights(metrics)
    result = _attach_real_metrics(result, metrics)
    get_cache().set(
        INSIGHTS_CACHE_KEY,
        result,
        ttl=settings.ai_insights_cache_ttl,
    )
    return result


# =============================================================================
# Per-lead email drafts
# =============================================================================


EMAIL_SYSTEM_PROMPT = """You are a senior patient-care coordinator at a
HIPAA-compliant TMS / mental-health clinic. You write outreach emails that
feel personal, calm, and competent — the opposite of marketing copy.

You will receive a JSON object describing one lead's current state:
funnel queue, contact outcome history, condition, urgency, insurance,
referral source, and (when available) the city/area the coordinator
captured during a prior call.

Match the email tone *strictly* to the queue + outcome:

  • status=NEW                          → warm first-touch; reference how they
                                          reached out; offer a short call.
  • status=CONTACTED, outcome=NO_ANSWER → "tried to reach you" tone; offer 2-3
                                          windows; one short paragraph + one
                                          line invitation.
  • status=CONTACTED, outcome=UNREACHABLE → low-pressure check-in; ask if
                                          their preferred contact info has
                                          changed.
  • status=CONTACTED, outcome=NOT_INTERESTED → graceful door-open; no
                                          re-pitching; one sentence offering
                                          to be a future resource.
  • status=CONTACTED, outcome=CALLBACK_REQUESTED → confirm the time; reiterate
                                          the number you'll call from.
  • status=SCHEDULED                    → upbeat confirmation tone; restate
                                          appointment context if known.
  • status=CONSULTATION_COMPLETE / TREATMENT_STARTED → thank-you + next steps.

Hard rules:
  • ≤160 words.
  • No emoji. No marketing jargon ("revolutionary", "transform", etc.).
  • No invented clinical advice or treatment claims.
  • If `lead_location` is provided, weave it naturally (e.g. "since you're
    out in {{location}}…") only when it adds warmth. Never force it.
  • If `is_referral` is true, acknowledge the referring provider warmly.
  • Sign off as the clinic's care coordinator; never invent a personal name.
  • Subject line ≤ 60 chars, no ALL CAPS, no exclamation points.

Return ONLY a JSON object — no prose around it:
{"subject": string, "body": string}"""


def _email_prompt_payload(db: Session, lead: Lead) -> dict[str, Any]:
    """
    Build the structured context AI model uses to write the email.
    Pulls only non-PHI signals plus the first name (needed for greeting).
    """
    decrypted = EncryptionService.decrypt_lead_phi(lead)

    payload: dict[str, Any] = {
        "first_name": decrypted.get("first_name") or "there",
        "condition": lead.condition.value if lead.condition else None,
        "tms_therapy_interest": lead.tms_therapy_interest,
        "priority": lead.priority.value if lead.priority else None,
        "status": lead.status.value if lead.status else None,
        "contact_outcome": lead.contact_outcome.value if lead.contact_outcome else None,
        "follow_up_reason": lead.follow_up_reason,
        "contact_attempts": lead.contact_attempts or 0,
        "in_service_area": bool(lead.in_service_area),
        "is_referral": bool(lead.is_referral),
        "has_insurance": bool(lead.has_insurance),
        "insurance_provider": lead.insurance_provider,
        "urgency": lead.urgency.value if lead.urgency else None,
        # Coordinator-captured city/area (richer than ZIP for personalization).
        "lead_location": lead.lead_location,
        # Days since the lead reached out (helps AI model calibrate urgency).
        "days_since_intake": (
            (datetime.now(timezone.utc) - lead.created_at).days
            if lead.created_at else None
        ),
        # Days since the last outreach attempt (None = never tried).
        "days_since_last_attempt": (
            (datetime.now(timezone.utc) - lead.last_contact_attempt).days
            if lead.last_contact_attempt else None
        ),
        # Scheduled visit context (only present when status = SCHEDULED).
        "scheduled_at": (
            lead.scheduled_callback_at.isoformat()
            if lead.scheduled_callback_at else None
        ),
    }
    return {k: v for k, v in payload.items() if v is not None}


def generate_email_draft(db: Session, lead: Lead) -> dict[str, Any]:
    """
    Generate a queue-aware AI email draft for a lead.

    Strict-AI policy: there is no template fallback. If the AI provider is not
    configured or returns malformed output, this raises — the API layer
    converts that into an honest 503 / 502 rather than silently shipping
    a generic template under the "AI Recommended" label.

    Cached 30 min per lead so repeated opens of the same dialog are instant.
    """
    cache = get_cache()
    cache_key = EMAIL_DRAFT_CACHE_KEY.format(lead_id=str(lead.id))
    cached = cache.get(cache_key)
    if cached:
        return cached

    if not settings.openai_api_key:
        # Caller (HTTP layer) maps this to 503 SERVICE_UNAVAILABLE so the UI
        # shows a real error instead of the old silent template masquerading
        # as AI output.
        raise RuntimeError(
            "AI provider API key is not configured. The AI Recommended email "
            "feature requires the provider key to be set."
        )

    payload = _email_prompt_payload(db, lead)

    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key, timeout=60.0, max_retries=2)
    response = client.chat.completions.create(
        model=settings.openai_model,
        # Headroom for reasoning tokens + a ≤160-word email body.
        max_completion_tokens=2048,
        # Strict structured output — the API guarantees {subject, body}.
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "email_draft",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "subject": {"type": "string"},
                        "body": {"type": "string"},
                    },
                    "required": ["subject", "body"],
                    "additionalProperties": False,
                },
            },
        },
        messages=[
            # Static system prompt first — eligible for OpenAI automatic
            # prompt caching when combined prefix exceeds 1024 tokens.
            {"role": "system", "content": EMAIL_SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload)},
        ],
    )

    text = (response.choices[0].message.content or "") if response.choices else ""
    if not text.strip():
        raise RuntimeError("AI model returned no email draft content.")

    try:
        parsed = _extract_json_object(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"AI model returned invalid JSON: {exc}. "
            f"First 200 chars: {text[:200]!r}"
        ) from exc

    if not isinstance(parsed, dict) or "subject" not in parsed or "body" not in parsed:
        raise RuntimeError(
            "AI model email draft is missing 'subject' or 'body'. "
            f"Got keys: {list(parsed.keys()) if isinstance(parsed, dict) else type(parsed).__name__}"
        )

    parsed["ai_generated"] = True
    # Echo the queue context back so the frontend can show *why* the email
    # is shaped the way it is ("Premium re-engagement for Hot lead in
    # Contacted/No Answer queue").
    parsed["queue_context"] = {
        "status": payload.get("status"),
        "contact_outcome": payload.get("contact_outcome"),
        "priority": payload.get("priority"),
        "follow_up_reason": payload.get("follow_up_reason"),
    }
    cache.set(cache_key, parsed, ttl=EMAIL_DRAFT_TTL)
    return parsed
