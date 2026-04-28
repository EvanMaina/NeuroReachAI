"""
User management endpoints — admin-only CRUD.

IMPORTANT: Static path routes (/me/preferences, /clinic-settings) MUST be
defined BEFORE dynamic path routes (/{user_id}) to avoid FastAPI matching
"clinic-settings" or "me" as a user_id parameter.
"""

import logging
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.security import hash_password
from ..core.auth import require_role, get_current_user
from ..models.user import User, UserRole, UserStatus, UserPreferences
from ..schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
    PreferencesResponse,
    PreferencesUpdate,
    ClinicSettingsResponse,
    ClinicSettingsUpdate,
)
from ..models.user import ClinicSettings
from ..services.email_service import EmailService

# Temporary password expiry window
TEMP_PASSWORD_EXPIRY_HOURS = 48

# Role hierarchy rank (higher number = more authority)
_ROLE_RANK: dict[str, int] = {
    "primary_admin": 100,
    "administrator": 50,
    "coordinator": 20,
    "specialist": 10,
}


def _rank(role_value: str) -> int:
    """Return the numeric rank of a role string."""
    return _ROLE_RANK.get(role_value, 0)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/users", tags=["User Management"])


# =============================================================================
# List Users
# =============================================================================


@router.get("", response_model=UserListResponse, dependencies=[Depends(require_role("administrator"))])
async def list_users(
    db: Session = Depends(get_db),
    role: str | None = None,
    status_filter: str | None = None,
):
    """List all users, optionally filtered by role or status."""
    query = db.query(User)
    if role:
        query = query.filter(User.role == UserRole(role))
    if status_filter:
        query = query.filter(User.status == UserStatus(status_filter))

    users = query.order_by(User.created_at.desc()).all()
    return UserListResponse(items=[UserResponse.model_validate(u) for u in users], total=len(users))


# =============================================================================
# Preferences (current user — accessed via /api/users/me/preferences)
# MUST be before /{user_id} routes to prevent "me" matching as user_id
# =============================================================================


@router.get("/me/preferences", response_model=PreferencesResponse)
async def get_my_preferences(
    user: User = Depends(require_role("administrator", "coordinator", "specialist")),
    db: Session = Depends(get_db),
):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return PreferencesResponse(
        notify_new_lead=prefs.notify_new_lead,
        notify_hot_lead=prefs.notify_hot_lead,
        notify_daily_summary=prefs.notify_daily_summary,
    )


@router.put("/me/preferences", response_model=PreferencesResponse)
async def update_my_preferences(
    body: PreferencesUpdate,
    user: User = Depends(require_role("administrator", "coordinator", "specialist")),
    db: Session = Depends(get_db),
):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=user.id)
        db.add(prefs)

    if body.notify_new_lead is not None:
        prefs.notify_new_lead = body.notify_new_lead
    if body.notify_hot_lead is not None:
        prefs.notify_hot_lead = body.notify_hot_lead
    if body.notify_daily_summary is not None:
        prefs.notify_daily_summary = body.notify_daily_summary

    db.commit()
    db.refresh(prefs)
    return PreferencesResponse(
        notify_new_lead=prefs.notify_new_lead,
        notify_hot_lead=prefs.notify_hot_lead,
        notify_daily_summary=prefs.notify_daily_summary,
    )


# =============================================================================
# Clinic Settings
# MUST be before /{user_id} routes to prevent "clinic-settings" matching as user_id
# =============================================================================


@router.get("/clinic-settings", response_model=ClinicSettingsResponse, dependencies=[Depends(require_role("administrator"))])
async def get_clinic_settings(db: Session = Depends(get_db)):
    rows = db.query(ClinicSettings).all()
    kv = {r.key: r.value or "" for r in rows}
    return ClinicSettingsResponse(
        clinic_name=kv.get("clinic_name", ""),
        clinic_address=kv.get("clinic_address", ""),
        clinic_phone=kv.get("clinic_phone", ""),
        clinic_email=kv.get("clinic_email", ""),
    )


