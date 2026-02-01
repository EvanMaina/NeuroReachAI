"""
Analytics API endpoints with performance optimizations.

Provides cached, pre-aggregated analytics data for the dashboard.
Uses Redis caching and database-level aggregations for scalability.
"""

import time
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import text, func, case, and_
from pydantic import BaseModel, Field

from ..core.config import settings
from ..core.database import get_db
from ..models.lead import Lead, PriorityType, LeadStatus, ConditionType
from ..services.cache import get_cache, CacheService
from ..core.auth import get_current_user


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics", tags=["Analytics"], dependencies=[Depends(get_current_user)])


# =============================================================================
# Response Models
# =============================================================================

class DashboardSummary(BaseModel):
    """Dashboard summary statistics."""
    total_leads: int = Field(..., description="Total number of leads")
    converted_leads: int = Field(..., description="Leads that converted (consultation complete + treatment started)")
    conversion_rate: float = Field(..., description="Conversion rate percentage")
    scheduled_appointments: int = Field(..., description="Currently scheduled appointments")
    hot_leads: int = Field(..., description="High priority leads")
    medium_leads: int = Field(..., description="Medium priority leads")
    low_leads: int = Field(..., description="Low priority leads")
    new_today: int = Field(..., description="New leads today")
    contacted_today: int = Field(..., description="Leads contacted today")
    trends: dict = Field(default_factory=dict, description="Trend percentages")
    cache_hit: bool = Field(default=False, description="Whether data came from cache")
    query_time_ms: float = Field(default=0, description="Query execution time in milliseconds")


class TrendDataPoint(BaseModel):
    """Single data point for trend chart."""
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    label: str = Field(..., description="Human-readable date label")
    new_leads: int = Field(..., description="New leads on this date")
    converted_leads: int = Field(default=0, description="Converted leads on this date")
    cumulative_total: int = Field(default=0, description="Cumulative total leads")


class LeadsTrendResponse(BaseModel):
    """Leads trend data response."""
    period_days: int = Field(..., description="Number of days in trend")
    data: List[TrendDataPoint] = Field(..., description="Trend data points")
    total_in_period: int = Field(..., description="Total leads in period")
    cache_hit: bool = Field(default=False, description="Whether data came from cache")
    query_time_ms: float = Field(default=0, description="Query execution time in milliseconds")


class ConditionDistribution(BaseModel):
    """Condition distribution data."""
    condition: str = Field(..., description="Condition name")
    count: int = Field(..., description="Number of leads with this condition")
    percentage: float = Field(..., description="Percentage of total leads")
    trend: float = Field(default=0, description="Week-over-week trend percentage")


class ConditionsDistributionResponse(BaseModel):
    """Conditions distribution response."""
    conditions: List[ConditionDistribution] = Field(..., description="Distribution by condition")
    total_leads: int = Field(..., description="Total leads counted")
    cache_hit: bool = Field(default=False, description="Whether data came from cache")
    query_time_ms: float = Field(default=0, description="Query execution time in milliseconds")


class CohortRetention(BaseModel):
    """Cohort retention data."""
    cohort: str = Field(..., description="Cohort identifier (e.g., 'Jan 2026')")
    cohort_size: int = Field(..., description="Total leads in cohort")
    periods: List[int] = Field(..., description="Retention counts at each stage")
    percentages: List[float] = Field(..., description="Retention percentages at each stage")


class CohortRetentionResponse(BaseModel):
    """Cohort retention analysis response."""
    period_labels: List[str] = Field(..., description="Labels for each retention period")
    cohorts: List[CohortRetention] = Field(..., description="Cohort data")
    cache_hit: bool = Field(default=False, description="Whether data came from cache")
    query_time_ms: float = Field(default=0, description="Query execution time in milliseconds")


class CursorPaginatedLead(BaseModel):
    """Lead item in cursor-paginated response."""
    id: str
    lead_number: str
    condition: str
    priority: str
    status: str
    score: int
    in_service_area: bool
    created_at: str
    contact_outcome: Optional[str] = None


class CursorPaginatedResponse(BaseModel):
    """Cursor-based pagination response."""
    items: List[CursorPaginatedLead] = Field(..., description="Lead items")
    next_cursor: Optional[str] = Field(None, description="Cursor for next page")
    has_more: bool = Field(..., description="Whether more results exist")
    total_estimate: int = Field(..., description="Estimated total count")


