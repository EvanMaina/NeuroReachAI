-- Migration 030: Post-Consultation Treatment decision
-- After a consultation is marked complete the lead now surfaces in the
-- Post-Consultation queue until the coordinator records whether the patient
-- will be doing treatment (i.e. whether a Motor Threshold appointment will be
-- scheduled).
--
--   treatment_decision values (application-enforced, not a DB enum):
--     'yes' — patient is moving forward with treatment; lead stays in
--             Post-Consultation ("Awaiting MT") until the MT appointment is
--             recorded, which transitions the lead to TREATMENT_STARTED.
--     'no'  — patient is not moving forward; lead keeps CONSULTATION_COMPLETE
--             and is tagged for consult→treatment conversion reporting.
--     NULL  — decision pending (lead shows in Post-Consultation queue).

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS treatment_decision VARCHAR(10);

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS treatment_decision_at TIMESTAMPTZ;

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS treatment_decided_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Optional context when treatment_decision = 'no' (e.g. insurance_denied,
-- cost, chose_other_treatment, not_a_candidate, other).
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS treatment_no_reason VARCHAR(255);

-- Motor Threshold appointment date/time, recorded when the MT appointment is
-- scheduled (transitions the lead to TREATMENT_STARTED).
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS mt_scheduled_for TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_treatment_decision
    ON leads(treatment_decision)
    WHERE treatment_decision IS NOT NULL;

-- Fast lookup of completed consults awaiting a treatment decision (the new queue arm)
CREATE INDEX IF NOT EXISTS idx_leads_treatment_pending
    ON leads(status)
    WHERE status = 'CONSULTATION_COMPLETE' AND treatment_decision IS NULL AND deleted_at IS NULL;

COMMENT ON COLUMN leads.treatment_decision IS
    'Post-consultation treatment decision: yes (MT appointment will be scheduled), no (patient not proceeding), NULL (pending).';
COMMENT ON COLUMN leads.treatment_no_reason IS
    'Optional reason when treatment_decision = no (insurance_denied, cost, chose_other_treatment, not_a_candidate, other).';
COMMENT ON COLUMN leads.mt_scheduled_for IS
    'Motor Threshold appointment datetime; set when MT is scheduled and the lead moves to TREATMENT_STARTED.';
