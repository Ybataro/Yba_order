-- Add monthly_salary column for full-time (正職) staff
ALTER TABLE staff ADD COLUMN IF NOT EXISTS monthly_salary integer DEFAULT 0;