@router.put("/clinic-settings", response_model=ClinicSettingsResponse, dependencies=[Depends(require_role("administrator"))])
async def update_clinic_settings(body: ClinicSettingsUpdate, db: Session = Depends(get_db)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    for key, value in updates.items():
        row = db.query(ClinicSettings).filter(ClinicSettings.key == key).first()
        if row:
            row.value = value
        else:
            db.add(ClinicSettings(key=key, value=value))
    db.commit()

    # Re-fetch everything
    rows = db.query(ClinicSettings).all()
    kv = {r.key: r.value or "" for r in rows}
    return ClinicSettingsResponse(
        clinic_name=kv.get("clinic_name", ""),
        clinic_address=kv.get("clinic_address", ""),
        clinic_phone=kv.get("clinic_phone", ""),
        clinic_email=kv.get("clinic_email", ""),
    )


# =============================================================================
# Create User (with invitation email)
# =============================================================================


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role("administrator"))])
async def create_user(body: UserCreate, db: Session = Depends(get_db)) -> UserResponse:
    """
    Create a new user.  A random temporary password is generated and sent via
    email.  The user must change it on first login.
    """
    # Check for existing email
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")

    # Generate temp password (12 chars, URL-safe)
    temp_password = secrets.token_urlsafe(9)  # produces ~12 char string

    user = User(
        email=body.email,
        password_hash=hash_password(temp_password),
        first_name=body.first_name,
        last_name=body.last_name,
        role=UserRole(body.role),
        status=UserStatus.PENDING,
        must_change_password=True,
        password_expires_at=datetime.now(timezone.utc) + timedelta(hours=TEMP_PASSWORD_EXPIRY_HOURS),
    )
    db.add(user)
    db.flush()  # get the ID

    # Create default preferences
    prefs = UserPreferences(user_id=user.id)
    db.add(prefs)
    db.commit()
    db.refresh(user)

    # Send invitation email (best-effort; do not fail user creation)
    _send_invitation_email(user, temp_password)

    return UserResponse.model_validate(user)


def _send_invitation_email(user: User, temp_password: str) -> None:
    """Send the invitation email with temporary credentials. Best-effort.
    Routes through Paubox when EMAIL_MODE=paubox, falls back to SMTP."""
    try:
        from ..core.config import settings
        from ..services.paubox_email_service import send_email_via_paubox

        # Build login URL from the first CORS origin (frontend URL)
        # Prefer the first non-localhost, non-API CORS origin (i.e. the frontend)
        login_url = "http://localhost:5173"  # default dev
        cors_origins = getattr(settings, 'cors_origins', '')
        for origin in cors_origins.split(','):
            origin = origin.strip()
            if origin and origin != '*' and 'localhost' not in origin and 'api.' not in origin:
                login_url = origin
                break

        email_svc = EmailService()
        html = email_svc.render_template("user_invitation", {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "temp_password": temp_password,
            "role": user.role.value.capitalize(),
            "login_url": login_url,
        })
        text_content = (
            f"Hi {user.first_name} {user.last_name},\n\n"
            f"An administrator has created your TMS NeuroReach account. "
            f"Use the credentials below to log in for the first time.\n\n"
            f"Role: {user.role.value.capitalize()}\n"
            f"Email (Username): {user.email}\n"
            f"Temporary Password: {temp_password}\n\n"
            f"Log in at: {login_url}\n\n"
            f"Important: You will be prompted to change this temporary password on your "
            f"first login. Please choose a strong password that you will remember.\n\n"
            f"If you have any questions or trouble logging in, contact your administrator.\n\n"
            f"— TMS Institute of Arizona Team"
        )
        result = send_email_via_paubox(
            to_email=user.email,
            subject="Welcome to TMS NeuroReach — Your Account Has Been Created",
            html_content=html,
            text_content=text_content,
        )
        if result.get("success"):
            logger.info(f"Invitation email sent to {user.email} via {result.get('provider', 'unknown')}")
        else:
            logger.warning(f"Invitation email failed for {user.email}: {result.get('error', 'unknown')}")
    except Exception as e:
        logger.warning(f"Invitation email failed for {user.email}: {e}")


