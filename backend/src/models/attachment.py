"""
Lead Attachment database model.

Stores metadata for documents attached to leads.
Actual file content is stored on the local filesystem.
"""

from sqlalchemy import Column, String, BigInteger, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class LeadAttachment(Base):
    """
    File attachment linked to a lead.

    Stores metadata (filename, type, size, uploader) while the actual
    binary content lives on the local filesystem at:
        backend/static/attachments/<stored_filename>

    Attributes:
        id: UUID primary key
        lead_id: FK to leads table
        filename: Original filename from uploader
        stored_filename: UUID-based filename on disk (prevents collisions)
        file_type: MIME type (e.g., application/pdf, image/png)
        file_size: Size in bytes
        uploaded_by: Name of the coordinator who uploaded
        uploaded_by_id: FK to users table (nullable)
        created_at: Upload timestamp
    """

    __tablename__ = "lead_attachments"

    id = Column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=func.uuid_generate_v4(),
        nullable=False,
    )

    lead_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    filename = Column(String(500), nullable=False)
    stored_filename = Column(String(500), nullable=False)
    file_type = Column(String(100), nullable=False)
    file_size = Column(BigInteger, nullable=False, default=0)

    uploaded_by = Column(String(255), nullable=True)
    uploaded_by_id = Column(PGUUID(as_uuid=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    )

    # Relationship back to lead (optional, for eager loading)
    lead = relationship("Lead", backref="attachments", foreign_keys=[lead_id])

    def __repr__(self) -> str:
        return (
            f"<LeadAttachment(id={self.id}, "
            f"lead_id={self.lead_id}, "
            f"filename='{self.filename}')>"
        )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "lead_id": str(self.lead_id),
            "filename": self.filename,
            "stored_filename": self.stored_filename,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "uploaded_by": self.uploaded_by,
            "uploaded_by_id": str(self.uploaded_by_id) if self.uploaded_by_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