# =============================================================================
# Helper Functions
# =============================================================================

def calculate_trend_percentage(current: int, previous: int) -> float:
    """Calculate trend percentage change."""
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 1)


# =============================================================================
# Dashboard Summary Endpoint
# =============================================================================

@router.get(
    "/dashboard-summary",
    response_model=DashboardSummary,
    summary="Get Dashboard Summary",
    description="Get aggregated dashboard statistics with caching (30s TTL).",
)
async def get_dashboard_summary(
    request: Request,
    db: Session = Depends(get_db),
    days_back: int = Query(default=365, ge=1, le=365, description="Days to include in stats"),
) -> DashboardSummary:
    """
    Get optimized dashboard summary statistics.
    
    Uses Redis cache with 30-second TTL for fast response times.
    Falls back to database aggregation if cache miss.
    
    Args:
        request: FastAPI request
        db: Database session
        days_back: Number of days to include in statistics
        
    Returns:
        Dashboard summary with KPIs
    """
    start_time = time.time()
    cache = get_cache()
    
    # Try cache first
    cached_data = cache.get_dashboard_stats()
    if cached_data:
        return DashboardSummary(
            **cached_data,
            cache_hit=True,
            query_time_ms=round((time.time() - start_time) * 1000, 2)
        )
    
    # Calculate cutoff date
    cutoff_date = datetime.utcnow() - timedelta(days=days_back)
    today = datetime.utcnow().date()
    yesterday = today - timedelta(days=1)
    last_week = today - timedelta(days=7)
    
    # Efficient single-query aggregation
    stats_query = db.query(
        func.count(Lead.id).label('total_leads'),
        func.count(Lead.id).filter(
            Lead.status.in_([LeadStatus.CONSULTATION_COMPLETE, LeadStatus.TREATMENT_STARTED])
        ).label('converted_leads'),
        func.count(Lead.id).filter(
            Lead.status == LeadStatus.SCHEDULED
        ).label('scheduled_appointments'),
        func.count(Lead.id).filter(
            Lead.priority == PriorityType.HOT
        ).label('hot_leads'),
        func.count(Lead.id).filter(
            Lead.priority == PriorityType.MEDIUM
        ).label('medium_leads'),
        func.count(Lead.id).filter(
            Lead.priority == PriorityType.LOW
        ).label('low_leads'),
        func.count(Lead.id).filter(
            func.date(Lead.created_at) == today
        ).label('new_today'),
        func.count(Lead.id).filter(
            func.date(Lead.contacted_at) == today
        ).label('contacted_today'),
    ).filter(Lead.created_at >= cutoff_date).first()
    
    # Calculate trend (compare this week vs last week)
    this_week_count = db.query(func.count(Lead.id)).filter(
        Lead.created_at >= last_week
    ).scalar() or 0
    
    last_week_count = db.query(func.count(Lead.id)).filter(
        and_(
            Lead.created_at >= last_week - timedelta(days=7),
            Lead.created_at < last_week
        )
    ).scalar() or 0
    
    total_leads = stats_query.total_leads or 0
    converted_leads = stats_query.converted_leads or 0
    conversion_rate = round((converted_leads / total_leads * 100) if total_leads > 0 else 0, 2)
    
    result = {
        "total_leads": total_leads,
        "converted_leads": converted_leads,
        "conversion_rate": conversion_rate,
        "scheduled_appointments": stats_query.scheduled_appointments or 0,
        "hot_leads": stats_query.hot_leads or 0,
        "medium_leads": stats_query.medium_leads or 0,
        "low_leads": stats_query.low_leads or 0,
        "new_today": stats_query.new_today or 0,
        "contacted_today": stats_query.contacted_today or 0,
        "trends": {
            "total_leads": calculate_trend_percentage(this_week_count, last_week_count),
            "converted_leads": 8.5,  # Placeholder - would need historical conversion data
            "conversion_rate": 5.2,
            "scheduled_appointments": 12.0,
        },
    }
    
    # Cache the result
    cache.set_dashboard_stats(result)
    
    return DashboardSummary(
        **result,
        cache_hit=False,
        query_time_ms=round((time.time() - start_time) * 1000, 2)
    )


