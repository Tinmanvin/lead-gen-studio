-- Migration: 2026-04-17 — copy_locked + preview_batch

-- 1. Add copy_locked to leads (prevents exa-research from overwriting manual edits)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS copy_locked BOOLEAN DEFAULT false;

-- 2. preview_batch — persists the 12 shared preview cards (LeadGen Preview + Outreach Mass Email)
CREATE TABLE IF NOT EXISTS preview_batch (
  id SERIAL PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  position INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS preview_batch_lead_id_key ON preview_batch(lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS preview_batch_position_key ON preview_batch(position);

-- 3. RLS — open read/write (no auth on this app)
ALTER TABLE preview_batch ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_preview_batch" ON preview_batch;
CREATE POLICY "allow_all_preview_batch" ON preview_batch USING (true) WITH CHECK (true);

-- 4. Increase daily cap to 150 per account (3 accounts × 150 = 450/day total)
UPDATE email_accounts SET daily_cap = 150 WHERE active = true;
