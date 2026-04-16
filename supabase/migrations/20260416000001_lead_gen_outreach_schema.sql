-- ============================================================
-- Lead Gen + Outreach Schema Migration
-- 2026-04-16
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. LEADS TABLE — add missing columns
-- ────────────────────────────────────────────────────────────

-- Contact fields (may be written by scrapers via RawLead)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dm_title TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dm_facebook_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS listed_since TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Tech scan fields (written by signal-enrichment)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_booking_link BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_tracking_pixel BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_wordpress BOOLEAN DEFAULT false;

-- Exa research + icebreaker (written by exa-research job)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS exa_research TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS icebreaker TEXT;

-- Outreach copy (written by exa-research job — extended in this build)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_subject TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_body TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS linkedin_msg TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_msg TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS facebook_msg TEXT;

-- ────────────────────────────────────────────────────────────
-- 2. LEAD_SCORES TABLE — confirm applicable_services exists
-- ────────────────────────────────────────────────────────────
-- These columns are written by lead-scorer.ts upsert.
-- Adding IF NOT EXISTS is safe — won't break existing data.
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS applicable_services TEXT[];
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS touchpoints_available TEXT[];
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS composite_score NUMERIC;
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS has_lead_reactivation BOOLEAN DEFAULT false;
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS has_speed_to_lead BOOLEAN DEFAULT false;
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS has_website_widget BOOLEAN DEFAULT false;
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS has_website_rebuild BOOLEAN DEFAULT false;
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS has_new_website BOOLEAN DEFAULT false;
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS has_follow_up_automation BOOLEAN DEFAULT false;
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS has_after_hours_automation BOOLEAN DEFAULT false;
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────
-- 3. LEAD_SIGNALS TABLE — create if not exists
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  evidence TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_signals_lead_id_idx ON lead_signals(lead_id);

-- ────────────────────────────────────────────────────────────
-- 4. SETTINGS TABLE — source toggles
-- ────────────────────────────────────────────────────────────
-- settings table is key-value: (user_id, key, value)
-- Insert defaults for all scraper source toggles.
-- ON CONFLICT DO NOTHING — safe to re-run.

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO settings (user_id, key, value) VALUES
      (v_user_id, 'source_google_maps_au',  'true'),
      (v_user_id, 'source_google_maps_uk',  'true'),
      (v_user_id, 'source_ahpra',           'true'),
      (v_user_id, 'source_mfaa',            'true'),
      (v_user_id, 'source_law_society_au',  'true'),
      (v_user_id, 'source_hipages',         'true'),
      (v_user_id, 'source_reia',            'true'),
      (v_user_id, 'source_companies_house', 'true'),
      (v_user_id, 'source_fca_register',    'true'),
      (v_user_id, 'source_law_society_uk',  'true'),
      (v_user_id, 'source_yell',            'true'),
      (v_user_id, 'source_checkatrade',     'true'),
      (v_user_id, 'source_trustpilot',      'true'),
      (v_user_id, 'source_opencorporates',  'true')
    ON CONFLICT (user_id, key) DO NOTHING;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 5. OUTREACH_TEMPLATES TABLE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  demo_type TEXT NOT NULL CHECK (demo_type IN ('email_only', 'widget', 'redesign', 'new_site', 'compound')),
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_prompt TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_templates_user_id_idx ON outreach_templates(user_id);
CREATE INDEX IF NOT EXISTS outreach_templates_demo_type_idx ON outreach_templates(demo_type);

-- Seed default templates (one per demo_type)
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  IF v_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM outreach_templates WHERE user_id = v_user_id LIMIT 1
  ) THEN
    INSERT INTO outreach_templates (user_id, demo_type, name, subject_template, body_prompt) VALUES
    (
      v_user_id,
      'email_only',
      'Plain Outreach',
      'Quick question about {{company_name}}',
      'Write a 3-sentence cold email to {{dm_name}} at {{company_name}}, a {{niche}} business. Start with this icebreaker: "{{icebreaker}}". Mention that we help {{niche}} businesses get more clients using AI. End with a soft ask for a 10-minute call. No pitch, no fluff. Sound human.'
    ),
    (
      v_user_id,
      'widget',
      'Website Widget Pitch',
      'Your website is missing something, {{dm_name}}',
      'Write a cold email to {{dm_name}} at {{company_name}}. Start with: "{{icebreaker}}". Tell them their website is getting visitors but not capturing them — we built a quick demo of what an AI chat widget would look like on their site. Include: "I put together a quick demo for you: {{demo_url}}". Keep it under 100 words. No hard sell.'
    ),
    (
      v_user_id,
      'redesign',
      'Website Redesign Pitch',
      'I rebuilt {{company_name}}''s website — want to see?',
      'Write a cold email to {{dm_name}} at {{company_name}}. Start with: "{{icebreaker}}". Tell them we noticed their site could use a refresh and took 20 minutes to show them what it could look like in 2026. Include the demo link: {{demo_url}}. Under 80 words. Confident but not pushy.'
    ),
    (
      v_user_id,
      'new_site',
      'New Website Pitch',
      'Built something for {{company_name}}',
      'Write a cold email to {{dm_name}} at {{company_name}}, who currently has no website. Start with: "{{icebreaker}}". Tell them we built them a quick demo site so they can see what it would look like to have a proper online presence. Include: {{demo_url}}. Under 80 words. Friendly and direct.'
    ),
    (
      v_user_id,
      'compound',
      'Compound Demo Pitch',
      'Rebuilt your site + added AI — here''s the demo',
      'Write a cold email to {{dm_name}} at {{company_name}}. Start with: "{{icebreaker}}". Tell them we noticed two things: their site could use a refresh AND they have no AI chat widget capturing leads 24/7. We built a combined demo showing both. Include: {{demo_url}}. Under 100 words. Direct, no waffle.'
    );
  END IF;
END $$;
