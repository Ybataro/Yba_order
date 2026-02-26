-- Add can_popup column to user_pins for per-person calendar popup control
ALTER TABLE user_pins ADD COLUMN IF NOT EXISTS can_popup BOOLEAN DEFAULT false;
