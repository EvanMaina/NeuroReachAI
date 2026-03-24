"""
============================================================================
UNIFIED EMAIL TEMPLATES — SINGLE SOURCE OF TRUTH
============================================================================

All patient-facing and provider-facing email templates live here.
Each builder uses the shared email_base layout (header, footer, logo, styling).

Templates:
- Item 2: Instant auto-submission confirmation (replaces old confirmation)
- Item 3: Unreachable 24-hour follow-up (recurring)
- Item 4: 72-hour social proof email
- Item 5: 14-day gentle re-engagement
- Item 6: Monthly referring physician email (B2B)
- Legacy: Follow-up, Not-Interested follow-up (kept for backward compat)

ALL templates use wrap_in_email_layout from email_base for consistent branding.
============================================================================
"""

import logging
from typing import Dict, Any

from .email_base import (
    wrap_in_email_layout,
    email_divider,
    CLINIC_NAME,
    CLINIC_PHONE,
    CLINIC_EMAIL,
    CLINIC_WEBSITE,
    CLINIC_ADDRESS,
    HEADER_BG_COLOR,
)

logger = logging.getLogger(__name__)


# =============================================================================
# CTA Button Helper
# =============================================================================

def _cta_button(label: str, href: str, bg_color: str = HEADER_BG_COLOR) -> str:
    """Build a consistent CTA button row."""
    return f"""                    <tr>
                        <td align="center" style="padding: 10px 30px 0 30px;">
                            <a href="{href}" style="display: inline-block; padding: 14px 32px; background-color: {bg_color}; color: #ffffff; text-decoration: none; border-radius: 8px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold;">{label}</a>
                        </td>
                    </tr>"""


def _paragraph(text: str) -> str:
    """Build a standard body paragraph row."""
    return f"""                    <tr>
                        <td style="padding: 16px 30px 0 30px;">
                            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #444444; line-height: 1.6;">
                                {text}
                            </p>
                        </td>
                    </tr>"""


def _bullet(text: str) -> str:
    """Build a bullet-point paragraph."""
    return f"""                    <tr>
                        <td style="padding: 8px 30px 0 44px;">
                            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #444444; line-height: 1.6;">
                                &#8226;&nbsp; {text}
                            </p>
                        </td>
                    </tr>"""


def _heading(text: str, size: str = "24px") -> str:
    """Build a heading row."""
    return f"""                    <tr>
                        <td style="padding: 20px 30px 0 30px;">
                            <h2 style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: {size}; font-weight: bold; color: #1A1A1A; line-height: 1.3;">
                                {text}
                            </h2>
                        </td>
                    </tr>"""


def _signoff(name: str, title: str = "") -> str:
    """Build a sign-off block."""
    title_html = f"""
                            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #888888; line-height: 1.6;">
                                {title}
                            </p>""" if title else ""
    return f"""                    <tr>
                        <td style="padding: 20px 30px 0 30px;">
                            <p style="margin: 0 0 4px 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #444444; line-height: 1.6;">
                                {name}
                            </p>{title_html}
                        </td>
                    </tr>"""


def _quote_block(text: str, attribution: str = "") -> str:
    """Build an italicized quote block."""
    attr_html = f'<br><span style="font-style: normal; font-size: 13px; color: #999999;">{attribution}</span>' if attribution else ""
    return f"""                    <tr>
                        <td style="padding: 16px 30px 0 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F0F7F7; border-left: 4px solid {HEADER_BG_COLOR}; border-radius: 8px;">
                                <tr>
                                    <td style="padding: 16px 20px;">
                                        <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #444444; line-height: 1.6; font-style: italic;">
                                            &ldquo;{text}&rdquo;{attr_html}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>"""


# =============================================================================
# ITEM 2: Instant Auto-Submission Confirmation Email
# =============================================================================

LEAD_CONFIRMATION_SUBJECT = "We received your information, {first_name} \u2014 here\u2019s what happens next"
LEAD_CONFIRMATION_PREHEADER = "Your TMS consultation journey starts now. A team member will reach out within 24 hours."