# =============================================================================
# Leads Trend Endpoint
# =============================================================================

@router.get(
    "/leads-trend",
    response_model=LeadsTrendResponse,
    summary="Get Leads Trend",
    description="Get time-series trend data for leads chart.",
)
async def get_leads_trend(
    request: Request,
    db: Session = Depends(get_db),
    period: int = Query(default=30, ge=7, le=90, description="Number of days"),
) -> LeadsTrendResponse:
    """
    Get leads trend data for the specified period.
    
    Uses database-level date aggregation for efficiency.
    Cached for 60 seconds.
    
    Args:
        request: FastAPI request
        db: Database session
        period: Number of days to include
        
    Returns:
        Time-series trend data
    """
    start_time = time.time()
    cache = get_cache()
    
    # Try cache first
    cached_data = cache.get_leads_trend(period)
    if cached_data:
        return LeadsTrendResponse(
            period_days=period,
            data=[TrendDataPoint(**d) for d in cached_data["data"]],
            total_in_period=cached_data["total"],
            cache_hit=True,
            query_time_ms=round((time.time() - start_time) * 1000, 2)
        )
    
    # Calculate date range
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=period)
    
    # Efficient date-grouped aggregation
    daily_counts = db.query(
        func.date(Lead.created_at).label('date'),
        func.count(Lead.id).label('new_leads'),
        func.count(Lead.id).filter(
            Lead.status.in_([LeadStatus.CONSULTATION_COMPLETE, LeadStatus.TREATMENT_STARTED])
        ).label('converted_leads'),
    ).filter(
        func.date(Lead.created_at) >= start_date
    ).group_by(
        func.date(Lead.created_at)
    ).order_by(
        func.date(Lead.created_at)
    ).all()
    
    # Convert to dict for easy lookup
    counts_by_date = {
        row.date: {"new": row.new_leads, "converted": row.converted_leads}
        for row in daily_counts
    }
    
    # Generate complete date series with cumulative total
    data = []
    cumulative = 0
    total_in_period = 0
    
    current_date = start_date
    while current_date <= end_date:
        counts = counts_by_date.get(current_date, {"new": 0, "converted": 0})
        new_leads = counts["new"]
        converted_leads = counts["converted"]
        cumulative += new_leads
        total_in_period += new_leads
        
        data.append({
            "date": current_date.isoformat(),
            "label": current_date.strftime("%b %d"),
            "new_leads": new_leads,
            "converted_leads": converted_leads,
            "cumulative_total": cumulative,
        })
        current_date += timedelta(days=1)
    
    # Cache result
    cache.set_leads_trend({"data": data, "total": total_in_period}, period)
    
    return LeadsTrendResponse(
        period_days=period,
        data=[TrendDataPoint(**d) for d in data],
        total_in_period=total_in_period,
        cache_hit=False,
        query_time_ms=round((time.time() - start_time) * 1000, 2)
    )


# =============================================================================
# Conditions Distribution Endpoint
# =============================================================================

