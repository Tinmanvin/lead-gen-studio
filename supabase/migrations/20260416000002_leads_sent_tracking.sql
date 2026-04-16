-- Add outreach send tracking columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sent_via TEXT;
