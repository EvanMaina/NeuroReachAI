"""
============================================================================
UNIFIED LEAD CONFIRMATION EMAIL — SINGLE SOURCE OF TRUTH
============================================================================

This is the single source of truth for all lead confirmation emails.
Any new lead source should call send_lead_confirmation_email(lead_data).

All three lead sources (Widget, Google Ads, Jotform) use this ONE template.
DO NOT create separate confirmation email templates elsewhere.

Uses the shared email_base for consistent header/footer/logo across all emails.
============================================================================
"""

import logging
from typing import Dict, Any

from .email_base import wrap_in_email_layout, email_divider

logger = logging.getLogger(__name__)


# =============================================================================
# HTML Email Builder
# =============================================================================

def build_lead_confirmation_email(lead_data: Dict[str, Any]) -> str:
    """
    Build the unified lead confirmation email HTML.

    This is the ONLY place the lead confirmation email HTML lives.
    Final version — no conditions section, no reference number.
    Uses bullet dots instead of numbered steps.

    Args:
        lead_data: Dict with keys:
            - first_name (str): Patient's first name

    Returns:
        Fully rendered HTML string for the confirmation email.
    """
    first_name = lead_data.get("first_name", "").strip() or "there"

    # Build the body content (just the inner rows, no header/footer)
    body_html = f"""
{email_divider()}

                    <!-- Greeting -->
                    <tr>
                        <td style="padding: 20px 30px 0 30px;">
                            <h2 style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: bold; color: #1A1A1A; line-height: 1.3;">
                                Thank You, {first_name}!
                            </h2>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 16px 30px 0 30px;">
                            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #444444; line-height: 1.6;">
                                We're glad you reached out to TMS Institute of Arizona. Taking the first step toward feeling better takes courage &mdash; and we're here to make the rest easy for you.
                            </p>
                        </td>
                    </tr>

{email_divider()}

                    <!-- What Happens Next -->
                    <tr>
                        <td style="padding: 0 30px;">
                            <h3 style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 20px; font-weight: bold; color: #1A1A1A; line-height: 1.3;">
                                What Happens Next
                            </h3>
                        </td>
                    </tr>

                    <!-- Step 1 -->
                    <tr>
                        <td style="padding: 20px 30px 0 30px;">
                            <p style="margin: 0 0 4px 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: bold; color: #1A1A1A; line-height: 1.4;">
                                &#8226; We Review Your Information
                            </p>
                            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #444444; line-height: 1.6;">
                                Our care team is reviewing your details now.
                            </p>
                        </td>
                    </tr>

                    <!-- Step 2 -->
                    <tr>
                        <td style="padding: 16px 30px 0 30px;">
                            <p style="margin: 0 0 4px 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: bold; color: #1A1A1A; line-height: 1.4;">
                                &#8226; A Personal Call From Us
                            </p>
                            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #444444; line-height: 1.6;">
                                A care coordinator will reach out within 2 hours to answer your questions.
                            </p>
                        </td>
                    </tr>

                    <!-- Step 3 -->
                    <tr>
                        <td style="padding: 16px 30px 0 30px;">
                            <p style="margin: 0 0 4px 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: bold; color: #1A1A1A; line-height: 1.4;">
                                &#8226; Your Consultation
                            </p>
                            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #444444; line-height: 1.6;">
                                We'll schedule a consultation with our TMS specialists at a time that works for you.
                            </p>
                        </td>
                    </tr>

{email_divider()}

                    <!-- Warm closing -->
                    <tr>
                        <td style="padding: 0 30px;">
                            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #444444; font-style: italic; line-height: 1.6;">
                                We look forward to helping you on your journey to wellness.
                            </p>
                        </td>
                    </tr>

{email_divider()}

                    <!-- Contact -->
                    <tr>
                        <td style="padding: 0 30px;">
                            <p style="margin: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; color: #1A1A1A; line-height: 1.4;">
                                Have questions right now?
                            </p>
                            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #444444; line-height: 1.6;">
                                Call us at <a href="tel:4806683599" style="color: #1A1A1A; font-weight: bold; text-decoration: none;">(480) 668-3599</a> &mdash; we're happy to help.
                            </p>
                        </td>
                    </tr>
"""

    return wrap_in_email_layout(
        title="We've Received Your Request",
        body_html=body_html,
    )


# =============================================================================
# Unified Sending Function
# =============================================================================

EMAIL_SUBJECT = "We've Received Your Request \u2014 TMS Institute of Arizona"
EMAIL_FROM = "support@tmsinstitute.co"


def send_lead_confirmation_email(lead_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build and send the unified lead confirmation email.

    This is the ONE function all lead sources call to send the patient-facing
    confirmation email. It builds the HTML from the master template, sends
    via Paubox (with SMTP fallback), and handles errors gracefully.

    Args:
        lead_data: Dict with keys:
            - first_name (str): Patient's first name
            - email (str): Patient's email address
            - lead_number (str, optional): For logging only
            - conditions (list[str], optional): Ignored (kept for caller compat)
            - other_condition_text (str, optional): Ignored (kept for caller compat)

    Returns:
        Dict with:
            - success (bool)
            - provider (str): "paubox" or "smtp"
            - error (str, optional): Error message if failed
    """
    email = lead_data.get("email", "")
    first_name = lead_data.get("first_name", "")
    lead_number = lead_data.get("lead_number", "unknown")

    if not email:
        logger.warning(
            f"Cannot send confirmation email — no email address for lead {lead_number}"
        )
        return {"success": False, "error": "No email address provided"}

    # Build the HTML
    html_content = build_lead_confirmation_email(lead_data)

    # Build plain-text fallback (no conditions, no reference number)
    text_content = f"""Thank You, {first_name or 'there'}!

We're glad you reached out to TMS Institute of Arizona. Taking the first step toward feeling better takes courage - and we're here to make the rest easy for you.

What Happens Next:
* We Review Your Information - Our care team is reviewing your details now.
* A Personal Call From Us - A care coordinator will reach out within 2 hours to answer your questions.
* Your Consultation - We'll schedule a consultation with our TMS specialists at a time that works for you.

We look forward to helping you on your journey to wellness.

Have questions right now?
Call us at (480) 668-3599 - we're happy to help.

---
TMS Institute of Arizona
5150 N 16th St, Suite A-114, Phoenix, AZ 85016
(480) 668-3599 | support@tmsinstitute.co | tmsinstitute.co

This email contains protected health information (PHI). Your privacy is protected under HIPAA.
© 2026 TMS Institute of Arizona. All rights reserved."""

    try:
        from .paubox_email_service import send_email_via_paubox

        result = send_email_via_paubox(
            to_email=email,
            subject=EMAIL_SUBJECT,
            html_content=html_content,
            text_content=text_content,
            lead_id=lead_data.get("lead_id"),
        )

        if result.get("success"):
            logger.info(
                f"Lead confirmation email sent to {email[:3]}***@{email.split('@')[-1] if '@' in email else '***'} "
                f"via {result.get('provider', 'unknown')} for lead {lead_number}"
            )
        else:
            logger.error(
                f"Failed to send lead confirmation email for lead {lead_number}: "
                f"{result.get('error', 'unknown error')}"
            )

        return result

    except Exception as e:
        logger.error(f"Exception sending lead confirmation email for {lead_number}: {e}")
        return {"success": False, "error": str(e)}