# =============================================================================
# Resend Invitation
# =============================================================================


@router.post("/{user_id}/resend-invite", response_model=UserResponse, dependencies=[Depends(require_role("administrator"))])
async def resend_invitation(user_id: str, db: Session = Depends(get_db)) -> UserResponse:
    """
    Resend the invitation email with a fresh temporary password.
    Resets the 48-hour expiry window.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.status == UserStatus.ACTIVE and not user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has already activated their account",
        )

    # Generate new temp password
    temp_password = secrets.token_urlsafe(9)
    user.password_hash = hash_password(temp_password)
    user.must_change_password = True
    user.password_expires_at = datetime.now(timezone.utc) + timedelta(hours=TEMP_PASSWORD_EXPIRY_HOURS)
    if user.status == UserStatus.INACTIVE:
        user.status = UserStatus.PENDING
    db.commit()
    db.refresh(user)

    # Send invitation email
    _send_invitation_email(user, temp_password)

    return UserResponse.model_validate(user)


# =============================================================================
# Update User
# =============================================================================


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    body: UserUpdate,
    caller: User = Depends(require_role("administrator")),
    db: Session = Depends(get_db),
) -> UserResponse:
    """
    Update user details (name, role, status).

    Role hierarchy enforcement:
    - primary_admin cannot be demoted or deactivated by anyone.
    - Only primary_admin can change an administrator's role or status.
    - Administrators can change coordinators and specialists.
    - No one can promote a user above their own rank.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    caller_rank = _rank(caller.role.value)
    target_rank = _rank(user.role.value)

    # primary_admin is protected: cannot be demoted or deactivated
    if user.role == UserRole.PRIMARY_ADMIN:
        if body.role is not None and body.role != "primary_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The primary admin role cannot be changed",
            )
        if body.status is not None and body.status == "inactive":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The primary admin cannot be deactivated",
            )

    # Cannot modify a user of equal or higher rank (unless modifying yourself)
    if str(caller.id) != str(user.id) and target_rank >= caller_rank:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot modify a user with equal or higher authority",
        )

    # Cannot promote a user above your own rank
    if body.role is not None and _rank(body.role) > caller_rank:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot assign a role higher than your own",
        )

    if body.first_name is not None:
        user.first_name = body.first_name
    if body.last_name is not None:
        user.last_name = body.last_name
    if body.role is not None:
        user.role = UserRole(body.role)
    if body.status is not None:
        user.status = UserStatus(body.status)

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


# =============================================================================
# Delete (Deactivate) User
# =============================================================================