def build_lead_confirmation_email(lead_data: Dict[str, Any]) -> str:
    """
    Build the instant auto-submission confirmation email (Item 2).
    Fires within 60 seconds of form submission.
    """
    first_name = lead_data.get("first_name", "").strip() or "there"

    body_html = f"""
{email_divider()}

{_heading(f"Hi {first_name},")}

{_paragraph("Thank you for reaching out to the TMS Institute of Arizona. Taking this step shows real courage, and we want you to know you are in the right place.")}

{_paragraph("<strong>Here is exactly what happens next:</strong>")}

{_bullet("Within the next business day, our New Patient Coordinator will call you at the number you provided to learn more about what you are experiencing and answer any questions.")}

{_bullet("We will verify your insurance benefits so you know your out-of-pocket costs before your first appointment. Most major plans, including Aetna, BCBS, Cigna, UnitedHealthcare, Tricare, and Medicare, cover TMS for depression and OCD.")}

{_bullet("If TMS is a good fit, we will schedule your initial consultation with one of our board-certified physicians.")}

{email_divider()}

{_paragraph("<strong>Why families and patients choose us:</strong>")}

{_bullet("Arizona&rsquo;s first dedicated TMS clinic, led by Dr. Ruchir Patel &mdash; triple board-certified in internal medicine, sleep medicine, and obesity medicine with fellowship training in TMS at Duke University")}

{_bullet("Board-certified psychiatrists and psychiatric nurse practitioners on staff")}

{_bullet("Advanced MagVenture TMS technology with multiple protocol options")}

{_bullet("The only TMS clinic in Arizona with integrated sleep medicine expertise, ensuring your brain is optimally prepared to respond to treatment")}

{_paragraph(f'If you would like to get started sooner, feel free to call us directly at <a href="tel:4806683599" style="color: #1A1A1A; font-weight: bold; text-decoration: none;">(480) 668-3599</a>.')}

{_paragraph("We look forward to speaking with you.")}

{_signoff("Warmly,<br>The Team at TMS Institute of Arizona")}

{email_divider()}

                    <tr>
                        <td style="padding: 16px 30px 0 30px;">
                            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #666666; line-height: 1.6;">
                                <strong>P.S.</strong> Wondering if TMS is right for you? Over 70% of patients who have not responded to antidepressants experience meaningful improvement with TMS therapy. It is non-invasive, requires no anesthesia, and each session takes as little as 3 minutes.
                            </p>
                        </td>
                    </tr>

{email_divider()}

{_cta_button("CALL US NOW: (480) 668-3599", "tel:4806683599")}
"""

    return wrap_in_email_layout(
        title="We Received Your Information",
        body_html=body_html,
        subtitle="Your TMS consultation journey starts now",
    )


