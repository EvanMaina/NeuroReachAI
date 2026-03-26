"""
Lead Attachment endpoints.

Handles file upload, download, list, and delete for lead attachments.
Files are stored on the local filesystem at backend/static/attachments/.
Metadata is stored in the lead_attachments PostgreSQL table.
"""

import logging
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.auth import get_current_user, require_role
from ..models.attachment import LeadAttachment
from ..models.lead import Lead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/leads", tags=["Lead Attachments"])

# ─── Configuration ────────────────────────────────────────────────────────────
# Max file size: 25 MB
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB in bytes

# Allowed MIME types
ALLOWED_TYPES = {
    # PDF
    "application/pdf",
    # Word
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    # Excel
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    # Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
}

# Storage directory (relative to backend root)
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "attachments"


def _ensure_upload_dir() -> None:
    """Create the upload directory if it doesn't exist."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _get_user_info(request: Request, db: Session) -> tuple:
    """Extract authenticated user name and ID from JWT token."""
    user_name = "System"
    user_id = None
    try:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            from ..core.security import decode_token
            from ..models.user import User
            token = auth_header.split(" ")[1]
            payload = decode_token(token)
            if payload and "sub" in payload:
                user = db.query(User).filter(User.id == payload["sub"]).first()
                if user:
                    user_id = user.id
                    user_name = f"{user.first_name} {user.last_name}".strip() or user.email
    except Exception:
        pass
    return user_name, user_id


# =============================================================================
# Upload Attachment
# =============================================================================

@router.post(
    "/{lead_id}/attachments",
    status_code=status.HTTP_201_CREATED,
    summary="Upload Attachment",
    description="Upload a file attachment to a lead. Max 25MB. Supports PDF, Word, Excel, images.",
    dependencies=[Depends(require_role("administrator", "coordinator"))],
)
async def upload_attachment(
    lead_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    """Upload a file and attach it to a lead."""

    # Verify lead exists and is not deleted
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.deleted_at.is_(None),
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Validate MIME type
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{content_type}' is not allowed. Supported: PDF, Word, Excel, images.",
        )

    # Read file content and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size ({len(content) / 1024 / 1024:.1f} MB) exceeds the 25 MB limit.",
        )

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty.")

    # Generate unique filename to prevent collisions
    original_filename = file.filename or "unnamed"
    extension = Path(original_filename).suffix.lower() or ""
    stored_filename = f"{uuid.uuid4().hex}{extension}"

    # Write to disk
    _ensure_upload_dir()
    file_path = UPLOAD_DIR / stored_filename
    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        logger.error(f"Failed to write attachment to disk: {e}")
        raise HTTPException(status_code=500, detail="Failed to save file.")

    # Get uploader info
    user_name, user_id = _get_user_info(request, db)

    # Save metadata to database
    attachment = LeadAttachment(
        lead_id=lead_id,
        filename=original_filename,
        stored_filename=stored_filename,
        file_type=content_type,
        file_size=len(content),
        uploaded_by=user_name,
        uploaded_by_id=user_id,
    )
    db.add(attachment)

    try:
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(
            "Failed to save attachment metadata for lead %s (%s): %s",
            lead_id,
            original_filename,
            e,
            exc_info=True,
        )
        try:
            if file_path.exists():
                file_path.unlink()
        except OSError as cleanup_error:
            logger.warning(
                "Attachment metadata save failed and orphan file cleanup also failed for %s: %s",
                stored_filename,
                cleanup_error,
            )
        raise HTTPException(status_code=500, detail="Failed to save attachment metadata.")

    db.refresh(attachment)

    logger.info(f"Attachment uploaded: {original_filename} ({len(content)} bytes) for lead {lead_id}")

    return attachment.to_dict()


# =============================================================================
# List Attachments for a Lead
# =============================================================================

@router.get(
    "/{lead_id}/attachments",
    summary="List Attachments",
    description="Get all attachments for a lead.",
    dependencies=[Depends(get_current_user)],
)
async def list_attachments(
    lead_id: UUID,
    db: Session = Depends(get_db),
) -> list:
    """List all attachments for a lead, ordered by creation date desc."""

    # Verify lead exists
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.deleted_at.is_(None),
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    attachments = (
        db.query(LeadAttachment)
        .filter(LeadAttachment.lead_id == lead_id)
        .order_by(LeadAttachment.created_at.desc())
        .all()
    )

    return [a.to_dict() for a in attachments]


# =============================================================================
# Download Attachment
# =============================================================================

@router.get(
    "/{lead_id}/attachments/{attachment_id}/download",
    summary="Download Attachment",
    description="Download an attachment file.",
    dependencies=[Depends(get_current_user)],
)
async def download_attachment(
    lead_id: UUID,
    attachment_id: UUID,
    db: Session = Depends(get_db),
) -> FileResponse:
    """Download an attachment by ID."""

    attachment = db.query(LeadAttachment).filter(
        LeadAttachment.id == attachment_id,
        LeadAttachment.lead_id == lead_id,
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    file_path = UPLOAD_DIR / attachment.stored_filename
    if not file_path.exists():
        logger.error(f"Attachment file missing from disk: {attachment.stored_filename}")
        raise HTTPException(status_code=404, detail="Attachment file not found on server")

    return FileResponse(
        path=str(file_path),
        filename=attachment.filename,
        media_type=attachment.file_type,
    )


# =============================================================================
# Delete Attachment
# =============================================================================

@router.delete(
    "/{lead_id}/attachments/{attachment_id}",
    summary="Delete Attachment",
    description="Delete an attachment (removes file from disk and metadata from DB).",
    dependencies=[Depends(require_role("administrator", "coordinator"))],
)
async def delete_attachment(
    lead_id: UUID,
    attachment_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Delete an attachment (file + metadata)."""

    attachment = db.query(LeadAttachment).filter(
        LeadAttachment.id == attachment_id,
        LeadAttachment.lead_id == lead_id,
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    filename = attachment.filename

    # Remove file from disk
    file_path = UPLOAD_DIR / attachment.stored_filename
    try:
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        logger.warning(f"Failed to delete attachment file from disk: {e}")

    # Remove metadata from DB
    db.delete(attachment)
    db.commit()

    logger.info(f"Attachment deleted: {filename} for lead {lead_id}")

    return {"success": True, "message": f"Attachment '{filename}' deleted."}


# =============================================================================
# Attachment Count for Multiple Leads (for table badge)
# =============================================================================

@router.get(
    "/attachment-counts",
    summary="Get Attachment Counts",
    description="Get attachment counts for all leads (for table paperclip badge).",
    dependencies=[Depends(get_current_user)],
)
async def get_attachment_counts(
    db: Session = Depends(get_db),
) -> dict:
    """
    Return a dict mapping lead_id -> attachment count.
    Only includes leads that have at least 1 attachment.
    Used by the frontend LeadsTable to show/hide the paperclip icon.
    """
    results = (
        db.query(
            LeadAttachment.lead_id,
            func.count(LeadAttachment.id).label("count"),
        )
        .group_by(LeadAttachment.lead_id)
        .all()
    )

    return {str(row.lead_id): row.count for row in results}
