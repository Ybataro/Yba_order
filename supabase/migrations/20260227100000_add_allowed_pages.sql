-- Add allowed_pages column to user_pins for per-user page visibility control
-- NULL = use default based on employment_type, non-NULL = custom override
ALTER TABLE user_pins ADD COLUMN IF NOT EXISTS allowed_pages TEXT[] DEFAULT NULL;