def send_lead_confirmation_email(lead_data: Dict[str, Any]) -> Dict[str, Any]:
    """Build and send the instant auto-submission confirmation email (Item 2)."""
    email = lead_data.get("email", "")
    first_name = lead_data.get("first_name", "")
    lead_number = lead_data.get("lead_number", "unknown")

    if not email:
        logger.warning(f"Cannot send confirmation email — no email for lead {lead_number}")
        return {"success": False, "error": "No email address provided"}

    html_content = build_lead_confirmation_email(lead_data)
    subject = LEAD_CONFIRMATION_SUBJECT.format(first_name=first_name or "there")

    text_content = f"""Hi {first_name or 'there'},

Thank you for reaching out to the TMS Institute of Arizona. Taking this step shows real courage, and we want you to know you are in the right place.

Here is exactly what happens next:

- Within the next business day, our New Patient Coordinator will call you at the number you provided to learn more about what you are experiencing and answer any questions.

- We will verify your insurance benefits so you know your out-of-pocket costs before your first appointment. Most major plans, including Aetna, BCBS, Cigna, UnitedHealthcare, Tricare, and Medicare, cover TMS for depression and OCD.

- If TMS is a good fit, we will schedule your initial consultation with one of our board-certified physicians.

Why families and patients choose us:

- Arizona's first dedicated TMS clinic, led by Dr. Ruchir Patel
- Board-certified psychiatrists and psychiatric nurse practitioners on staff
- Advanced MagVenture TMS technology with multiple protocol options
- The only TMS clinic in Arizona with integrated sleep medicine expertise

If you would like to get started sooner, feel free to call us directly at (480) 668-3599.

We look forward to speaking with you.

Warmly,
The Team at TMS Institute of Arizona

P.S. Wondering if TMS is right for you? Over 70% of patients who have not responded to antidepressants experience meaningful improvement with TMS therapy. It is non-invasive, requires no anesthesia, and each session takes as little as 3 minutes.

---
{CLINIC_NAME}
{CLINIC_ADDRESS}
(480) 668-3599 | {CLINIC_EMAIL} | {CLINIC_WEBSITE}"""

    try:
        from .paubox_email_service import send_email_via_paubox
        result = send_email_via_paubox(
            to_email=email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            lead_id=lead_data.get("lead_id"),
        )
        if result.get("success"):
            logger.info(f"Lead confirmation email sent for lead {lead_number}")
        else:
            logger.error(f"Failed to send confirmation email for lead {lead_number}: {result.get('error')}")
        return result
    except Exception as e:
        logger.error(f"Exception sending confirmation email for {lead_number}: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# ITEM 3: Unreachable 24-Hour Follow-Up Email (Recurring)
# =============================================================================

UNREACHABLE_FOLLOW_UP_SUBJECT = "{first_name}, we tried reaching you \u2014 plus a quick guide to understanding TMS"
UNREACHABLE_FOLLOW_UP_PREHEADER = "We called but missed you. Here is a free resource while you decide."


def build_unreachable_follow_up_email(lead_data: Dict[str, Any]) -> str:
    """Build the unreachable 24-hour recurring follow-up email (Item 3)."""
    first_name = lead_data.get("first_name", "").strip() or "there"

    body_html = f"""
{email_divider()}

{_heading(f"Hi {first_name},")}

{_paragraph("We tried calling you today but were not able to connect. We completely understand &mdash; life gets busy, and this is a big decision.")}

{_paragraph("I wanted to share something that many of our patients found helpful when they were in the same place you are right now: a short guide on what to expect from TMS therapy, including how sessions work, what the research says about outcomes, and how insurance coverage typically works in Arizona.")}

{_paragraph("<strong>Here are a few things patients frequently ask us:</strong>")}

{_quote_block("Will it hurt?", "")}
{_paragraph("Most patients describe the sensation as a light tapping. There is no sedation, no recovery time, and you can drive yourself to and from every appointment.")}

{_quote_block("How long until I feel better?", "")}
{_paragraph("Many patients notice improvement within the first two to three weeks, though the full course of treatment is typically 6 to 8 weeks.")}

{_quote_block("What makes your clinic different?", "")}
{_paragraph("Our Medical Director, Dr. Patel, is one of the only physicians in Arizona with dual expertise in TMS therapy and sleep medicine. Research shows that sleep quality directly impacts how the brain responds to TMS &mdash; and optimizing both is something only our team can offer.")}

{_paragraph(f'We would love the chance to talk with you. You can call us at <a href="tel:4806683599" style="color: #1A1A1A; font-weight: bold; text-decoration: none;">(480) 668-3599</a> or simply reply to this email with a good time to reach you.')}

{_signoff("With care,<br>The TMS Institute of Arizona Team")}
"""

    return wrap_in_email_layout(
        title="We Tried Reaching You",
        body_html=body_html,
        subtitle="Plus a quick guide to understanding TMS",
    )


def send_unreachable_follow_up_email(lead_data: Dict[str, Any]) -> Dict[str, Any]:
    """Build and send the unreachable 24-hour recurring follow-up email."""
    email = lead_data.get("email", "")
    first_name = lead_data.get("first_name", "")
    lead_id = lead_data.get("lead_id", "unknown")

    if not email:
        return {"success": False, "error": "No email address provided"}

    html_content = build_unreachable_follow_up_email(lead_data)
    subject = UNREACHABLE_FOLLOW_UP_SUBJECT.format(first_name=first_name or "there")

    text_content = f"""Hi {first_name or 'there'},

We tried calling you today but were not able to connect. We completely understand - life gets busy, and this is a big decision.

Here are a few things patients frequently ask us:

"Will it hurt?" Most patients describe the sensation as a light tapping. There is no sedation, no recovery time, and you can drive yourself to and from every appointment.

"How long until I feel better?" Many patients notice improvement within the first two to three weeks, though the full course of treatment is typically 6 to 8 weeks.

"What makes your clinic different?" Our Medical Director, Dr. Patel, is one of the only physicians in Arizona with dual expertise in TMS therapy and sleep medicine.

We would love the chance to talk with you. Call us at (480) 668-3599.

With care,
The TMS Institute of Arizona Team

---
{CLINIC_NAME}
{CLINIC_ADDRESS}
(480) 668-3599 | {CLINIC_EMAIL} | {CLINIC_WEBSITE}"""

    try:
        from .paubox_email_service import send_email_via_paubox
        result = send_email_via_paubox(to_email=email, subject=subject, html_content=html_content, text_content=text_content, lead_id=lead_id)
        if result.get("success"):
            logger.info(f"Unreachable follow-up email sent for lead {lead_id}")
        return result
    except Exception as e:
        logger.error(f"Exception sending unreachable follow-up for {lead_id}: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# ITEM 4: 72-Hour Social Proof Email
# =============================================================================

SOCIAL_PROOF_72H_SUBJECT = "\u201cI finally feel like myself again\u201d \u2014 real stories from TMS patients"
SOCIAL_PROOF_72H_PREHEADER = "See what patients say about their experience at TMS Institute of Arizona."


def build_social_proof_72h_email(lead_data: Dict[str, Any]) -> str:
    """Build the 72-hour social proof and objection handling email (Item 4)."""
    first_name = lead_data.get("first_name", "").strip() or "there"

    body_html = f"""
{email_divider()}

{_heading(f"Hi {first_name},")}

{_paragraph("We know that considering a new treatment can feel overwhelming. So instead of us telling you about TMS, we wanted to share what our patients say:")}

{_quote_block("What an amazing team &mdash; and a miracle therapy. If you are battling depression, Dr. Patel and his team are fabulous to work with.", "&mdash; Google Review, Verified Patient")}

{_paragraph("Stories like this are why our team comes to work every day. And they are more common than you might think &mdash; research shows that approximately 50&ndash;60% of people who have not responded to medications experience significant improvement with TMS, and about one-third achieve complete remission.")}

{email_divider()}

{_paragraph("<strong>Let us address the most common concern:</strong>")}

{_paragraph("<strong>&ldquo;Is TMS covered by my insurance?&rdquo;</strong>")}

{_paragraph("The answer is most likely yes. TMS is covered by nearly all major insurance plans in Arizona for depression and OCD, including Aetna, BCBS, Cigna, UnitedHealthcare, Tricare, and Medicare. Our team handles the entire prior authorization process for you &mdash; you will know your exact costs before your first session.")}

{_paragraph(f"We have not forgotten about you, {first_name}. When you are ready, we are here.")}

{_signoff("Warmly,<br>The TMS Institute of Arizona Team")}
"""

    return wrap_in_email_layout(
        title="Real Stories from TMS Patients",
        body_html=body_html,
        subtitle="See what patients say about their experience",
    )


def send_social_proof_72h_email(lead_data: Dict[str, Any]) -> Dict[str, Any]:
    """Build and send the 72-hour social proof email."""
    email = lead_data.get("email", "")
    first_name = lead_data.get("first_name", "")
    lead_id = lead_data.get("lead_id", "unknown")

    if not email:
        return {"success": False, "error": "No email address provided"}

    html_content = build_social_proof_72h_email(lead_data)

    text_content = f"""Hi {first_name or 'there'},

We know that considering a new treatment can feel overwhelming. So instead of us telling you about TMS, we wanted to share what our patients say:

"What an amazing team - and a miracle therapy. If you are battling depression, Dr. Patel and his team are fabulous to work with." - Google Review, Verified Patient

Research shows that approximately 50-60% of people who have not responded to medications experience significant improvement with TMS, and about one-third achieve complete remission.

"Is TMS covered by my insurance?" The answer is most likely yes. TMS is covered by nearly all major insurance plans in Arizona for depression and OCD.

We have not forgotten about you, {first_name}. When you are ready, we are here.

Warmly,
The TMS Institute of Arizona Team

---
{CLINIC_NAME}
{CLINIC_ADDRESS}
(480) 668-3599 | {CLINIC_EMAIL} | {CLINIC_WEBSITE}"""

    try:
        from .paubox_email_service import send_email_via_paubox
        result = send_email_via_paubox(to_email=email, subject=SOCIAL_PROOF_72H_SUBJECT, html_content=html_content, text_content=text_content, lead_id=lead_id)
        if result.get("success"):
            logger.info(f"72h social proof email sent for lead {lead_id}")
        return result
    except Exception as e:
        logger.error(f"Exception sending 72h email for {lead_id}: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# ITEM 5: Day 14 Gentle Re-Engagement Email
# =============================================================================

DAY14_SUBJECT = "{first_name}, we are still here when you are ready"
DAY14_PREHEADER = "No pressure. Just a reminder that relief may be closer than you think."


def build_day14_reengagement_email(lead_data: Dict[str, Any]) -> str:
    """Build the 14-day gentle re-engagement email (Item 5)."""
    first_name = lead_data.get("first_name", "").strip() or "there"

    body_html = f"""
{email_divider()}

{_heading(f"Hi {first_name},")}

{_paragraph("We reached out a couple of weeks ago after you expressed interest in TMS therapy. We understand that timing is everything, and we want you to know there is no pressure and no expiration date on getting help.")}

{_paragraph("If anything has changed, or if you simply have a question you have been thinking about, we are just a phone call or email away.")}

{_paragraph("<strong>A few things to keep in mind:</strong>")}

{_bullet("Many insurance plans have annual deductibles that reset in January. If you have already met your deductible this year, starting TMS sooner could mean lower out-of-pocket costs.")}

{_bullet("TMS sessions are short. Depending on the protocol, treatment sessions can be as brief as 3 minutes. Most patients continue working, driving, and living normally throughout their entire treatment course.")}

{_bullet("You are not starting from scratch. The information you already shared with us is saved. When you are ready, we can pick right up where we left off.")}

{_paragraph("Whatever you decide, we genuinely hope you find the relief you deserve &mdash; whether that is with us or elsewhere.")}

{_signoff("With care,<br>The TMS Institute of Arizona Team")}

{email_divider()}

                    <tr>
                        <td style="padding: 16px 30px 0 30px;">
                            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #666666; line-height: 1.6;">
                                <strong>P.S.</strong> If you found a different provider or treatment that worked for you, we would love to hear about it. Your feedback helps us improve. Simply reply to this email.
                            </p>
                        </td>
                    </tr>

"""

    return wrap_in_email_layout(
        title="We Are Still Here for You",
        body_html=body_html,
        subtitle="No pressure — just a reminder that relief may be closer than you think",
    )


def send_day14_reengagement_email(lead_data: Dict[str, Any]) -> Dict[str, Any]:
    """Build and send the 14-day re-engagement email."""
    email = lead_data.get("email", "")
    first_name = lead_data.get("first_name", "")
    lead_id = lead_data.get("lead_id", "unknown")

    if not email:
        return {"success": False, "error": "No email address provided"}

    html_content = build_day14_reengagement_email(lead_data)
    subject = DAY14_SUBJECT.format(first_name=first_name or "there")

    text_content = f"""Hi {first_name or 'there'},

We reached out a couple of weeks ago after you expressed interest in TMS therapy. We understand that timing is everything, and we want you to know there is no pressure and no expiration date on getting help.

A few things to keep in mind:

- Many insurance plans have annual deductibles that reset in January. If you have already met your deductible this year, starting TMS sooner could mean lower out-of-pocket costs.

- TMS sessions are short. Depending on the protocol, treatment sessions can be as brief as 3 minutes.

- You are not starting from scratch. The information you already shared with us is saved.

Whatever you decide, we genuinely hope you find the relief you deserve.

With care,
The TMS Institute of Arizona Team

P.S. If you found a different provider or treatment that worked for you, we would love to hear about it. Simply reply to this email.

---
{CLINIC_NAME}
{CLINIC_ADDRESS}
(480) 668-3599 | {CLINIC_EMAIL} | {CLINIC_WEBSITE}"""

    try:
        from .paubox_email_service import send_email_via_paubox
        result = send_email_via_paubox(to_email=email, subject=subject, html_content=html_content, text_content=text_content, lead_id=lead_id)
        if result.get("success"):
            logger.info(f"Day-14 re-engagement email sent for lead {lead_id}")
        return result
    except Exception as e:
        logger.error(f"Exception sending day-14 email for {lead_id}: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# ITEM 6: Monthly Referring Physician Email (B2B)
# =============================================================================

PROVIDER_MONTHLY_SUBJECT = "A resource for your patients with treatment-resistant depression"
PROVIDER_MONTHLY_PREHEADER = "TMS outcomes data and referral pathway from TMS Institute of Arizona."


def build_provider_monthly_email(provider_data: Dict[str, Any]) -> str:
    """Build the monthly referring physician email (Item 6)."""
    last_name = provider_data.get("last_name", "").strip() or "Colleague"

    body_html = f"""
{email_divider()}

{_heading(f"Dear Dr. {last_name},")}

{_paragraph("I am Dr. Ruchir Patel, Medical Director of TMS Institute of Arizona and VP, Senior Medical Director at Inspire Medical Systems.")}

{_paragraph("I wanted to reach out regarding a resource for your patients who may be struggling with treatment-resistant depression.")}

{_paragraph("At our Scottsdale clinic, we offer FDA-approved transcranial magnetic stimulation supervised by board-certified physicians, not technicians. Our clinical outcomes include:")}

{_bullet("Response rates consistent with published literature (50&ndash;60%)")}
{_bullet("Integrated sleep optimization to enhance TMS response")}
{_bullet("Seamless insurance authorization and patient coordination")}
{_bullet("Detailed progress reports sent back to referring providers")}

{_paragraph("We accept most major insurance plans and handle the entire prior authorization process. If you have patients who have tried two or more antidepressants without adequate relief, I would welcome the opportunity to discuss whether TMS might be appropriate for them.")}

{_paragraph("I am happy to schedule a brief call or provide additional clinical information at your convenience.")}

{email_divider()}

                    <tr>
                        <td style="padding: 16px 30px 0 30px;">
                            <p style="margin: 0 0 4px 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #444444; line-height: 1.6;">
                                Respectfully,
                            </p>
                            <p style="margin: 0 0 4px 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: bold; color: #1A1A1A; line-height: 1.6;">
                                Ruchir P. Patel, MD, FACP
                            </p>
                            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #666666; line-height: 1.5;">
                                Triple Board Certified: Internal Medicine, Sleep Medicine, Obesity Medicine<br>
                                TMS Fellowship &mdash; Duke University School of Medicine<br>
                                Medical Director, TMS Institute of Arizona<br>
                                VP, Senior Medical Director, Inspire Medical Systems (NYSE: INSP)
                            </p>
                        </td>
                    </tr>

"""

    return wrap_in_email_layout(
        title="A Resource for Your Patients",
        body_html=body_html,
        subtitle="TMS outcomes data and referral pathway",
    )


def send_provider_monthly_email(provider_data: Dict[str, Any]) -> Dict[str, Any]:
    """Build and send the monthly referring physician email."""
    email = provider_data.get("email", "")
    last_name = provider_data.get("last_name", "")
    provider_id = provider_data.get("provider_id", "unknown")

    if not email:
        return {"success": False, "error": "No email address provided"}

    html_content = build_provider_monthly_email(provider_data)

    text_content = f"""Dear Dr. {last_name or 'Colleague'},

I am Dr. Ruchir Patel, Medical Director of TMS Institute of Arizona and VP, Senior Medical Director at Inspire Medical Systems.

I wanted to reach out regarding a resource for your patients who may be struggling with treatment-resistant depression.

At our Scottsdale clinic, we offer FDA-approved transcranial magnetic stimulation supervised by board-certified physicians, not technicians. Our clinical outcomes include:

- Response rates consistent with published literature (50-60%)
- Integrated sleep optimization to enhance TMS response
- Seamless insurance authorization and patient coordination
- Detailed progress reports sent back to referring providers

We accept most major insurance plans and handle the entire prior authorization process.

I am happy to schedule a brief call or provide additional clinical information at your convenience.

Respectfully,
Ruchir P. Patel, MD, FACP
Medical Director, TMS Institute of Arizona

---
{CLINIC_NAME}
{CLINIC_ADDRESS}
(480) 668-3599 | {CLINIC_EMAIL} | {CLINIC_WEBSITE}"""

    try:
        from .paubox_email_service import send_email_via_paubox
        result = send_email_via_paubox(to_email=email, subject=PROVIDER_MONTHLY_SUBJECT, html_content=html_content, text_content=text_content)
        if result.get("success"):
            logger.info(f"Monthly provider email sent to provider {provider_id}")
        return result
    except Exception as e:
        logger.error(f"Exception sending provider monthly email for {provider_id}: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# Legacy: Follow-Up Email (kept for backward compatibility)
# =============================================================================

FOLLOW_UP_EMAIL_SUBJECT = "Following Up on Your TMS Therapy Inquiry"
FOLLOW_UP_EMAIL_FROM = "support@tmsinstitute.co"


def build_follow_up_email(lead_data: Dict[str, Any]) -> str:
    """Build the standard follow-up email (legacy, used by 6-hour cycle)."""
    first_name = lead_data.get("first_name", "").strip() or "there"

    body_html = f"""
{email_divider()}

{_heading(f"Hi {first_name},")}

{_paragraph("I hope this message finds you well. I wanted to follow up on your recent inquiry about TMS therapy.")}

{_paragraph("We understand that taking the first step toward treatment can feel overwhelming, and we're here to support you every step of the way.")}

{_paragraph('If you have any questions about TMS therapy or would like to schedule a consultation, please do not hesitate to reach out. You can call us at <a href="tel:4806683599" style="color: #1A1A1A; font-weight: bold; text-decoration: none;">(480) 668-3599</a>.')}

{_paragraph("We look forward to hearing from you.")}

{_signoff('Warm regards,<br><strong>TMS Institute of Arizona</strong><br><a href="tel:4806683599" style="color: #1A1A1A; font-weight: bold; text-decoration: none;">(480) 668-3599</a>')}
"""

    return wrap_in_email_layout(
        title="Following Up on Your TMS Therapy Inquiry",
        body_html=body_html,
    )


def send_follow_up_email(lead_data: Dict[str, Any]) -> Dict[str, Any]:
    """Build and send the standard follow-up email."""
    email = lead_data.get("email", "")
    first_name = lead_data.get("first_name", "")
    lead_id = lead_data.get("lead_id", "unknown")

    if not email:
        return {"success": False, "error": "No email address provided"}

    html_content = build_follow_up_email(lead_data)

    text_content = f"""Hi {first_name or 'there'},

I hope this message finds you well. I wanted to follow up on your recent inquiry about TMS therapy.

We understand that taking the first step toward treatment can feel overwhelming, and we're here to support you every step of the way.

If you have any questions or would like to schedule a consultation, call us at (480) 668-3599.

Warm regards,
TMS Institute of Arizona
(480) 668-3599

---
{CLINIC_NAME}
{CLINIC_ADDRESS}
(480) 668-3599 | {CLINIC_EMAIL} | {CLINIC_WEBSITE}"""

    try:
        from .paubox_email_service import send_email_via_paubox
        result = send_email_via_paubox(to_email=email, subject=FOLLOW_UP_EMAIL_SUBJECT, html_content=html_content, text_content=text_content, lead_id=lead_id)
        if result.get("success"):
            logger.info(f"Follow-up email sent for lead {lead_id}")
        return result
    except Exception as e:
        logger.error(f"Exception sending follow-up for {lead_id}: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# Legacy: Not Interested Follow-Up Email
# =============================================================================

NOT_INTERESTED_FOLLOW_UP_EMAIL_SUBJECT = "Checking In \u2014 TMS Institute of Arizona"
NOT_INTERESTED_FOLLOW_UP_EMAIL_FROM = "support@tmsinstitute.co"


def build_not_interested_follow_up_email(lead_data: Dict[str, Any]) -> str:
    """Build the softer not-interested follow-up email."""
    first_name = lead_data.get("first_name", "").strip() or "there"

    body_html = f"""
{email_divider()}

{_heading(f"Hi {first_name},")}

{_paragraph("We just wanted to check in and see how you're doing. We completely understand that TMS therapy may not have felt right for you at the time &mdash; and that's perfectly okay.")}

{_paragraph("If anything has changed, or if you simply have questions about how TMS works, we're always here to help &mdash; no pressure at all.")}

{_paragraph('You can reach us anytime at <a href="tel:4806683599" style="color: #1A1A1A; font-weight: bold; text-decoration: none;">(480) 668-3599</a>. We would love to hear from you whenever you are ready.')}

{_signoff('Wishing you well,<br><strong>TMS Institute of Arizona</strong><br><a href="tel:4806683599" style="color: #1A1A1A; font-weight: bold; text-decoration: none;">(480) 668-3599</a>')}
"""

    return wrap_in_email_layout(
        title="Checking In \u2014 TMS Institute of Arizona",
        body_html=body_html,
    )


def send_not_interested_follow_up_email(lead_data: Dict[str, Any]) -> Dict[str, Any]:
    """Build and send the not-interested follow-up email."""
    email = lead_data.get("email", "")
    first_name = lead_data.get("first_name", "")
    lead_id = lead_data.get("lead_id", "unknown")

    if not email:
        return {"success": False, "error": "No email address provided"}

    html_content = build_not_interested_follow_up_email(lead_data)

    text_content = f"""Hi {first_name or 'there'},

We just wanted to check in and see how you're doing. We completely understand that TMS therapy may not have felt right for you at the time - and that's perfectly okay.

If anything has changed, or if you simply have questions about how TMS works, we're always here to help.

You can reach us anytime at (480) 668-3599.

Wishing you well,
TMS Institute of Arizona
(480) 668-3599

---
{CLINIC_NAME}
{CLINIC_ADDRESS}
(480) 668-3599 | {CLINIC_EMAIL} | {CLINIC_WEBSITE}"""

    try:
        from .paubox_email_service import send_email_via_paubox
        result = send_email_via_paubox(to_email=email, subject=NOT_INTERESTED_FOLLOW_UP_EMAIL_SUBJECT, html_content=html_content, text_content=text_content, lead_id=lead_id)
        if result.get("success"):
            logger.info(f"Not-interested follow-up email sent for lead {lead_id}")
        return result
    except Exception as e:
        logger.error(f"Exception sending not-interested follow-up for {lead_id}: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# Unified Sending Function (backward compat alias)
# =============================================================================

EMAIL_SUBJECT = LEAD_CONFIRMATION_SUBJECT
EMAIL_FROM = "support@tmsinstitute.co"
