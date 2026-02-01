-- =============================================================================
-- 009_user_management.sql
-- User accounts, roles, and authentication support
-- =============================================================================

-- User role enum
DO $$
BEGIN
    CREATE TYPE user_role AS ENUM ('administrator', 'coordinator', 'specialist');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- User status enum
DO $$
BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'pending');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email                VARCHAR(255) NOT NULL UNIQUE,
    password_hash        VARCHAR(255) NOT NULL,
    first_name           VARCHAR(100) NOT NULL,
    last_name            VARCHAR(100) NOT NULL,
    role                 user_role   NOT NULL DEFAULT 'coordinator',
    status               user_status NOT NULL DEFAULT 'pending',
    must_change_password BOOLEAN     NOT NULL DEFAULT TRUE,
    last_login           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- User preferences table (notification settings, etc.)
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id                     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
    notify_new_lead             BOOLEAN     NOT NULL DEFAULT TRUE,
    notify_hot_lead             BOOLEAN     NOT NULL DEFAULT TRUE,
    notify_daily_summary        BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clinic settings table (key-value store for site settings)
CREATE TABLE IF NOT EXISTS clinic_settings (
    key        VARCHAR(100) NOT NULL PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed default clinic settings
INSERT INTO clinic_settings (key, value) VALUES
    ('clinic_name',    'TMS Institute of Arizona'),
    ('clinic_address', '5150 N 16th St, Suite A-114, Phoenix, AZ 85016'),
    ('clinic_phone',   '(480) 668-3599'),
    ('clinic_email',   'support@tmsinstitute.co')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Seed Default Admin User
-- =============================================================================
-- Password: "Admin@12345" hashed with bcrypt
-- IMPORTANT: Admin MUST change this password on first login (must_change_password = TRUE)
-- Email: admin@clinic.com
-- Generate a new hash in Python: 
--   import bcrypt; bcrypt.hashpw(b"Admin@12345", bcrypt.gensalt()).decode()
--
-- After system init, run the seed_admin.py script to ensure proper password:
--   docker exec neuroreach-backend python /app/scripts/seed_admin.py --reset

INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    status,
    must_change_password
) VALUES (
    gen_random_uuid(),
    'admin@clinic.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.BWSP4e.m7M0yAi',
    'Clinic',
    'Administrator',
    'administrator',
    'active',
    TRUE
) ON CONFLICT (email) DO NOTHING;