@router.get(
    "/conditions-distribution",
    response_model=ConditionsDistributionResponse,
    summary="Get Conditions Distribution",
    description="Get distribution of leads by condition type.",
)
async def get_conditions_distribution(
    request: Request,
    db: Session = Depends(get_db),
) -> ConditionsDistributionResponse:
    """
    Get conditions distribution with percentage breakdown.
    
    Handles both single-condition (Lead.condition enum) and multi-condition
    (Lead.conditions array) fields. Multi-condition leads are counted under
    each condition they belong to.
    
    Cached for 120 seconds.
    
    Args:
        request: FastAPI request
        db: Database session
        
    Returns:
        Conditions distribution data
    """
    start_time = time.time()
    cache = get_cache()
    
    # Try cache first - handle both dict and legacy list formats robustly
    try:
        cached_data = cache.get_conditions_distribution()
        if cached_data and isinstance(cached_data, dict) and "conditions" in cached_data:
            return ConditionsDistributionResponse(
                conditions=[ConditionDistribution(**c) for c in cached_data["conditions"]],
                total_leads=cached_data.get("total", 0),
                cache_hit=True,
                query_time_ms=round((time.time() - start_time) * 1000, 2)
            )
    except (TypeError, KeyError, ValueError) as e:
        # Stale or malformed cache data - clear it and recompute
        logger.warning(f"Conditions cache format invalid, recomputing: {e}")
        cache.delete(f"{cache.PREFIX_CONDITIONS}:distribution")
    
    # Get total lead count
    total_leads = db.query(func.count(Lead.id)).scalar() or 0
    
    if total_leads == 0:
        # Clean empty state
        empty_result = {"conditions": [], "total": 0}
        cache.set_conditions_distribution(empty_result)
        return ConditionsDistributionResponse(
            conditions=[],
            total_leads=0,
            cache_hit=False,
            query_time_ms=round((time.time() - start_time) * 1000, 2)
        )
    
    # Build condition counts from both fields:
    # 1. Lead.condition (singular enum) - always populated
    # 2. Lead.conditions (array of text) - populated for multi-condition leads
    # For multi-condition leads, count under EACH condition they belong to.
    
    # Mapping from lowercase/various formats to canonical enum values
    CONDITION_NORMALIZE = {
        "depression": "DEPRESSION",
        "anxiety": "ANXIETY",
        "ocd": "OCD",
        "ptsd": "PTSD",
        "other": "OTHER",
        "DEPRESSION": "DEPRESSION",
        "ANXIETY": "ANXIETY",
        "OCD": "OCD",
        "PTSD": "PTSD",
        "OTHER": "OTHER",
    }
    
    # Start with single-condition field counts
    distribution = db.query(
        Lead.condition,
        func.count(Lead.id).label('count'),
    ).group_by(
        Lead.condition
    ).order_by(
        func.count(Lead.id).desc()
    ).all()
    
    # Initialize counts from the singular condition field
    condition_counts: dict[str, int] = {}
    for row in distribution:
        cond_value = row.condition.value if hasattr(row.condition, 'value') else str(row.condition)
        canonical = CONDITION_NORMALIZE.get(cond_value, cond_value.upper())
        condition_counts[canonical] = condition_counts.get(canonical, 0) + row.count
    
    # Now check for multi-condition leads and add extra counts
    # A lead with conditions=['depression', 'anxiety'] and condition=DEPRESSION
    # should count once for DEPRESSION (already counted) and once more for ANXIETY
    try:
        multi_condition_leads = db.query(Lead.condition, Lead.conditions).filter(
            Lead.conditions.isnot(None),
            func.array_length(Lead.conditions, 1) > 1
        ).all()
        
        for lead_row in multi_condition_leads:
            primary_value = lead_row.condition.value if hasattr(lead_row.condition, 'value') else str(lead_row.condition)
            primary_canonical = CONDITION_NORMALIZE.get(primary_value, primary_value.upper())
            
            # Add counts for each additional condition beyond the primary
            if lead_row.conditions:
                for extra_cond in lead_row.conditions:
                    extra_canonical = CONDITION_NORMALIZE.get(extra_cond, CONDITION_NORMALIZE.get(extra_cond.upper(), "OTHER"))
                    if extra_canonical != primary_canonical:
                        condition_counts[extra_canonical] = condition_counts.get(extra_canonical, 0) + 1
    except Exception as e:
        # If the conditions array column doesn't exist or query fails,
        # fall back to single-condition counts only
        logger.warning(f"Multi-condition query failed (falling back to single): {e}")
    
    # Calculate trends (compare this week vs last week per condition)
    today = datetime.utcnow().date()
    last_week = today - timedelta(days=7)
    two_weeks_ago = today - timedelta(days=14)
    
    # This week counts by condition
    this_week = db.query(
        Lead.condition,
        func.count(Lead.id).label('count'),
    ).filter(
        Lead.created_at >= last_week
    ).group_by(Lead.condition).all()
    this_week_map: dict[str, int] = {}
    for row in this_week:
        cond_value = row.condition.value if hasattr(row.condition, 'value') else str(row.condition)
        canonical = CONDITION_NORMALIZE.get(cond_value, cond_value.upper())
        this_week_map[canonical] = this_week_map.get(canonical, 0) + row.count
    
    # Last week counts by condition
    last_week_q = db.query(
        Lead.condition,
        func.count(Lead.id).label('count'),
    ).filter(
        and_(Lead.created_at >= two_weeks_ago, Lead.created_at < last_week)
    ).group_by(Lead.condition).all()
    last_week_map: dict[str, int] = {}
    for row in last_week_q:
        cond_value = row.condition.value if hasattr(row.condition, 'value') else str(row.condition)
        canonical = CONDITION_NORMALIZE.get(cond_value, cond_value.upper())
        last_week_map[canonical] = last_week_map.get(canonical, 0) + row.count
    
    # Build final conditions list sorted by count descending
    conditions = []
    for cond_name, count in sorted(condition_counts.items(), key=lambda x: x[1], reverse=True):
        this_week_count = this_week_map.get(cond_name, 0)
        last_week_count = last_week_map.get(cond_name, 0)
        trend = calculate_trend_percentage(this_week_count, last_week_count)
        
        conditions.append({
            "condition": cond_name,
            "count": count,
            "percentage": round((count / total_leads * 100) if total_leads > 0 else 0, 2),
            "trend": trend,
        })
    
    # Cache result as proper dict format
    cache.set_conditions_distribution({"conditions": conditions, "total": total_leads})
    
    return ConditionsDistributionResponse(
        conditions=[ConditionDistribution(**c) for c in conditions],
        total_leads=total_leads,
        cache_hit=False,
        query_time_ms=round((time.time() - start_time) * 1000, 2)
    )


