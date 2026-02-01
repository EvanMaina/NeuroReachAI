-- =============================================================================
-- 018_primary_admin_role.sql
-- Add primary_admin to the user_role enum
-- =============================================================================

-- Add the primary_admin value to the existing user_role enum.
-- This is idempotent: if the value already exists, the DO block catches the error.
DO $$
BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'primary_admin' BEFORE 'administrator';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
