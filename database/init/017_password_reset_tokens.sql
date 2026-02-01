-- =============================================================================
-- Migration 017: Password Reset Tokens
-- =============================================================================
-- Adds password_reset_tokens table for the Forgot Password flow.
-- Tokens are cryptographically random, hashed for storage, one-time use,
-- and expire after 1 hour.
-- =============================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Index for fast token lookup
    CONSTRAINT unique_active_token UNIQUE (token_hash)
);

-- Index for finding tokens by user (rate limiting)
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