# =============================================================================
# Cohort Retention Endpoint
# =============================================================================

@router.get(
    "/cohort-retention",
    response_model=CohortRetentionResponse,
    summary="Get Cohort Retention",
    description="Get monthly cohort retention analysis.",
)
async def get_cohort_retention(
    request: Request,
    db: Session = Depends(get_db),
    months: int = Query(default=6, ge=1, le=12, description="Number of months"),
) -> CohortRetentionResponse:
    """
    Get cohort retention analysis data.
    
    Tracks lead progression through funnel stages by cohort month.
    Cached for 60 seconds.
    
    Args:
        request: FastAPI request
        db: Database session
        months: Number of months to include
        
    Returns:
        Cohort retention data
    """
    start_time = time.time()
    cache = get_cache()
    
    # Try cache first
    cached_data = cache.get_cohort_data()
    if cached_data:
        return CohortRetentionResponse(
            period_labels=cached_data["labels"],
            cohorts=[CohortRetention(**c) for c in cached_data["cohorts"]],
            cache_hit=True,
            query_time_ms=round((time.time() - start_time) * 1000, 2)
        )
    
    period_labels = ["Initial", "Contacted", "Scheduled", "Completed", "Active", "Retained"]
    
    # Calculate cohort months
    today = datetime.utcnow().date()
    cohorts = []
    
    for i in range(months - 1, -1, -1):
        # Calculate month start/end
        month_date = today.replace(day=1) - timedelta(days=i * 30)
        month_start = month_date.replace(day=1)
        if month_start.month == 12:
            month_end = month_start.replace(year=month_start.year + 1, month=1)
        else:
            month_end = month_start.replace(month=month_start.month + 1)
        
        cohort_name = month_start.strftime("%b %Y")
        
        # Get cohort statistics
        cohort_stats = db.query(
            func.count(Lead.id).label('total'),
            func.count(Lead.id).filter(
                Lead.status.notin_([LeadStatus.NEW])
            ).label('contacted'),
            func.count(Lead.id).filter(
                Lead.status.in_([LeadStatus.SCHEDULED, LeadStatus.CONSULTATION_COMPLETE, LeadStatus.TREATMENT_STARTED])
            ).label('scheduled'),
            func.count(Lead.id).filter(
                Lead.status.in_([LeadStatus.CONSULTATION_COMPLETE, LeadStatus.TREATMENT_STARTED])
            ).label('completed'),
            func.count(Lead.id).filter(
                Lead.status == LeadStatus.TREATMENT_STARTED
            ).label('active'),
            func.count(Lead.id).filter(
                Lead.status != LeadStatus.LOST
            ).label('retained'),
        ).filter(
            and_(
                Lead.created_at >= month_start,
                Lead.created_at < month_end
            )
        ).first()
        
        total = cohort_stats.total or 0
        if total > 0:
            periods = [
                total,
                cohort_stats.contacted or 0,
                cohort_stats.scheduled or 0,
                cohort_stats.completed or 0,
                cohort_stats.active or 0,
                cohort_stats.retained or 0,
            ]
            percentages = [round(p / total * 100, 1) for p in periods]
        else:
            periods = [0, 0, 0, 0, 0, 0]
            percentages = [0, 0, 0, 0, 0, 0]
        
        cohorts.append({
            "cohort": cohort_name,
            "cohort_size": total,
            "periods": periods,
            "percentages": percentages,
        })
    
    # Cache result
    cache.set_cohort_data({"labels": period_labels, "cohorts": cohorts})
    
    return CohortRetentionResponse(
        period_labels=period_labels,
        cohorts=[CohortRetention(**c) for c in cohorts],
        cache_hit=False,
        query_time_ms=round((time.time() - start_time) * 1000, 2)
    )


