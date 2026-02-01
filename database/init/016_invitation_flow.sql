-- =============================================================================
-- 016_invitation_flow.sql
-- Add password_expires_at for temporary password expiry (48-hour window)
-- =============================================================================

-- Add password_expires_at column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMPTZ;

-- Set expiry for any existing pending users (48 hours from now)
UPDATE users 
SET password_expires_at = NOW() + INTERVAL '48 hours' 
WHERE must_change_password = TRUE AND password_expires_at IS NULL;
