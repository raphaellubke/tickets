-- Add has_shirts column to forms table
ALTER TABLE forms ADD COLUMN IF NOT EXISTS has_shirts BOOLEAN DEFAULT FALSE;