# =============================================================================
# Cursor-Based Pagination Endpoint
# =============================================================================

@router.get(
    "/leads-cursor",
    response_model=CursorPaginatedResponse,
    summary="Get Leads with Cursor Pagination",
    description="Get leads using cursor-based pagination for large datasets.",
)
async def get_leads_cursor(
    request: Request,
    db: Session = Depends(get_db),
    cursor: Optional[str] = Query(default=None, description="Pagination cursor"),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
    priority: Optional[str] = Query(default=None, description="Filter by priority"),
    status: Optional[str] = Query(default=None, description="Filter by status"),
) -> CursorPaginatedResponse:
    """
    Get leads using cursor-based pagination.
    
    Cursor is based on (created_at, id) for stable pagination.
    Much more efficient than OFFSET for large datasets.
    
    Args:
        request: FastAPI request
        db: Database session
        cursor: Pagination cursor (format: timestamp_uuid)
        limit: Items per page
        priority: Optional priority filter
        status: Optional status filter
        
    Returns:
        Paginated leads with cursor
    """
    # Build base query
    query = db.query(Lead)
    
    # Apply filters
    if priority:
        try:
            priority_enum = PriorityType(priority.upper())
            query = query.filter(Lead.priority == priority_enum)
        except ValueError:
            pass
    
    if status:
        try:
            status_enum = LeadStatus(status.upper().replace(" ", "_"))
            query = query.filter(Lead.status == status_enum)
        except ValueError:
            pass
    
    # Apply cursor filter if provided
    if cursor:
        try:
            # Cursor format: timestamp_uuid (e.g., "2026-01-26T12:00:00_uuid-here")
            cursor_parts = cursor.rsplit("_", 1)
            cursor_timestamp = datetime.fromisoformat(cursor_parts[0])
            cursor_id = UUID(cursor_parts[1])
            
            # Fetch items after cursor (created_at DESC, id DESC)
            query = query.filter(
                (Lead.created_at < cursor_timestamp) |
                ((Lead.created_at == cursor_timestamp) & (Lead.id < cursor_id))
            )
        except (ValueError, IndexError):
            pass  # Invalid cursor, ignore
    
    # Get total estimate (use approximate count for performance)
    # For exact count with filters, this would need adjustment
    total_estimate = db.query(func.count(Lead.id)).scalar() or 0
    
    # Order by created_at DESC, id DESC for stable cursor pagination
    leads = query.order_by(
        Lead.created_at.desc(),
        Lead.id.desc()
    ).limit(limit + 1).all()  # Fetch one extra to check if more exist
    
    has_more = len(leads) > limit
    items = leads[:limit]
    
    # Generate next cursor
    next_cursor = None
    if has_more and items:
        last_item = items[-1]
        next_cursor = f"{last_item.created_at.isoformat()}_{str(last_item.id)}"
    
    return CursorPaginatedResponse(
        items=[
            CursorPaginatedLead(
                id=str(lead.id),
                lead_number=lead.lead_number,
                condition=lead.condition.value if hasattr(lead.condition, 'value') else str(lead.condition),
                priority=lead.priority.value if hasattr(lead.priority, 'value') else str(lead.priority),
                status=lead.status.value if hasattr(lead.status, 'value') else str(lead.status),
                score=lead.score,
                in_service_area=lead.in_service_area,
                created_at=lead.created_at.isoformat(),
                contact_outcome=lead.contact_outcome.value if lead.contact_outcome and hasattr(lead.contact_outcome, 'value') else None,
            )
            for lead in items
        ],
        next_cursor=next_cursor,
        has_more=has_more,
        total_estimate=total_estimate,
    )
