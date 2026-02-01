"""
Lead submission and management endpoints.

Handles patient intake form submissions from the widget
and lead retrieval for the dashboard.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc

from ..core.config import settings
from ..core.database import get_db
from ..models.lead import Lead, PriorityType, LeadStatus, ContactOutcome
from ..models.provider import ReferringProvider
from ..schemas.lead import (
    LeadCreate,
    LeadUpdate,
    LeadResponse,
    LeadListResponse,
    LeadSubmitResponse,
    ScheduleCallbackRequest,
    LogContactAttemptRequest,
    ScheduledLeadResponse,
    UpdateContactOutcomeRequest,
)
from ..schemas.common import PaginatedResponse, ErrorResponse
from ..services.lead_scoring import (
    calculate_lead_score as calculate_lead_score_legacy,
    get_estimated_response_time as get_estimated_response_time_legacy,
    get_confirmation_message as get_confirmation_message_legacy,
)
# NEW: Use v2 scoring and canonical mapping for widget submissions
from ..services.lead_scoring_v2 import (
    calculate_lead_score as calculate_lead_score_v2,
    get_estimated_response_time,
    get_confirmation_message,
    ScoreBreakdown,
)
from ..services.intake_mapping import map_widget_submission_to_lead_input, LeadInput
from ..services.encryption import EncryptionService
from ..services.audit import AuditService
from ..services.lead_number import generate_lead_number
from ..services.cache import get_cache
from ..core.auth import get_current_user, require_role


router = APIRouter(prefix="/api/leads", tags=["Leads"])


# =============================================================================
# Helper Functions
# =============================================================================

def mark_lead_activity(lead: Lead) -> None:
    """
    Mark lead as having recent activity.
    
    Call this whenever ANY modification is made to a lead to update
    the last_updated_at timestamp for coordinator workflow sorting.
    
    Args:
        lead: Lead model instance to mark
    """
    lead.last_updated_at = datetime.now(timezone.utc)


def clear_lead_transition_fields(lead: Lead) -> None:
    """
    Clear all stale transition fields BEFORE setting new status/tags.
    
    CRITICAL: Call this at the START of every queue transition to prevent
    old tags from carrying over. For example, a lead marked "Cancelled Appointment"
    that gets a callback scheduled should NOT still show "Cancelled Appointment".
    
    This clears:
    - contact_outcome (reset to NEW baseline)
    - follow_up_reason (e.g., "No Answer", "Callback Requested", "No Show")
    - follow_up_date (follow-up schedule)
    - scheduled_callback_at (callback/consultation datetime)
    - next_follow_up_at (next follow-up datetime)
    - scheduled_notes (callback/consultation notes)
    
    This does NOT clear:
    - notes (permanent coordinator notes)
    - priority, score (permanent lead data)
    - contact_attempts, last_contact_attempt (historical tracking)
    - source, UTM data, referral data (attribution)
    - status (caller sets this after clearing)
    
    Args:
        lead: Lead model instance to clear transition fields on
    """
    lead.contact_outcome = None
    lead.follow_up_reason = None
    lead.follow_up_date = None
    lead.scheduled_callback_at = None
    lead.next_follow_up_at = None
    lead.scheduled_notes = None


def get_client_ip(request: Request) -> Optional[str]:
    """
    Extract client IP from request headers.

    Handles X-Forwarded-For for proxied requests.

    Args:
        request: FastAPI request object

    Returns:
        Client IP address or None
    """
    # Check for forwarded IP (when behind proxy/load balancer)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the first IP in the chain
        return forwarded.split(",")[0].strip()

    # Fall back to direct client IP
    if request.client:
        return request.client.host

    return None


def get_user_agent(request: Request) -> Optional[str]:
    """
    Extract user agent from request headers.

    Args:
        request: FastAPI request object

    Returns:
        User agent string or None
    """
    return request.headers.get("User-Agent")


# =============================================================================
# Widget Submission Endpoint
# =============================================================================

@router.post(
    "/submit",
    response_model=LeadSubmitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Lead from Widget",
    description="Accepts patient intake form submission from the widget.",
    responses={
        201: {"description": "Lead created successfully"},
        400: {"description": "Validation error", "model": ErrorResponse},
        500: {"description": "Internal server error", "model": ErrorResponse},
    },
)
async def submit_lead(
    lead_data: LeadCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> LeadSubmitResponse:
    """
    Submit a new lead from the patient intake widget.

    This endpoint:
    1. Validates input data
    2. Maps to canonical LeadInput format
    3. Calculates lead score with v2 scoring engine
    4. Encrypts PHI before storage
    5. Creates audit log entry
    6. Returns confirmation message

    Args:
        lead_data: LeadCreate schema with form data
        request: FastAPI request for metadata extraction
        db: Database session

    Returns:
        LeadSubmitResponse with confirmation

    Raises:
        HTTPException: If validation or storage fails
    """
    try:
        # =====================================================================
        # Step 1: Map widget submission to canonical LeadInput format
        # =====================================================================
        widget_payload = {
            "first_name": lead_data.first_name,
            "last_name": lead_data.last_name,
            "email": lead_data.email,
            "phone": lead_data.phone,
            "date_of_birth": lead_data.date_of_birth.isoformat() if lead_data.date_of_birth else None,
            # Use single condition as conditions array
            "condition": lead_data.condition.value if lead_data.condition else "",
            "condition_other": lead_data.condition_other,
            # Multi-condition support (NEW)
            "conditions": [c.value for c in lead_data.conditions] if lead_data.conditions else [],
            "other_condition_text": lead_data.other_condition_text,
            # Severity assessments (NEW)
            "phq2_interest": lead_data.phq2_interest,
            "phq2_mood": lead_data.phq2_mood,
            "gad2_nervous": lead_data.gad2_nervous,
            "gad2_worry": lead_data.gad2_worry,
            "ocd_time_occupied": lead_data.ocd_time_occupied,
            "ptsd_intrusion": lead_data.ptsd_intrusion,
            # TMS therapy interest (NEW)
            "tms_therapy_interest": lead_data.tms_therapy_interest,
            # Preferred contact method (NEW)
            "preferred_contact_method": lead_data.preferred_contact_method,
            # Other fields
            "symptom_duration": lead_data.symptom_duration.value if lead_data.symptom_duration else "",
            "prior_treatments": [t.value for t in lead_data.prior_treatments] if lead_data.prior_treatments else [],
            "has_insurance": lead_data.has_insurance,
            "insurance_provider": lead_data.insurance_provider,
            "other_insurance_provider": lead_data.other_insurance_provider,
            "zip_code": lead_data.zip_code,
            "urgency": lead_data.urgency.value if lead_data.urgency else "",
            "hipaa_consent": lead_data.hipaa_consent,
            "sms_consent": lead_data.sms_consent,
            "utm_params": {
                "utm_source": lead_data.utm_params.utm_source if lead_data.utm_params else None,
                "utm_medium": lead_data.utm_params.utm_medium if lead_data.utm_params else None,
                "utm_campaign": lead_data.utm_params.utm_campaign if lead_data.utm_params else None,
                "utm_term": lead_data.utm_params.utm_term if lead_data.utm_params else None,
                "utm_content": lead_data.utm_params.utm_content if lead_data.utm_params else None,
            } if lead_data.utm_params else {},
            "referrer_url": lead_data.referrer_url,
            # Referral fields (NEW - Widget now supports referrals like Jotform)
            "is_referral": lead_data.is_referral,
            "referring_provider_name": lead_data.referring_provider_name,
            "referring_clinic": lead_data.referring_clinic,
            "referring_provider_email": lead_data.referring_provider_email,
            "referring_provider_specialty": lead_data.referring_provider_specialty,
        }
        
        # Map to canonical LeadInput
        lead_input = map_widget_submission_to_lead_input(widget_payload)
        
        # =====================================================================
        # Step 2: Calculate lead score using v2 scoring engine
        # =====================================================================
        score_breakdown: ScoreBreakdown = calculate_lead_score_v2(lead_input)
        
        # Map priority string to enum
        priority_map = {
            "hot": PriorityType.HOT,
            "medium": PriorityType.MEDIUM,
            "low": PriorityType.LOW,
            "disqualified": PriorityType.DISQUALIFIED,
        }
        priority = priority_map.get(score_breakdown.priority.lower(), PriorityType.LOW)
        in_service_area = score_breakdown.in_service_area

        # Encrypt PHI fields
        encrypted_phi = EncryptionService.encrypt_lead_phi(lead_data)

        # Get request metadata
        client_ip = get_client_ip(request)
        user_agent = get_user_agent(request)

        # Prepare UTM data
        utm_data = {}
        if lead_data.utm_params:
            utm_data = {
                "utm_source": lead_data.utm_params.utm_source,
                "utm_medium": lead_data.utm_params.utm_medium,
                "utm_campaign": lead_data.utm_params.utm_campaign,
                "utm_term": lead_data.utm_params.utm_term,
                "utm_content": lead_data.utm_params.utm_content,
            }

        # Generate unique lead number (NR-YYYY-XXX format)
        lead_number = generate_lead_number(db)

        # Get current timestamp for consent tracking
        consent_timestamp = datetime.now(timezone.utc)

        # =====================================================================
        # Step 2.5: Handle Referral (if is_referral=True from widget)
        # =====================================================================
        referring_provider_id = None
        is_referral = lead_input.referred_by_provider
        
        if is_referral and lead_input.referring_provider_name:
            # Look up or create referring provider
            # IMPORTANT: Ensure empty/whitespace emails become None, not empty string
            email_raw = (lead_input.referring_provider_email or "").lower().strip()
            provider_email_lookup = email_raw if email_raw and "@" in email_raw else None
            provider_name_lookup = lead_input.referring_provider_name.strip()
            
            # Get specialty from lead_data (widget submission)
            provider_specialty_raw = lead_data.referring_provider_specialty or ""
            
            existing_provider = None
            
            # First try to find by email if provided
            if provider_email_lookup:
                existing_provider = db.query(ReferringProvider).filter(
                    ReferringProvider.email == provider_email_lookup
                ).first()
            
            # If not found by email, try by name (case-insensitive)
            if not existing_provider and provider_name_lookup:
                existing_provider = db.query(ReferringProvider).filter(
                    ReferringProvider.name.ilike(provider_name_lookup)
                ).first()
            
            if existing_provider:
                # Update existing provider's referral count
                existing_provider.total_referrals = (existing_provider.total_referrals or 0) + 1
                if lead_input.referring_clinic and not existing_provider.practice_name:
                    existing_provider.practice_name = lead_input.referring_clinic
                if provider_email_lookup and not existing_provider.email:
                    existing_provider.email = provider_email_lookup
                # Update specialty if not set and we have one from widget
                # RULE: Store exact user input - no mapping, no transformation
                if provider_specialty_raw and not existing_provider.specialty:
                    existing_provider.specialty = provider_specialty_raw.strip()
                referring_provider_id = existing_provider.id
                db.commit()
            else:
                # Create new referring provider with specialty
                # RULE: Store exact user input - no mapping, no transformation
                new_provider = ReferringProvider(
                    name=provider_name_lookup,
                    email=provider_email_lookup,
                    practice_name=lead_input.referring_clinic if lead_input.referring_clinic else None,
                    specialty=provider_specialty_raw.strip() if provider_specialty_raw else None,
                    total_referrals=1,
                    converted_referrals=0,
                )
                db.add(new_provider)
                db.flush()  # Get the ID without committing
                referring_provider_id = new_provider.id

        # =====================================================================
        # Step 3: Create lead record with ALL fields populated
        # =====================================================================
        lead = Lead(
            # Lead identifier
            lead_number=lead_number,
            # Encrypted PHI
            first_name_encrypted=encrypted_phi["first_name_encrypted"],
            last_name_encrypted=encrypted_phi["last_name_encrypted"],
            email_encrypted=encrypted_phi["email_encrypted"],
            phone_encrypted=encrypted_phi["phone_encrypted"],
            # Date of Birth (optional)
            date_of_birth=lead_data.date_of_birth,
            # Clinical info (legacy single condition)
            condition=lead_data.condition,
            condition_other=lead_data.condition_other,
            # Multi-condition support (NEW)
            conditions=lead_input.conditions if lead_input.conditions else [],
            other_condition_text=lead_input.other_condition_text,
            # TMS therapy interest
            tms_therapy_interest=lead_input.tms_therapy_interest,
            # Preferred contact method (NEW)
            preferred_contact_method=lead_input.preferred_contact_method,
            # Depression PHQ-2 Assessment
            phq2_interest=lead_input.phq2_interest,
            phq2_mood=lead_input.phq2_mood,
            depression_severity_score=score_breakdown.depression_severity_score,
            depression_severity_level=score_breakdown.depression_severity_level,
            # Anxiety GAD-2 Assessment
            gad2_nervous=lead_input.gad2_nervous,
            gad2_worry=lead_input.gad2_worry,
            anxiety_severity_score=score_breakdown.anxiety_severity_score,
            anxiety_severity_level=score_breakdown.anxiety_severity_level,
            # OCD Assessment
            ocd_time_occupied=lead_input.ocd_time_occupied,
            ocd_severity_level=score_breakdown.ocd_severity_level,
            # PTSD Assessment
            ptsd_intrusion=lead_input.ptsd_intrusion,
            ptsd_severity_level=score_breakdown.ptsd_severity_level,
            # Symptom duration
            symptom_duration=lead_data.symptom_duration,
            prior_treatments=lead_data.prior_treatments,
            # Insurance
            has_insurance=lead_data.has_insurance,
            insurance_provider=lead_data.insurance_provider,
            other_insurance_provider=lead_input.other_insurance_provider,
            # Location
            zip_code=lead_data.zip_code,
            in_service_area=in_service_area,
            # Urgency & consent
            urgency=lead_data.urgency,
            hipaa_consent=lead_data.hipaa_consent,
            hipaa_consent_timestamp=consent_timestamp if lead_data.hipaa_consent else None,
            # Privacy consent implied by HIPAA consent
            privacy_consent_timestamp=consent_timestamp if lead_data.hipaa_consent else None,
            sms_consent=lead_data.sms_consent,
            sms_consent_timestamp=consent_timestamp if lead_data.sms_consent else None,
            # Scoring - main score
            score=score_breakdown.lead_score,
            lead_score=score_breakdown.lead_score,
            priority=priority,
            # Score breakdown fields (NEW)
            condition_score=score_breakdown.condition_score,
            therapy_interest_score=score_breakdown.therapy_interest_score,
            severity_score=score_breakdown.severity_score,
            insurance_score=score_breakdown.insurance_score,
            duration_score=score_breakdown.duration_score,
            treatment_score=score_breakdown.treatment_score,
            location_score=score_breakdown.location_score,
            urgency_score=score_breakdown.urgency_score,
            # Status
            status=LeadStatus.NEW,
            # Referral tracking (NEW - Widget now supports referrals like Jotform)
            is_referral=is_referral,
            referring_provider_id=referring_provider_id,
            # UTM tracking
            **utm_data,
            # Metadata
            ip_address_hash=EncryptionService.hash_ip(client_ip),
            user_agent=user_agent,
            referrer_url=lead_data.referrer_url,
        )

        # Save to database
        db.add(lead)
        db.commit()
        db.refresh(lead)

        # Invalidate cache to ensure dashboard metrics include new lead
        try:
            cache = get_cache()
            cache.invalidate_on_lead_change()
        except Exception:
            pass  # Don't fail the request if cache invalidation fails

        # Generate confirmation message and estimated time BEFORE notifications
        # Note: v2 functions expect string priority (hot, medium, low, disqualified)
        message = get_confirmation_message(score_breakdown.priority, in_service_area)
        estimated_time = get_estimated_response_time(score_breakdown.priority)

        # Queue receipt notifications (email + SMS) using UNIFIED template
        try:
            from ..tasks.lead_tasks import send_lead_receipt_notifications

            # Decrypt PHI for notifications
            decrypted = EncryptionService.decrypt_lead_phi(lead)

            # Send email + SMS asynchronously with conditions for unified template
            send_lead_receipt_notifications.delay(
                lead_id=str(lead.id),
                email=decrypted["email"],
                phone=decrypted["phone"],
                first_name=decrypted["first_name"],
                lead_number=lead.lead_number,
                response_time=estimated_time,
                conditions=lead_input.conditions if lead_input.conditions else [],
                other_condition_text=lead_input.other_condition_text or "",
            )
        except Exception as e:
            # Log error but don't fail the request
            # Notifications are nice-to-have, not critical
            import logging
            logging.error(f"Failed to queue notification: {e}")
            pass

        # Create audit log entry (without PHI)
        audit_service = AuditService(db)
        audit_service.log_create(
            table_name="leads",
            record_id=lead.id,
            ip_address=client_ip,
            endpoint="/api/leads/submit",
            request_method="POST",
            user_agent=user_agent,
            new_values={
                "condition": lead_data.condition.value,
                "priority": priority.value,
                "in_service_area": in_service_area,
                "phi_fields": "[REDACTED]",  # Never log PHI
            },
        )

        return LeadSubmitResponse(
            success=True,
            message=message,
            lead_id=lead.id,
            priority=priority,
            estimated_response_time=estimated_time,
        )

    except ValueError as e:
        # Validation error
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        # Log error without PHI
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing your submission. Please try again.",
        )


# =============================================================================
# Dashboard Endpoints (for future authentication)
# =============================================================================

@router.get(
    "",
    response_model=PaginatedResponse,
    summary="List Leads",
    description="Get paginated list of leads for dashboard.",
    dependencies=[Depends(get_current_user)],
)
async def list_leads(
    request: Request,
    db: Session = Depends(get_db),
    page: int = 1,
    page_size: int = 20,
    priority: Optional[PriorityType] = None,
    status_filter: Optional[LeadStatus] = None,
    contact_outcome_filter: Optional[ContactOutcome] = None,
    in_service_area: Optional[bool] = None,
    is_referral: Optional[bool] = None,
    search: Optional[str] = None,
) -> PaginatedResponse:
    """
    List leads with pagination, filtering, and search.

    PERFORMANCE OPTIMIZED:
    - Server-side pagination BEFORE decryption
    - Only decrypt leads in the current page
    - Count queries use indexes efficiently
    - Robust error handling for enum mismatches

    Args:
        request: FastAPI request
        db: Database session
        page: Page number (1-indexed)
        page_size: Items per page (max 100)
        priority: Optional priority filter
        status_filter: Optional status filter
        contact_outcome_filter: Optional contact outcome filter (NEW, ANSWERED, NO_ANSWER, etc.)
        in_service_area: Optional service area filter
        is_referral: Optional filter for referral leads only
        search: Optional search query (searches lead_number only for performance)

    Returns:
        Paginated list of leads
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Validate and cap page_size
        page_size = min(page_size, 100)
        
        # Validate pagination params
        if page < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Page number must be at least 1"
            )
        if page_size < 1 or page_size > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Page size must be between 1 and 100"
            )

        # Build base query - exclude soft-deleted leads
        query = db.query(Lead).filter(Lead.deleted_at.is_(None))

        # Apply filters (all use indexed columns)
        if priority:
            query = query.filter(Lead.priority == priority)
        if status_filter:
            query = query.filter(Lead.status == status_filter)
        if contact_outcome_filter:
            query = query.filter(Lead.contact_outcome == contact_outcome_filter)
        if in_service_area is not None:
            query = query.filter(Lead.in_service_area == in_service_area)
        if is_referral is not None:
            query = query.filter(Lead.is_referral == is_referral)

        # Search by lead_number (indexed, non-PHI field)
        # For PHI search, use a dedicated search endpoint with rate limiting
        if search:
            search_term = search.strip()
            if search_term:
                query = query.filter(Lead.lead_number.ilike(f"%{search_term}%"))

        # Get total count efficiently (single COUNT query with filters)
        total = query.count()

        # Calculate pagination
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        offset = (page - 1) * page_size

        # Get only the leads for current page (LIMIT/OFFSET with index)
        # Use joinedload to eagerly load referring_provider for thread pool processing
        # Sort by last_updated_at DESC NULLS FIRST (new untouched leads first, then recently updated)
        paginated_leads = (
            query
            .options(joinedload(Lead.referring_provider))
            .order_by(desc(Lead.last_updated_at).nulls_first(), desc(Lead.created_at))
            .offset(offset)
            .limit(page_size)
            .all()
        )

        # PERFORMANCE FIX: Batch decrypt using ThreadPoolExecutor
        # This parallelizes decryption across CPU cores for ~5x speedup
        def decrypt_single_lead(lead):
            """Decrypt PHI for a single lead (runs in thread pool)."""
            decrypted = EncryptionService.decrypt_lead_phi(lead)
            return LeadListResponse(
                id=lead.id,
                lead_number=lead.lead_number,
                first_name=decrypted["first_name"],
                last_name=decrypted["last_name"],
                email=decrypted["email"],
                phone=decrypted["phone"],
                condition=lead.condition,
                # Multi-condition support
                conditions=lead.conditions if lead.conditions else [],
                other_condition_text=lead.other_condition_text,
                # Preferred contact method
                preferred_contact_method=lead.preferred_contact_method,
                score=lead.score,
                priority=lead.priority,
                status=lead.status,
                in_service_area=lead.in_service_area,
                created_at=lead.created_at,
                scheduled_callback_at=lead.scheduled_callback_at,
                contact_outcome=lead.contact_outcome or ContactOutcome.NEW,
                contact_attempts=lead.contact_attempts or 0,
                last_contact_attempt=lead.last_contact_attempt,
                # Referral tracking fields
                is_referral=lead.is_referral if lead.is_referral else False,
                referring_provider_id=lead.referring_provider_id,
                referring_provider_name=lead.referring_provider.name if lead.referring_provider else None,
                follow_up_reason=lead.follow_up_reason,
                last_updated_at=lead.last_updated_at,
            )

        # Use thread pool for concurrent decryption (max 8 workers)
        with ThreadPoolExecutor(max_workers=8) as executor:
            items = list(executor.map(decrypt_single_lead, paginated_leads))

        # Batch audit logging (single entry for page access)
        if paginated_leads:
            audit_service = AuditService(db)
            audit_service.log_read(
                table_name="leads",
                record_id=paginated_leads[0].id,  # Log first lead ID as reference
                ip_address=get_client_ip(request),
                endpoint="/api/leads",
                request_method="GET",
                user_agent=get_user_agent(request),
            )

        return PaginatedResponse(
            items=[item.model_dump() for item in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        )
    
    except LookupError as e:
        # Enum mismatch error - log and return 500 with helpful message
        logger.error(f"Enum mismatch error in list_leads: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database contains invalid enum values. Please contact support."
        )
    except Exception as e:
        # Generic error handler - log without exposing internals
        logger.error(f"Error in list_leads: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while loading leads. Please try again."
        )


# =============================================================================
# PHI Search Endpoint (Rate Limited)
# =============================================================================

@router.get(
    "/search",
    response_model=PaginatedResponse,
    summary="Search Leads by PHI",
    description="Search leads by phone, email, or name (rate limited for security).",
    dependencies=[Depends(get_current_user)],
)
async def search_leads_phi(
    request: Request,
    db: Session = Depends(get_db),
    q: str = "",
    page: int = 1,
    page_size: int = 20,
) -> PaginatedResponse:
    """
    Search leads by PHI fields (phone, email, name).

    This endpoint is separate and rate-limited because it requires
    decrypting all leads to search. Should be used sparingly.

    For large datasets, consider implementing:
    - Elasticsearch with encrypted search
    - Blind index search patterns

    Args:
        request: FastAPI request
        db: Database session
        q: Search query
        page: Page number
        page_size: Items per page

    Returns:
        Matching leads
    """
    if not q or len(q.strip()) < 2:
        return PaginatedResponse(
            items=[],
            total=0,
            page=page,
            page_size=page_size,
            total_pages=0,
            has_next=False,
            has_previous=False,
        )

    search_lower = q.lower().strip()
    page_size = min(page_size, 50)  # Cap at 50 for search

    # For PHI search, we need to scan leads in batches
    # This is slower but more secure than keeping decrypted data
    batch_size = 500
    offset = 0
    matching_leads = []

    # Scan in batches until we have enough results for pagination
    # Get enough for current page + one more
    max_results = (page * page_size) + page_size

    while len(matching_leads) < max_results:
        batch = (
            db.query(Lead)
            .order_by(desc(Lead.created_at))
            .offset(offset)
            .limit(batch_size)
            .all()
        )

        if not batch:
            break

        for lead in batch:
            decrypted = EncryptionService.decrypt_lead_phi(lead)
            phone = (decrypted.get("phone", "") or "").lower()
            email = (decrypted.get("email", "") or "").lower()
            first_name = (decrypted.get("first_name", "") or "").lower()
            last_name = (decrypted.get("last_name", "") or "").lower()
            full_name = f"{first_name} {last_name}".strip()

            if (
                search_lower in phone or
                search_lower in email or
                search_lower in full_name or
                search_lower in first_name or
                search_lower in last_name
            ):
                matching_leads.append((lead, decrypted))

                if len(matching_leads) >= max_results:
                    break

        offset += batch_size

    # Apply pagination to results
    total = len(matching_leads)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_leads = matching_leads[start_idx:end_idx]

    # Convert to response
    items = []
    for lead, decrypted in paginated_leads:
        items.append(
            LeadListResponse(
                id=lead.id,
                lead_number=lead.lead_number,
                first_name=decrypted["first_name"],
                last_name=decrypted["last_name"],
                email=decrypted["email"],
                phone=decrypted["phone"],
                condition=lead.condition,
                score=lead.score,
                priority=lead.priority,
                status=lead.status,
                in_service_area=lead.in_service_area,
                created_at=lead.created_at,
                scheduled_callback_at=lead.scheduled_callback_at,
                contact_outcome=lead.contact_outcome or ContactOutcome.NEW,
                contact_attempts=lead.contact_attempts or 0,
                last_contact_attempt=lead.last_contact_attempt,
            )
        )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        items=[item.model_dump() for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1,
    )


# =============================================================================
# Deleted Leads List (Admin Only) — MUST be before /{lead_id} to avoid UUID conflict
# =============================================================================

@router.get(
    "/deleted",
    response_model=PaginatedResponse,
    summary="List Deleted Leads",
    description="Get paginated list of soft-deleted leads for admin recovery view.",
    dependencies=[Depends(require_role("administrator"))],
)
async def list_deleted_leads(
    request: Request,
    db: Session = Depends(get_db),
    page: int = 1,
    page_size: int = 50,
) -> PaginatedResponse:
    """
    List soft-deleted leads for the admin Deleted Leads recovery view.
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        page_size = min(page_size, 100)
        query = db.query(Lead).filter(Lead.deleted_at.isnot(None))
        total = query.count()
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        offset = (page - 1) * page_size

        paginated_leads = (
            query
            .options(joinedload(Lead.referring_provider))
            .order_by(desc(Lead.deleted_at))
            .offset(offset)
            .limit(page_size)
            .all()
        )

        def decrypt_deleted_lead(lead):
            decrypted = EncryptionService.decrypt_lead_phi(lead)
            return {
                "id": str(lead.id),
                "lead_number": lead.lead_number,
                "first_name": decrypted["first_name"],
                "last_name": decrypted["last_name"],
                "email": decrypted["email"],
                "phone": decrypted["phone"],
                "condition": lead.condition.value if lead.condition else None,
                "conditions": lead.conditions if lead.conditions else [],
                "priority": lead.priority.value if lead.priority else None,
                "status": lead.status.value if lead.status else None,
                "created_at": lead.created_at.isoformat() if lead.created_at else None,
                "deleted_at": lead.deleted_at.isoformat() if lead.deleted_at else None,
                "is_referral": lead.is_referral if lead.is_referral else False,
                "referring_provider_name": lead.referring_provider.name if lead.referring_provider else None,
            }

        with ThreadPoolExecutor(max_workers=8) as executor:
            items = list(executor.map(decrypt_deleted_lead, paginated_leads))

        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        )
    except Exception as e:
        logger.error(f"Error in list_deleted_leads: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while loading deleted leads.",
        )


@router.get(
    "/{lead_id}",
    response_model=LeadResponse,
    summary="Get Lead Details",
    description="Get detailed information about a specific lead.",
    dependencies=[Depends(get_current_user)],
)
async def get_lead(
    lead_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> LeadResponse:
    """
    Get detailed lead information by ID.

    TODO: Add authentication middleware before production.

    Args:
        lead_id: UUID of lead to retrieve
        request: FastAPI request
        db: Database session

    Returns:
        Full lead details with decrypted PHI

    Raises:
        HTTPException: If lead not found
    """
    # Fetch lead (exclude soft-deleted)
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.deleted_at.is_(None)
    ).first()

    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )

    # Log audit
    audit_service = AuditService(db)
    audit_service.log_read(
        table_name="leads",
        record_id=lead.id,
        ip_address=get_client_ip(request),
        endpoint=f"/api/leads/{lead_id}",
        request_method="GET",
        user_agent=get_user_agent(request),
    )

    # Decrypt PHI
    decrypted = EncryptionService.decrypt_lead_phi(lead)

    return LeadResponse(
        id=lead.id,
        first_name=decrypted["first_name"],
        last_name=decrypted["last_name"],
        email=decrypted["email"],
        phone=decrypted["phone"],
        condition=lead.condition,
        condition_other=lead.condition_other,
        symptom_duration=lead.symptom_duration,
        prior_treatments=lead.prior_treatments if lead.prior_treatments else [],
        has_insurance=lead.has_insurance,
        insurance_provider=lead.insurance_provider,
        zip_code=lead.zip_code,
        in_service_area=lead.in_service_area,
        urgency=lead.urgency,
        hipaa_consent=lead.hipaa_consent,
        hipaa_consent_timestamp=lead.hipaa_consent_timestamp,
        privacy_consent_timestamp=lead.privacy_consent_timestamp,
        sms_consent=lead.sms_consent,
        sms_consent_timestamp=lead.sms_consent_timestamp,
        score=lead.score,
        priority=lead.priority,
        status=lead.status,
        notes=lead.notes,
        utm_source=lead.utm_source,
        utm_medium=lead.utm_medium,
        utm_campaign=lead.utm_campaign,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
        contacted_at=lead.contacted_at,
        scheduled_callback_at=lead.scheduled_callback_at,
        scheduled_notes=lead.scheduled_notes,
        contact_method=lead.contact_method,
        last_contact_attempt=lead.last_contact_attempt,
        contact_attempts=lead.contact_attempts,
        next_follow_up_at=lead.next_follow_up_at,
    )


# =============================================================================
# Scheduling Endpoints
# =============================================================================

@router.post(
    "/{lead_id}/schedule",
    response_model=LeadResponse,
    summary="Schedule Callback or Consultation",
    description="Schedule a callback or consultation for a lead. Callbacks stay in Follow-up Queue; Consultations move to Scheduled Queue.",
    dependencies=[Depends(require_role("administrator", "coordinator"))],
)
async def schedule_callback(
    lead_id: UUID,
    schedule_data: ScheduleCallbackRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> LeadResponse:
    """
    Schedule a callback or consultation for a lead.
    
    CRITICAL ROUTING LOGIC:
    - schedule_type='callback': Sets contact_outcome=CALLBACK_REQUESTED, keeps in Follow-up Queue
    - schedule_type='consultation': Sets status=SCHEDULED, contact_outcome=SCHEDULED, moves to Scheduled Queue

    Args:
        lead_id: UUID of lead to schedule
        schedule_data: Scheduling information including schedule_type
        request: FastAPI request
        db: Database session

    Returns:
        Updated lead details

    Raises:
        HTTPException: If lead not found
    """
    # Fetch lead
    lead = db.query(Lead).filter(Lead.id == lead_id).first()

    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )

    # Store old values for audit
    old_values = {
        "scheduled_callback_at": str(lead.scheduled_callback_at) if lead.scheduled_callback_at else None,
        "scheduled_notes": lead.scheduled_notes,
        "contact_method": lead.contact_method.value if lead.contact_method else None,
        "status": lead.status.value if lead.status else None,
        "contact_outcome": lead.contact_outcome.value if lead.contact_outcome else None,
    }

    # =========================================================================
    # CRITICAL: Clear ALL old transition fields first, then set new ones.
    # This prevents stale tags (e.g., "Cancelled Appointment", "Unreachable")
    # from carrying over when a lead moves to a new queue.
    # =========================================================================
    clear_lead_transition_fields(lead)

    # Now set scheduling fields on the clean slate
    lead.scheduled_callback_at = schedule_data.scheduled_callback_at
    lead.scheduled_notes = schedule_data.scheduled_notes
    lead.contact_method = schedule_data.contact_method

    # =========================================================================
    # CRITICAL: Route based on schedule_type
    # =========================================================================
    schedule_type = (schedule_data.schedule_type or "callback").lower().strip()
    
    if schedule_type == "consultation":
        # CONSULTATION: Move to Scheduled Queue
        lead.status = LeadStatus.SCHEDULED
        lead.contact_outcome = ContactOutcome.SCHEDULED
        lead.contacted_at = datetime.now(timezone.utc)
    else:
        # CALLBACK: Stay in Follow-up/Callback Queue
        if lead.status == LeadStatus.NEW:
            lead.status = LeadStatus.CONTACTED
        lead.contact_outcome = ContactOutcome.CALLBACK_REQUESTED
        lead.follow_up_reason = "Callback Requested"
        lead.contacted_at = datetime.now(timezone.utc)
        lead.next_follow_up_at = schedule_data.scheduled_callback_at

    # Mark activity timestamp
    mark_lead_activity(lead)
    
    db.commit()
    db.refresh(lead)

    # Invalidate cache to ensure dashboard metrics are accurate
    try:
        cache = get_cache()
        cache.invalidate_on_lead_change()
    except Exception:
        pass  # Don't fail the request if cache invalidation fails

    # Log audit
    audit_service = AuditService(db)
    audit_service.log_update(
        table_name="leads",
        record_id=lead.id,
        ip_address=get_client_ip(request),
        endpoint=f"/api/leads/{lead_id}/schedule",
        request_method="POST",
        user_agent=get_user_agent(request),
        old_values=old_values,
        new_values={
            "scheduled_callback_at": str(schedule_data.scheduled_callback_at),
            "scheduled_notes": schedule_data.scheduled_notes,
            "contact_method": schedule_data.contact_method.value,
        },
    )

    # Return updated lead
    decrypted = EncryptionService.decrypt_lead_phi(lead)

    return LeadResponse(
        id=lead.id,
        first_name=decrypted["first_name"],
        last_name=decrypted["last_name"],
        email=decrypted["email"],
        phone=decrypted["phone"],
        condition=lead.condition,
        condition_other=lead.condition_other,
        symptom_duration=lead.symptom_duration,
        prior_treatments=lead.prior_treatments if lead.prior_treatments else [],
        has_insurance=lead.has_insurance,
        insurance_provider=lead.insurance_provider,
        zip_code=lead.zip_code,
        in_service_area=lead.in_service_area,
        urgency=lead.urgency,
        hipaa_consent=lead.hipaa_consent,
        hipaa_consent_timestamp=lead.hipaa_consent_timestamp,
        privacy_consent_timestamp=lead.privacy_consent_timestamp,
        sms_consent=lead.sms_consent,
        sms_consent_timestamp=lead.sms_consent_timestamp,
        score=lead.score,
        priority=lead.priority,
        status=lead.status,
        notes=lead.notes,
        utm_source=lead.utm_source,
        utm_medium=lead.utm_medium,
        utm_campaign=lead.utm_campaign,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
        contacted_at=lead.contacted_at,
        scheduled_callback_at=lead.scheduled_callback_at,
        scheduled_notes=lead.scheduled_notes,
        contact_method=lead.contact_method,
        last_contact_attempt=lead.last_contact_attempt,
        contact_attempts=lead.contact_attempts,
        next_follow_up_at=lead.next_follow_up_at,
    )


@router.post(
    "/{lead_id}/contact-attempt",
    response_model=LeadResponse,
    summary="Log Contact Attempt",
    description="Log a contact attempt for a lead.",
    dependencies=[Depends(require_role("administrator", "coordinator"))],
)
async def log_contact_attempt(
    lead_id: UUID,
    attempt_data: LogContactAttemptRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> LeadResponse:
    """
    Log a contact attempt for a lead.

    Args:
        lead_id: UUID of lead
        attempt_data: Contact attempt information
        request: FastAPI request
        db: Database session

    Returns:
        Updated lead details

    Raises:
        HTTPException: If lead not found
    """
    # Fetch lead
    lead = db.query(Lead).filter(Lead.id == lead_id).first()

    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )

    # Update contact tracking
    lead.last_contact_attempt = datetime.now(timezone.utc)
    lead.contact_attempts = (lead.contact_attempts or 0) + 1
    lead.contact_method = attempt_data.contact_method

    # Update notes if provided
    if attempt_data.notes:
        existing_notes = lead.notes or ""
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        new_note = f"[{timestamp}] Contact attempt ({attempt_data.contact_method.value}): {attempt_data.notes}"
        lead.notes = f"{new_note}\n{existing_notes}" if existing_notes else new_note

    # Set next follow-up if not reached
    if not attempt_data.was_successful and attempt_data.next_follow_up_at:
        lead.next_follow_up_at = attempt_data.next_follow_up_at

    # Update status based on success
    if attempt_data.was_successful:
        if lead.status == LeadStatus.NEW or lead.status == LeadStatus.CONTACTED:
            lead.status = LeadStatus.CONTACTED
        lead.contacted_at = datetime.now(timezone.utc)
        lead.next_follow_up_at = None  # Clear follow-up if successful

    # Mark activity timestamp
    mark_lead_activity(lead)
    
    db.commit()
    db.refresh(lead)

    # Invalidate cache to ensure dashboard metrics are accurate
    try:
        cache = get_cache()
        cache.invalidate_on_lead_change()
    except Exception:
        pass  # Don't fail the request if cache invalidation fails

    # Log audit
    audit_service = AuditService(db)
    audit_service.log_update(
        table_name="leads",
        record_id=lead.id,
        ip_address=get_client_ip(request),
        endpoint=f"/api/leads/{lead_id}/contact-attempt",
        request_method="POST",
        user_agent=get_user_agent(request),
        old_values=None,
        new_values={
            "contact_method": attempt_data.contact_method.value,
            "was_successful": attempt_data.was_successful,
            "contact_attempts": lead.contact_attempts,
        },
    )

    # Return updated lead
    decrypted = EncryptionService.decrypt_lead_phi(lead)

    return LeadResponse(
        id=lead.id,
        first_name=decrypted["first_name"],
        last_name=decrypted["last_name"],
        email=decrypted["email"],
        phone=decrypted["phone"],
        condition=lead.condition,
        condition_other=lead.condition_other,
        symptom_duration=lead.symptom_duration,
        prior_treatments=lead.prior_treatments if lead.prior_treatments else [],
        has_insurance=lead.has_insurance,
        insurance_provider=lead.insurance_provider,
        zip_code=lead.zip_code,
        in_service_area=lead.in_service_area,
        urgency=lead.urgency,
        hipaa_consent=lead.hipaa_consent,
        hipaa_consent_timestamp=lead.hipaa_consent_timestamp,
        privacy_consent_timestamp=lead.privacy_consent_timestamp,
        sms_consent=lead.sms_consent,
        sms_consent_timestamp=lead.sms_consent_timestamp,
        score=lead.score,
        priority=lead.priority,
        status=lead.status,
        notes=lead.notes,
        utm_source=lead.utm_source,
        utm_medium=lead.utm_medium,
        utm_campaign=lead.utm_campaign,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
        contacted_at=lead.contacted_at,
        scheduled_callback_at=lead.scheduled_callback_at,
        scheduled_notes=lead.scheduled_notes,
        contact_method=lead.contact_method,
        last_contact_attempt=lead.last_contact_attempt,
        contact_attempts=lead.contact_attempts,
        next_follow_up_at=lead.next_follow_up_at,
    )


@router.get(
    "/scheduled/calendar",
    response_model=List[ScheduledLeadResponse],
    summary="Get Scheduled Leads",
    description="Get leads with scheduled callbacks for calendar view.",
    dependencies=[Depends(get_current_user)],
)
async def get_scheduled_leads(
    request: Request,
    db: Session = Depends(get_db),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[ScheduledLeadResponse]:
    """
    Get leads with scheduled callbacks for calendar view.

    Args:
        request: FastAPI request
        db: Database session
        start_date: Optional start date filter
        end_date: Optional end date filter

    Returns:
        List of scheduled leads
    """
    # Build query for leads with scheduled callbacks
    query = db.query(Lead).filter(Lead.scheduled_callback_at.isnot(None))

    # Apply date filters if provided
    if start_date:
        query = query.filter(Lead.scheduled_callback_at >= start_date)
    if end_date:
        query = query.filter(Lead.scheduled_callback_at <= end_date)

    # Order by scheduled time
    leads = query.order_by(Lead.scheduled_callback_at).all()

    # Convert to response format
    items = []
    for lead in leads:
        decrypted = EncryptionService.decrypt_lead_phi(lead)
        items.append(
            ScheduledLeadResponse(
                id=lead.id,
                lead_number=lead.lead_number,
                first_name=decrypted["first_name"],
                last_name=decrypted["last_name"],
                condition=lead.condition,
                priority=lead.priority,
                status=lead.status,
                scheduled_callback_at=lead.scheduled_callback_at,
                scheduled_notes=lead.scheduled_notes,
                contact_method=lead.contact_method,
                contact_attempts=lead.contact_attempts,
                phone=decrypted["phone"],
            )
        )

    return items


@router.patch(
    "/{lead_id}/status",
    response_model=LeadResponse,
    summary="Update Lead Status",
    description="Update the status of a lead.",
    dependencies=[Depends(require_role("administrator", "coordinator"))],
)
async def update_lead_status(
    lead_id: UUID,
    new_status: LeadStatus,
    request: Request,
    db: Session = Depends(get_db),
) -> LeadResponse:
    """
    Update lead status.

    TODO: Add authentication middleware before production.

    Args:
        lead_id: UUID of lead to update
        new_status: New status value
        request: FastAPI request
        db: Database session

    Returns:
        Updated lead details

    Raises:
        HTTPException: If lead not found
    """
    # Fetch lead
    lead = db.query(Lead).filter(Lead.id == lead_id).first()

    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )

    # Store old status for audit
    old_status = lead.status

    # Check if this is a referral lead transitioning to a converted status
    # Converted statuses: SCHEDULED, CONSULTATION_COMPLETE, TREATMENT_STARTED
    converted_statuses = [LeadStatus.SCHEDULED,
                          LeadStatus.CONSULTATION_COMPLETE, LeadStatus.TREATMENT_STARTED]
    was_converted_before = old_status in converted_statuses
    will_be_converted = new_status in converted_statuses

    # =========================================================================
    # CRITICAL: Clear ALL old transition fields when status changes directly.
    # This prevents stale tags from carrying over (e.g., "Cancelled Appointment"
    # still showing after a lead is moved back to NEW status).
    # =========================================================================
    clear_lead_transition_fields(lead)

    # Update status
    lead.status = new_status
    
    # CRITICAL: Set contact_outcome to a valid value after clearing.
    # clear_lead_transition_fields sets contact_outcome=None but column is NOT NULL.
    lead.contact_outcome = ContactOutcome.NEW
    
    # Mark activity timestamp
    mark_lead_activity(lead)
    
    db.commit()
    db.refresh(lead)

    # CRITICAL: Update provider converted_referrals counter if this is a NEW conversion
    if lead.is_referral and lead.referring_provider_id and will_be_converted and not was_converted_before:
        provider = db.query(ReferringProvider).filter(
            ReferringProvider.id == lead.referring_provider_id
        ).first()
        if provider:
            provider.converted_referrals = (
                provider.converted_referrals or 0) + 1
            db.commit()

    # Invalidate cache to ensure dashboard metrics are accurate
    try:
        cache = get_cache()
        cache.invalidate_on_lead_change()
    except Exception:
        pass  # Don't fail the request if cache invalidation fails

    # Log audit
    audit_service = AuditService(db)
    audit_service.log_update(
        table_name="leads",
        record_id=lead.id,
        ip_address=get_client_ip(request),
        endpoint=f"/api/leads/{lead_id}/status",
        request_method="PATCH",
        user_agent=get_user_agent(request),
        old_values={"status": old_status.value},
        new_values={"status": new_status.value},
    )

    # Return updated lead
    decrypted = EncryptionService.decrypt_lead_phi(lead)

    return LeadResponse(
        id=lead.id,
        first_name=decrypted["first_name"],
        last_name=decrypted["last_name"],
        email=decrypted["email"],
        phone=decrypted["phone"],
        condition=lead.condition,
        condition_other=lead.condition_other,
        symptom_duration=lead.symptom_duration,
        prior_treatments=lead.prior_treatments if lead.prior_treatments else [],
        has_insurance=lead.has_insurance,
        insurance_provider=lead.insurance_provider,
        zip_code=lead.zip_code,
        in_service_area=lead.in_service_area,
        urgency=lead.urgency,
        hipaa_consent=lead.hipaa_consent,
        hipaa_consent_timestamp=lead.hipaa_consent_timestamp,
        privacy_consent_timestamp=lead.privacy_consent_timestamp,
        sms_consent=lead.sms_consent,
        sms_consent_timestamp=lead.sms_consent_timestamp,
        score=lead.score,
        priority=lead.priority,
        status=lead.status,
        notes=lead.notes,
        utm_source=lead.utm_source,
        utm_medium=lead.utm_medium,
        utm_campaign=lead.utm_campaign,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
        contacted_at=lead.contacted_at,
    )


# =============================================================================
# Contact Outcome Endpoints
# =============================================================================

@router.patch(
    "/{lead_id}/contact-outcome",
    response_model=LeadResponse,
    summary="Update Contact Outcome",
    description="Update the contact outcome for a lead after outreach attempt.",
    dependencies=[Depends(require_role("administrator", "coordinator"))],
)
async def update_contact_outcome(
    lead_id: UUID,
    outcome_data: UpdateContactOutcomeRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> LeadResponse:
    """
    Update lead contact outcome.

    Used by coordinators to track outreach results:
    - NEW: Not contacted yet
    - ANSWERED: Spoke with lead, can proceed to schedule
    - NO_ANSWER: Called but no pickup, needs follow-up
    - UNREACHABLE: Wrong number, disconnected, etc.
    - CALLBACK_REQUESTED: Lead asked to call back at specific time
    - NOT_INTERESTED: Lead declined, archive

    Args:
        lead_id: UUID of lead to update
        outcome_data: Contact outcome information
        request: FastAPI request
        db: Database session

    Returns:
        Updated lead details

    Raises:
        HTTPException: If lead not found
    """
    # Fetch lead
    lead = db.query(Lead).filter(Lead.id == lead_id).first()

    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )

    # Store old values for audit
    old_outcome = lead.contact_outcome.value if lead.contact_outcome else "NEW"

    # =========================================================================
    # CRITICAL: Clear ALL old transition fields first, then set new ones.
    # This prevents stale tags (e.g., "Cancelled Appointment", "No Show")
    # from carrying over when a lead moves to a new queue.
    # =========================================================================
    clear_lead_transition_fields(lead)

    # Update contact outcome on clean slate
    lead.contact_outcome = outcome_data.contact_outcome
    lead.last_contact_attempt = datetime.now(timezone.utc)
    lead.contact_attempts = (lead.contact_attempts or 0) + 1

    # =========================================================================
    # WORKFLOW LOGIC: Outcome → Status + Follow-up Reason + Follow-up Date
    #
    # For New/Contacted leads:
    # | Outcome         | Status →   | follow_up_reason      | follow_up_date |
    # |-----------------|------------|-----------------------|----------------|
    # | Answered        | CONTACTED  | —                     | —              |
    # | No Answer       | CONTACTED  | "No Answer"           | —              |
    # | Unreachable     | CONTACTED  | "Unreachable"         | —              |
    # | Callback        | CONTACTED  | "Callback Requested"  | —              |
    # | Not Interested  | CONTACTED  | "Not Interested"      | +14 days       |
    # =========================================================================
    now = datetime.now(timezone.utc)

    if outcome_data.contact_outcome == ContactOutcome.ANSWERED:
        lead.status = LeadStatus.CONTACTED
        lead.contacted_at = now
        lead.follow_up_reason = None
        lead.follow_up_date = None
    elif outcome_data.contact_outcome == ContactOutcome.NO_ANSWER:
        lead.status = LeadStatus.CONTACTED
        lead.contacted_at = now
        lead.follow_up_reason = "No Answer"
        lead.follow_up_date = now + timedelta(days=1)
    elif outcome_data.contact_outcome == ContactOutcome.UNREACHABLE:
        lead.status = LeadStatus.CONTACTED
        lead.contacted_at = now
        lead.follow_up_reason = "Unreachable"
        lead.follow_up_date = None
    elif outcome_data.contact_outcome == ContactOutcome.CALLBACK_REQUESTED:
        lead.status = LeadStatus.CONTACTED
        lead.contacted_at = now
        lead.follow_up_reason = "Callback Requested"
        # follow_up_date set from next_follow_up_at if provided
    elif outcome_data.contact_outcome == ContactOutcome.NOT_INTERESTED:
        lead.status = LeadStatus.CONTACTED
        lead.contacted_at = now
        lead.follow_up_reason = "Not Interested"
        lead.follow_up_date = now + timedelta(days=14)

    # Set next follow-up for certain outcomes (if explicitly provided by frontend)
    if outcome_data.next_follow_up_at:
        lead.next_follow_up_at = outcome_data.next_follow_up_at

    # Create auto-note for the outcome in lead_notes table
    try:
        from ..models.lead_note import LeadNote
        from ..core.auth import get_current_user as _get_user
        
        # Get current user from request state (set by dependency)
        current_user = None
        try:
            # The auth dependency already ran, we can access user from the request
            # Since we use Depends(require_role(...)) the user is authenticated
            from ..core.database import SessionLocal
            user_name = "System"
            user_id = None
            # Try to get the user from the auth token
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                from ..core.auth import decode_access_token
                from ..models.user import User
                token = auth_header.split(" ")[1]
                payload = decode_access_token(token)
                if payload and "sub" in payload:
                    user = db.query(User).filter(User.id == payload["sub"]).first()
                    if user:
                        user_id = user.id
                        user_name = f"{user.first_name} {user.last_name}".strip() or user.email
        except Exception:
            pass

        auto_note = LeadNote(
            lead_id=lead.id,
            note_text=f"Outcome recorded: {outcome_data.contact_outcome.value}" + (
                f" — {outcome_data.notes}" if outcome_data.notes else ""
            ),
            created_by=user_id,
            created_by_name=user_name,
            note_type="outcome",
            related_outcome=outcome_data.contact_outcome.value,
        )
        db.add(auto_note)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to create auto-note: {e}")

    # Also append to legacy notes field if user provided notes text
    if outcome_data.notes:
        existing_notes = lead.notes or ""
        timestamp = now.strftime("%Y-%m-%d %H:%M")
        new_note = f"[{timestamp}] Outcome: {outcome_data.contact_outcome.value} - {outcome_data.notes}"
        lead.notes = f"{new_note}\n{existing_notes}" if existing_notes else new_note

    # Mark activity timestamp
    mark_lead_activity(lead)
    
    db.commit()
    db.refresh(lead)

    # Invalidate cache to ensure dashboard metrics are accurate
    try:
        cache = get_cache()
        cache.invalidate_on_lead_change()
    except Exception:
        pass  # Don't fail the request if cache invalidation fails

    # Log audit
    audit_service = AuditService(db)
    audit_service.log_update(
        table_name="leads",
        record_id=lead.id,
        ip_address=get_client_ip(request),
        endpoint=f"/api/leads/{lead_id}/contact-outcome",
        request_method="PATCH",
        user_agent=get_user_agent(request),
        old_values={"contact_outcome": old_outcome},
        new_values={
            "contact_outcome": outcome_data.contact_outcome.value,
            "contact_attempts": lead.contact_attempts,
        },
    )

    # Return updated lead
    decrypted = EncryptionService.decrypt_lead_phi(lead)

    return LeadResponse(
        id=lead.id,
        first_name=decrypted["first_name"],
        last_name=decrypted["last_name"],
        email=decrypted["email"],
        phone=decrypted["phone"],
        condition=lead.condition,
        condition_other=lead.condition_other,
        symptom_duration=lead.symptom_duration,
        prior_treatments=lead.prior_treatments if lead.prior_treatments else [],
        has_insurance=lead.has_insurance,
        insurance_provider=lead.insurance_provider,
        zip_code=lead.zip_code,
        in_service_area=lead.in_service_area,
        urgency=lead.urgency,
        hipaa_consent=lead.hipaa_consent,
        hipaa_consent_timestamp=lead.hipaa_consent_timestamp,
        privacy_consent_timestamp=lead.privacy_consent_timestamp,
        sms_consent=lead.sms_consent,
        sms_consent_timestamp=lead.sms_consent_timestamp,
        score=lead.score,
        priority=lead.priority,
        status=lead.status,
        notes=lead.notes,
        utm_source=lead.utm_source,
        utm_medium=lead.utm_medium,
        utm_campaign=lead.utm_campaign,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
        contacted_at=lead.contacted_at,
        scheduled_callback_at=lead.scheduled_callback_at,
        scheduled_notes=lead.scheduled_notes,
        contact_method=lead.contact_method,
        last_contact_attempt=lead.last_contact_attempt,
        contact_attempts=lead.contact_attempts,
        next_follow_up_at=lead.next_follow_up_at,
        contact_outcome=lead.contact_outcome,
    )


# =============================================================================
# Consultation Outcome Endpoint (for Scheduled leads)
# =============================================================================

@router.patch(
    "/{lead_id}/consultation-outcome",
    summary="Record Consultation Outcome",
    description="Record the outcome of a scheduled consultation.",
    dependencies=[Depends(require_role("administrator", "coordinator"))],
)
async def update_consultation_outcome(
    lead_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """
    Record consultation outcome for a scheduled lead.

    Accepts JSON body with:
      - outcome: str (complete|reschedule|followup|no_show|cancelled)
      - notes: Optional[str]
      - scheduled_callback_at: Optional[str] (ISO datetime for reschedule/followup)
      - contact_method: Optional[str] (PHONE|EMAIL|SMS|VIDEO_CALL)

    WORKFLOW RULES:
    | Outcome    | Status →                | follow_up_reason           | follow_up_date |
    |------------|-------------------------|----------------------------|----------------|
    | complete   | CONSULTATION_COMPLETE   | —                          | —              |
    | reschedule | SCHEDULED               | "Rescheduled"              | user-selected  |
    | followup   | CONTACTED (follow-up Q) | "Second Consult Required"  | user-selected  |
    | no_show    | CONTACTED (follow-up Q) | "No Show"                  | +1 day         |
    | cancelled  | CONTACTED (follow-up Q) | "Cancelled Appointment"    | +7 days        |
    """
    import logging
    logger = logging.getLogger(__name__)

    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Parse JSON body
    try:
        body = await request.json()
    except Exception:
        body = {}

    outcome = body.get("outcome", "complete")
    notes = body.get("notes")
    scheduled_callback_at_str = body.get("scheduled_callback_at")
    contact_method_str = body.get("contact_method")

    old_status = lead.status.value if lead.status else None
    now = datetime.now(timezone.utc)
    outcome_lower = outcome.lower().strip()

    # =========================================================================
    # CRITICAL: Clear ALL old transition fields first, then set new ones.
    # This prevents stale tags from carrying over when consultation outcome
    # routes the lead to a different queue.
    # =========================================================================
    clear_lead_transition_fields(lead)

    # Parse optional scheduled date
    scheduled_dt = None
    if scheduled_callback_at_str:
        try:
            scheduled_dt = datetime.fromisoformat(scheduled_callback_at_str.replace("Z", "+00:00"))
        except Exception:
            pass

    # Parse optional contact method
    if contact_method_str:
        try:
            from ..models.lead import ContactMethodType
            lead.contact_method = ContactMethodType(contact_method_str)
        except Exception:
            pass

    if outcome_lower == "complete":
        lead.status = LeadStatus.CONSULTATION_COMPLETE
        lead.contact_outcome = ContactOutcome.COMPLETED
        lead.follow_up_reason = None
        lead.follow_up_date = None
    elif outcome_lower == "reschedule":
        lead.status = LeadStatus.SCHEDULED
        lead.contact_outcome = ContactOutcome.SCHEDULED
        lead.follow_up_reason = "Rescheduled"
        if scheduled_dt:
            lead.scheduled_callback_at = scheduled_dt
            lead.follow_up_date = scheduled_dt
    elif outcome_lower == "followup":
        # Second consult stays in Scheduled queue (NOT Follow-up)
        # The lead still has a consultation — just at a new date
        lead.status = LeadStatus.SCHEDULED
        lead.contact_outcome = ContactOutcome.SCHEDULED
        lead.follow_up_reason = "Second Consult Required"
        if scheduled_dt:
            lead.scheduled_callback_at = scheduled_dt
            lead.follow_up_date = scheduled_dt
            lead.next_follow_up_at = scheduled_dt
    elif outcome_lower == "no_show":
        lead.status = LeadStatus.CONTACTED
        lead.contact_outcome = ContactOutcome.ANSWERED
        lead.follow_up_reason = "No Show"
        lead.follow_up_date = now + timedelta(days=1)
    elif outcome_lower == "cancelled":
        lead.status = LeadStatus.CONTACTED
        lead.contact_outcome = ContactOutcome.ANSWERED
        lead.follow_up_reason = "Cancelled Appointment"
        lead.follow_up_date = now + timedelta(days=7)
    else:
        raise HTTPException(status_code=400, detail=f"Invalid outcome: {outcome}")

    # Get authenticated user info for note attribution
    user_name = "System"
    user_id = None
    try:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            from ..core.auth import decode_access_token
            from ..models.user import User
            token = auth_header.split(" ")[1]
            payload = decode_access_token(token)
            if payload and "sub" in payload:
                user = db.query(User).filter(User.id == payload["sub"]).first()
                if user:
                    user_id = user.id
                    user_name = f"{user.first_name} {user.last_name}".strip() or user.email
    except Exception:
        pass

    # Create auto-note (system/outcome type)
    try:
        from ..models.lead_note import LeadNote

        note_text = f"Consultation outcome: {outcome_lower}" + (f" — {notes}" if notes else "")
        auto_note = LeadNote(
            lead_id=lead.id,
            note_text=note_text,
            created_by=user_id,
            created_by_name=user_name,
            note_type="outcome",
            related_outcome=outcome_lower,
        )
        db.add(auto_note)
    except Exception as e:
        logger.warning(f"Failed to create consultation auto-note: {e}")

    # Append to legacy notes field
    if notes:
        existing_notes = lead.notes or ""
        timestamp = now.strftime("%Y-%m-%d %H:%M")
        new_note = f"[{timestamp}] Consultation: {outcome_lower} - {notes}"
        lead.notes = f"{new_note}\n{existing_notes}" if existing_notes else new_note

    mark_lead_activity(lead)
    db.commit()
    db.refresh(lead)

    # Invalidate cache
    try:
        cache = get_cache()
        cache.invalidate_on_lead_change()
    except Exception:
        pass

    # Audit
    try:
        audit_service = AuditService(db)
        audit_service.log_update(
            table_name="leads",
            record_id=lead.id,
            ip_address=get_client_ip(request),
            endpoint=f"/api/leads/{lead_id}/consultation-outcome",
            request_method="PATCH",
            user_agent=get_user_agent(request),
            old_values={"status": old_status},
            new_values={
                "status": lead.status.value,
                "follow_up_reason": lead.follow_up_reason,
                "consultation_outcome": outcome_lower,
            },
        )
    except Exception:
        pass

    return {
        "success": True,
        "lead_id": str(lead.id),
        "new_status": lead.status.value,
        "follow_up_reason": lead.follow_up_reason,
    }


# =============================================================================
# Lead Update Endpoint
# =============================================================================

@router.patch(
    "/{lead_id}",
    response_model=LeadResponse,
    summary="Update Lead",
    description="Update lead information. All fields are optional - only provided fields will be updated.",
    dependencies=[Depends(require_role("administrator", "coordinator"))],
)
async def update_lead(
    lead_id: UUID,
    update_data: LeadUpdate,
    request: Request,
    db: Session = Depends(get_db),
) -> LeadResponse:
    """
    Update lead fields.

    Allows coordinators to update lead contact info, clinical data, notes, status, etc.
    PHI fields are re-encrypted if modified.

    Args:
        lead_id: UUID of lead to update
        update_data: Fields to update (all optional)
        request: FastAPI request
        db: Database session

    Returns:
        Updated lead details

    Raises:
        HTTPException: If lead not found or soft-deleted
    """
    import logging
    logger = logging.getLogger(__name__)

    # Fetch lead (exclude soft-deleted)
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.deleted_at.is_(None)
    ).first()

    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )

    try:
        # Store old values for audit
        old_values = {}
        new_values = {}

        # Update PHI fields if provided (need re-encryption)
        # CRITICAL FIX: Use encrypt_field() (not encrypt() which doesn't exist)
        if update_data.first_name is not None:
            old_values["first_name"] = "[REDACTED]"
            new_values["first_name"] = "[REDACTED]"
            lead.first_name_encrypted = EncryptionService.encrypt_field(
                update_data.first_name)

        if update_data.last_name is not None:
            old_values["last_name"] = "[REDACTED]"
            new_values["last_name"] = "[REDACTED]"
            lead.last_name_encrypted = EncryptionService.encrypt_field(
                update_data.last_name) if update_data.last_name else None

        if update_data.email is not None:
            old_values["email"] = "[REDACTED]"
            new_values["email"] = "[REDACTED]"
            lead.email_encrypted = EncryptionService.encrypt_field(update_data.email)

        if update_data.phone is not None:
            old_values["phone"] = "[REDACTED]"
            new_values["phone"] = "[REDACTED]"
            lead.phone_encrypted = EncryptionService.encrypt_field(update_data.phone)

        # Update non-PHI fields
        if update_data.condition is not None:
            old_values["condition"] = lead.condition.value if lead.condition else None
            lead.condition = update_data.condition
            new_values["condition"] = update_data.condition.value
            # CRITICAL FIX: Also sync the conditions array (multi-condition field)
            # The table renders conditions[] first if it has items, so keeping
            # it in sync ensures the table displays the updated value immediately.
            # The edit modal only supports single condition, so replace the array.
            lead.conditions = [update_data.condition.value]

        if update_data.condition_other is not None:
            old_values["condition_other"] = lead.condition_other
            lead.condition_other = update_data.condition_other
            new_values["condition_other"] = update_data.condition_other

        if update_data.symptom_duration is not None:
            old_values["symptom_duration"] = lead.symptom_duration.value if lead.symptom_duration else None
            lead.symptom_duration = update_data.symptom_duration
            new_values["symptom_duration"] = update_data.symptom_duration.value

        if update_data.prior_treatments is not None:
            old_values["prior_treatments"] = [
                t.value for t in lead.prior_treatments] if lead.prior_treatments else []
            lead.prior_treatments = update_data.prior_treatments
            new_values["prior_treatments"] = [
                t.value for t in update_data.prior_treatments]

        if update_data.has_insurance is not None:
            old_values["has_insurance"] = lead.has_insurance
            lead.has_insurance = update_data.has_insurance
            new_values["has_insurance"] = update_data.has_insurance

        if update_data.insurance_provider is not None:
            old_values["insurance_provider"] = lead.insurance_provider
            lead.insurance_provider = update_data.insurance_provider
            new_values["insurance_provider"] = update_data.insurance_provider

        if update_data.zip_code is not None:
            old_values["zip_code"] = lead.zip_code
            lead.zip_code = update_data.zip_code
            new_values["zip_code"] = update_data.zip_code
            # Recalculate service area using existing utility
            from ..core.security import is_in_service_area
            lead.in_service_area = is_in_service_area(update_data.zip_code)

        if update_data.urgency is not None:
            old_values["urgency"] = lead.urgency.value if lead.urgency else None
            lead.urgency = update_data.urgency
            new_values["urgency"] = update_data.urgency.value

        if update_data.notes is not None:
            old_values["notes"] = lead.notes
            lead.notes = update_data.notes
            new_values["notes"] = update_data.notes

        if update_data.status is not None:
            old_values["status"] = lead.status.value if lead.status else None
            lead.status = update_data.status
            new_values["status"] = update_data.status.value

        if update_data.priority is not None:
            old_values["priority"] = lead.priority.value if lead.priority else None
            lead.priority = update_data.priority
            new_values["priority"] = update_data.priority.value

        # Mark activity timestamp (any update to lead should mark activity)
        mark_lead_activity(lead)

        # Commit changes
        db.commit()
        db.refresh(lead)

        # Invalidate cache
        try:
            cache = get_cache()
            cache.invalidate_on_lead_change()
        except Exception:
            pass

        # Log audit
        if old_values:
            audit_service = AuditService(db)
            audit_service.log_update(
                table_name="leads",
                record_id=lead.id,
                ip_address=get_client_ip(request),
                endpoint=f"/api/leads/{lead_id}",
                request_method="PATCH",
                user_agent=get_user_agent(request),
                old_values=old_values,
                new_values=new_values,
            )

        # Return updated lead
        decrypted = EncryptionService.decrypt_lead_phi(lead)

        return LeadResponse(
            id=lead.id,
            first_name=decrypted["first_name"],
            last_name=decrypted["last_name"],
            email=decrypted["email"],
            phone=decrypted["phone"],
            condition=lead.condition,
            condition_other=lead.condition_other,
            symptom_duration=lead.symptom_duration,
            prior_treatments=lead.prior_treatments if lead.prior_treatments else [],
            has_insurance=lead.has_insurance,
            insurance_provider=lead.insurance_provider,
            zip_code=lead.zip_code,
            in_service_area=lead.in_service_area,
            urgency=lead.urgency,
            hipaa_consent=lead.hipaa_consent,
            hipaa_consent_timestamp=lead.hipaa_consent_timestamp,
            privacy_consent_timestamp=lead.privacy_consent_timestamp,
            sms_consent=lead.sms_consent,
            sms_consent_timestamp=lead.sms_consent_timestamp,
            score=lead.score,
            priority=lead.priority,
            status=lead.status,
            notes=lead.notes,
            utm_source=lead.utm_source,
            utm_medium=lead.utm_medium,
            utm_campaign=lead.utm_campaign,
            created_at=lead.created_at,
            updated_at=lead.updated_at,
            contacted_at=lead.contacted_at,
            scheduled_callback_at=lead.scheduled_callback_at,
            scheduled_notes=lead.scheduled_notes,
            contact_method=lead.contact_method,
            last_contact_attempt=lead.last_contact_attempt,
            contact_attempts=lead.contact_attempts,
            next_follow_up_at=lead.next_follow_up_at,
            contact_outcome=lead.contact_outcome or ContactOutcome.NEW,
            last_updated_at=lead.last_updated_at,
        )

    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        db.rollback()
        logger.error(f"Lead update error for {lead_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update lead: {str(e)}",
        )


# =============================================================================
# Soft Delete Endpoint
# =============================================================================

@router.delete(
    "/{lead_id}",
    status_code=status.HTTP_200_OK,
    summary="Soft Delete Lead",
    description="Soft delete a lead. The lead is not permanently removed but marked as deleted.",
    dependencies=[Depends(require_role("administrator"))],
)
async def delete_lead(
    lead_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """
    Soft delete a lead.

    Sets deleted_at timestamp instead of permanent deletion.
    Lead relationships (referring_provider) are preserved.
    Lead can be restored by clearing deleted_at if needed.

    Returns a JSON confirmation so the frontend gets a clear success signal.

    Args:
        lead_id: UUID of lead to delete
        request: FastAPI request
        db: Database session

    Returns:
        Success confirmation with lead details

    Raises:
        HTTPException: If lead not found or already deleted
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        # Fetch lead (exclude already soft-deleted)
        lead = db.query(Lead).filter(
            Lead.id == lead_id,
            Lead.deleted_at.is_(None)
        ).first()

        if not lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found or already deleted",
            )

        # Store info for audit and response before soft delete
        lead_number = lead.lead_number

        # Soft delete - set deleted_at timestamp
        lead.deleted_at = datetime.now(timezone.utc)
        db.commit()

        # Invalidate cache
        try:
            cache = get_cache()
            cache.invalidate_on_lead_change()
        except Exception:
            pass

        # Log audit
        try:
            audit_service = AuditService(db)
            audit_service.log_delete(
                table_name="leads",
                record_id=lead.id,
                ip_address=get_client_ip(request),
                endpoint=f"/api/leads/{lead_id}",
                request_method="DELETE",
                user_agent=get_user_agent(request),
                deleted_data={"lead_number": lead_number, "soft_delete": True},
            )
        except Exception as e:
            logger.warning(f"Audit log failed for delete {lead_id}: {e}")

        return {
            "success": True,
            "message": f"Lead {lead_number} has been deleted. It can be restored by an administrator.",
            "lead_number": lead_number,
            "lead_id": str(lead_id),
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Delete lead error for {lead_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete lead: {str(e)}",
        )


# =============================================================================
# Restore Deleted Lead Endpoint (Admin Only)
# =============================================================================

@router.post(
    "/{lead_id}/restore",
    response_model=LeadResponse,
    summary="Restore Deleted Lead",
    description="Restore a soft-deleted lead back to its previous queue.",
    dependencies=[Depends(require_role("administrator"))],
)
async def restore_lead(
    lead_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> LeadResponse:
    """
    Restore a soft-deleted lead.

    Clears deleted_at timestamp so the lead reappears in its original queue.

    Args:
        lead_id: UUID of lead to restore
        request: FastAPI request
        db: Database session

    Returns:
        Restored lead details

    Raises:
        HTTPException: If lead not found or not deleted
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        # Fetch only soft-deleted leads
        lead = db.query(Lead).filter(
            Lead.id == lead_id,
            Lead.deleted_at.isnot(None)
        ).first()

        if not lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deleted lead not found",
            )

        # Restore - clear deleted_at
        lead.deleted_at = None
        mark_lead_activity(lead)

        db.commit()
        db.refresh(lead)

        # Invalidate cache
        try:
            cache = get_cache()
            cache.invalidate_on_lead_change()
        except Exception:
            pass

        # Log audit
        try:
            audit_service = AuditService(db)
            audit_service.log_update(
                table_name="leads",
                record_id=lead.id,
                ip_address=get_client_ip(request),
                endpoint=f"/api/leads/{lead_id}/restore",
                request_method="POST",
                user_agent=get_user_agent(request),
                old_values={"deleted_at": "was_deleted"},
                new_values={"deleted_at": None, "restored": True},
            )
        except Exception as e:
            logger.warning(f"Audit log failed for restore {lead_id}: {e}")

        # Return restored lead
        decrypted = EncryptionService.decrypt_lead_phi(lead)

        return LeadResponse(
            id=lead.id,
            first_name=decrypted["first_name"],
            last_name=decrypted["last_name"],
            email=decrypted["email"],
            phone=decrypted["phone"],
            condition=lead.condition,
            condition_other=lead.condition_other,
            symptom_duration=lead.symptom_duration,
            prior_treatments=lead.prior_treatments if lead.prior_treatments else [],
            has_insurance=lead.has_insurance,
            insurance_provider=lead.insurance_provider,
            zip_code=lead.zip_code,
            in_service_area=lead.in_service_area,
            urgency=lead.urgency,
            hipaa_consent=lead.hipaa_consent,
            hipaa_consent_timestamp=lead.hipaa_consent_timestamp,
            privacy_consent_timestamp=lead.privacy_consent_timestamp,
            sms_consent=lead.sms_consent,
            sms_consent_timestamp=lead.sms_consent_timestamp,
            score=lead.score,
            priority=lead.priority,
            status=lead.status,
            notes=lead.notes,
            utm_source=lead.utm_source,
            utm_medium=lead.utm_medium,
            utm_campaign=lead.utm_campaign,
            created_at=lead.created_at,
            updated_at=lead.updated_at,
            contacted_at=lead.contacted_at,
            scheduled_callback_at=lead.scheduled_callback_at,
            scheduled_notes=lead.scheduled_notes,
            contact_method=lead.contact_method,
            last_contact_attempt=lead.last_contact_attempt,
            contact_attempts=lead.contact_attempts,
            next_follow_up_at=lead.next_follow_up_at,
            contact_outcome=lead.contact_outcome or ContactOutcome.NEW,
            last_updated_at=lead.last_updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Restore lead error for {lead_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to restore lead: {str(e)}",
        )


# =============================================================================
# Permanent Delete Endpoint (Admin Only)
# =============================================================================

@router.delete(
    "/{lead_id}/permanent",
    status_code=status.HTTP_200_OK,
    summary="Permanently Delete Lead",
    description="Permanently remove a soft-deleted lead from the database. This action cannot be undone.",
    dependencies=[Depends(require_role("administrator"))],
)
async def permanent_delete_lead(
    lead_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """
    Permanently delete a lead record.

    WARNING: This action CANNOT be undone. Only works on already soft-deleted leads.

    Args:
        lead_id: UUID of lead to permanently delete
        request: FastAPI request
        db: Database session

    Returns:
        Success confirmation

    Raises:
        HTTPException: If lead not found or not already soft-deleted
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        # Only allow permanent deletion of already soft-deleted leads
        lead = db.query(Lead).filter(
            Lead.id == lead_id,
            Lead.deleted_at.isnot(None)
        ).first()

        if not lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deleted lead not found. Only soft-deleted leads can be permanently removed.",
            )

        lead_number = lead.lead_number

        # Log audit BEFORE deletion
        try:
            audit_service = AuditService(db)
            audit_service.log_delete(
                table_name="leads",
                record_id=lead.id,
                ip_address=get_client_ip(request),
                endpoint=f"/api/leads/{lead_id}/permanent",
                request_method="DELETE",
                user_agent=get_user_agent(request),
                deleted_data={"lead_number": lead_number, "permanent_delete": True},
            )
        except Exception as e:
            logger.warning(f"Audit log failed for permanent delete {lead_id}: {e}")

        # Hard delete
        db.delete(lead)
        db.commit()

        # Invalidate cache
        try:
            cache = get_cache()
            cache.invalidate_on_lead_change()
        except Exception:
            pass

        return {
            "success": True,
            "message": f"Lead {lead_number} has been permanently deleted.",
            "lead_number": lead_number,
            "lead_id": str(lead_id),
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Permanent delete error for {lead_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to permanently delete lead: {str(e)}",
        )
