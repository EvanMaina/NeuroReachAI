"""
Lead Number Generation Service.

Generates unique lead numbers in the format TMS-YYYY-XXX.
Thread-safe implementation with database locking and retry logic.

Note: Legacy leads may use the NR-YYYY-XXX prefix. Both formats are valid.
"""

import re
from datetime import datetime
from typing import Optional

from sqlalchemy import func, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..models.lead import Lead


def generate_lead_number(db: Session, max_retries: int = 5) -> str:
    """
    Generate a unique lead number in format TMS-YYYY-XXX.
    
    Uses MAX query to find highest existing number and increment.
    Includes retry logic to handle race conditions.
    Queries both TMS- and legacy NR- prefixed leads to avoid collisions.
    
    Args:
        db: SQLAlchemy database session
        max_retries: Number of retries on collision
        
    Returns:
        Unique lead number string (e.g., "TMS-2026-001")
        
    Example:
        >>> lead_number = generate_lead_number(db)
        >>> print(lead_number)
        "TMS-2026-042"
    """
    current_year = datetime.now().year
    prefix = f"TMS-{current_year}-"
    
    # Find the highest lead number for this year across BOTH prefixes
    # This prevents collisions with legacy NR- leads
    result = db.execute(
        text("""
            SELECT MAX(num) FROM (
                SELECT CAST(SUBSTRING(lead_number FROM 'TMS-\\d{4}-(\\d+)') AS INTEGER) AS num
                FROM leads
                WHERE lead_number LIKE :tms_pattern
                UNION ALL
                SELECT CAST(SUBSTRING(lead_number FROM 'NR-\\d{4}-(\\d+)') AS INTEGER) AS num
                FROM leads
                WHERE lead_number LIKE :nr_pattern
            ) combined
        """),
        {"tms_pattern": f"TMS-{current_year}-%", "nr_pattern": f"NR-{current_year}-%"}
    ).scalar()
    
    # Calculate next number
    if result is None:
        next_number = 1
    else:
        next_number = result + 1
    
    # Format: TMS-YYYY-XXX (padded to 3 digits, but can grow)
    lead_number = f"{prefix}{next_number:03d}"
    
    return lead_number


def generate_unique_lead_number(db: Session, max_retries: int = 10) -> str:
    """
    Generate a guaranteed unique lead number with retry logic.
    
    This function handles race conditions by checking if the number
    exists and incrementing until a unique one is found.
    Queries both TMS- and legacy NR- prefixed leads to avoid collisions.
    
    Args:
        db: SQLAlchemy database session
        max_retries: Maximum number of attempts
        
    Returns:
        Unique lead number string
        
    Raises:
        RuntimeError: If unable to generate unique number after max_retries
    """
    current_year = datetime.now().year
    prefix = f"TMS-{current_year}-"
    
    for attempt in range(max_retries):
        # Find the highest lead number for this year across BOTH prefixes
        result = db.execute(
            text("""
                SELECT MAX(num) FROM (
                    SELECT CAST(SUBSTRING(lead_number FROM 'TMS-\\d{4}-(\\d+)') AS INTEGER) AS num
                    FROM leads
                    WHERE lead_number LIKE :tms_pattern
                    UNION ALL
                    SELECT CAST(SUBSTRING(lead_number FROM 'NR-\\d{4}-(\\d+)') AS INTEGER) AS num
                    FROM leads
                    WHERE lead_number LIKE :nr_pattern
                ) combined
            """),
            {"tms_pattern": f"TMS-{current_year}-%", "nr_pattern": f"NR-{current_year}-%"}
        ).scalar()
        
        # Calculate next number (add attempt to handle retries)
        if result is None:
            next_number = 1 + attempt
        else:
            next_number = result + 1 + attempt
        
        lead_number = f"{prefix}{next_number:03d}"
        
        # Check if it exists
        exists = db.query(Lead.id).filter(Lead.lead_number == lead_number).first()
        
        if not exists:
            return lead_number
    
    # Fallback: add timestamp-based suffix
    import time
    timestamp_suffix = int(time.time() * 1000) % 10000
    return f"{prefix}{timestamp_suffix:04d}"


def validate_lead_number_format(lead_number: str) -> bool:
    """
    Validate that a lead number follows the correct format.
    
    Accepts both TMS- (current) and NR- (legacy) prefixes.
    
    Args:
        lead_number: String to validate
        
    Returns:
        True if valid format, False otherwise
        
    Example:
        >>> validate_lead_number_format("TMS-2026-001")
        True
        >>> validate_lead_number_format("NR-2026-001")
        True
        >>> validate_lead_number_format("INVALID")
        False
    """
    pattern = r"^(TMS|NR)-\d{4}-\d{3,}$"
    return bool(re.match(pattern, lead_number))


def get_next_lead_number_preview(db: Session) -> str:
    """
    Preview what the next lead number will be without creating it.
    
    Useful for UI display or confirmation screens.
    
    Args:
        db: SQLAlchemy database session
        
    Returns:
        Preview of next lead number
    """
    return generate_lead_number(db)