@router.delete("/{user_id}")
async def deactivate_user(
    user_id: str,
    caller: User = Depends(require_role("administrator")),
    db: Session = Depends(get_db),
):
    """
    Soft-deactivate a user (set status = inactive).

    Role hierarchy enforcement:
    - primary_admin cannot be deactivated by anyone.
    - Only primary_admin can deactivate an administrator.
    - A user cannot deactivate themselves.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Cannot deactivate yourself
    if str(caller.id) == str(user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot deactivate your own account",
        )

    # primary_admin is protected
    if user.role == UserRole.PRIMARY_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The primary admin cannot be deactivated",
        )

    # Only primary_admin can deactivate administrators
    caller_rank = _rank(caller.role.value)
    target_rank = _rank(user.role.value)
    if target_rank >= caller_rank:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot deactivate a user with equal or higher authority",
        )

    user.status = UserStatus.INACTIVE
    db.commit()
    return {"success": True, "message": "User deactivated"}


# =============================================================================
# Permanently Delete User (HARD DELETE)
# =============================================================================
#
# WHY THIS EXISTS
#   Deactivation (status=INACTIVE) hides the user from the UI but the row
#   stays — sometimes that's not what you want (employee left under bad
#   circumstances; HIPAA right-to-erasure for non-PHI users; cleanup of
#   accidental test accounts). This endpoint hard-deletes the row.
#
# SAFEGUARDS
#   1. primary_admin role required (one rank above regular admins).
#   2. Cannot hard-delete yourself.
#   3. Cannot hard-delete another primary_admin (defense in depth).
#   4. Caller must echo the target user's email exactly as a query param —
#      same pattern GitHub / Stripe use to prevent fat-finger purges.
#   5. Audit log is written BEFORE the DELETE so the trail survives.
#
# FK STRATEGY
#   - user_preferences.user_id (CASCADE)            → row deleted automatically
#   - password_reset_tokens.user_id (CASCADE)       → row deleted automatically
#   - leads.completed_by_user_id (SET NULL)         → conversion attribution preserved as anonymous
#   - lead_notes.created_by (SET NULL)              → note authorship preserved as anonymous
#   - lead_attachments.uploaded_by_id (no FK)       → manually NULL'd here
#   - audit_logs.user_id (no FK)                    → INTENTIONALLY KEPT — HIPAA requires
#                                                     audit history to remain intact even after
#                                                     the user row is gone.
# =============================================================================


@router.delete("/{user_id}/permanent")
async def hard_delete_user(
    user_id: str,
    confirm_email: str,
    caller: User = Depends(require_role("primary_admin")),
    db: Session = Depends(get_db),
):
    """
    Permanently delete a user. Irreversible. primary_admin only.

    The caller MUST pass `confirm_email` matching the target user's email
    (case-insensitive). This is a SaaS-standard guard against accidental
    purges from a misclick.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Cannot hard-delete yourself.
    if str(caller.id) == str(user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot permanently delete your own account.",
        )

    # Defense in depth: don't allow primary_admin → primary_admin purges.
    # Even though require_role(primary_admin) gates the endpoint, this protects
    # against multi-primary-admin orgs accidentally nuking each other.
    if user.role == UserRole.PRIMARY_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A primary admin account cannot be permanently deleted.",
        )

    # Email confirmation guard — caller must echo the email back exactly.
    # Case-insensitive match because users sometimes register with mixed case.
    expected = (user.email or "").strip().lower()
    provided = (confirm_email or "").strip().lower()
    if not expected or provided != expected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Confirmation email does not match. Type the user's email "
                "exactly to confirm permanent deletion."
            ),
        )

    # Capture identity for the audit log BEFORE we delete the row.
    deleted_user_snapshot = {
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role.value if user.role else None,
        "status": user.status.value if user.status else None,
        "deleted_by": str(caller.id),
        "deleted_by_email": caller.email,
    }

    # Manually NULL columns that point at users.id but have no FK constraint.
    # SQLAlchemy can't auto-handle these because they're plain UUID columns.
    try:
        from ..models.attachment import LeadAttachment
        db.query(LeadAttachment).filter(
            LeadAttachment.uploaded_by_id == user.id
        ).update({"uploaded_by_id": None}, synchronize_session=False)
    except Exception as exc:
        # If attachments table is missing in some installs, log and continue —
        # the actual delete still proceeds.
        logger.warning("Could not null lead_attachments.uploaded_by_id: %s", exc)

    # Audit log BEFORE deletion so the row references a valid user_id at insert.
    try:
        from ..services.audit import AuditService
        AuditService(db).log_delete(
            table_name="users",
            record_id=user.id,
            user_id=caller.id,
            user_email=caller.email,
            new_values=deleted_user_snapshot,
        )
    except Exception as exc:
        # Audit failure must not abort the delete — log and continue.
        logger.error("Audit log for hard-delete failed: %s", exc)

    # The actual delete. ON DELETE rules on user_preferences/password_reset_tokens
    # cascade; SET NULL on lead_notes.created_by and leads.completed_by_user_id
    # preserves orphaned attribution as anonymous.
    db.delete(user)
    db.commit()

    logger.warning(
        "[HARD DELETE] %s permanently deleted user %s (%s)",
        caller.email, deleted_user_snapshot["email"], deleted_user_snapshot["user_id"],
    )

    return {
        "success": True,
        "message": f"User {deleted_user_snapshot['email']} permanently deleted",
        "deleted_user_id": deleted_user_snapshot["user_id"],
    }
