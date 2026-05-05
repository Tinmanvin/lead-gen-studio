# Indeed Pipeline Rebuild — Full Build Plan
# Date: 2026-05-05

## Context
Full rebuild of the Indeed Hijacker pipeline. Agreed spec from extended planning session with Fabio.
Read this file at session start to know exactly what to build.

---

## What We're Building

Scrapes job boards for companies hiring roles AI can replace, enriches with company website + email,
generates personalised outreach email, routes through Smartlead for sending.

**The logical flow:**
SCRAPE (6pm UTC) → ENRICH (9pm UTC) → UI REVIEW (9am BKK) → APPROVE → SEND via Smartlead

---

## File-by-File Changes

### 1. `src/trigger/scrapers/indeed-hijacker.ts`
- UK boards: remove city loops entirely — search nationwide (no location param or "United Kingdom")
- AU boards: keep 5 cities as-is (Sydney, Melbourne, Brisbane, Perth, Adelaide)
- No other changes to scraper logic

### 2. `src/trigger/orchestrators/indeed-hijacker-orchestrator.ts`
- Scrape cron: `0 3 * * *` → `0 18 * * *` (6pm UTC = 1am BKK)
- Enrich cron: `0 7 * * *` → `0 21 * * *` (9pm UTC = 4am BKK)
- Enrichment cap: 200 → 500
- UK board loops: switch from per-city to single nationwide call per search term
- Social category: keep skipped

### 3. `src/trigger/enrichment/indeed-enrichment.ts` — MAJOR REWRITE

**Website search API stack (in order):**
1. Brave Search API (primary — 2,000/month free)
2. Tavily (fallback — 1,000/month free)
3. Exa (fallback — free tier)
- If all fail: skip enrichment (no website found)

**Contact page crawl (email finding):**
1. Jina AI Reader ONLY — `https://r.jina.ai/{url}` — free, no key, no rate limit
   - Tries: /contact, /contact-us, /about, homepage
   - Extracts email with existing regex + preference logic (info@, contact@, hello@)
2. Last resort fallback: `info@{domain}` (domain extracted from website URL)

**Cross-contamination dedup:**
- Before enriching, check if company_name or website domain exists in `leads` table
- If found: skip this job (don't enrich, don't email)
- Simple single DB query, negligible overhead

**Icebreaker generation (NEW):**
- Claude Haiku generates 1-2 lines ONLY (not the full email)
- Uses job record data only — NO external API calls needed:
  - company_name, job_title, hours_since_posted, repost_count, location
- Example outputs:
  - Normal: "Noticed {{company}} has been searching for a {{job_title}} in {{location}} — thought this might be well timed."
  - Repost: "Saw you've reposted the {{job_title}} role {{repost_count}} times now — clearly finding the right fit is taking longer than expected."
- Haiku prompt: pass job data, ask for 1-2 line personalised opener, nothing else

**Template system (CHANGED from AI-generated to pre-written):**
- `body_prompt` column now stores the PRE-WRITTEN email body template (not a Claude prompt)
- Template variables: `{{icebreaker}}`, `{{company}}`, `{{job_title}}`, `{{pricing_note}}`
- Final email = icebreaker (Claude generated) + pre-written body (from DB template)
- Subject: resolved from `subject_template` as before

**Status logic (unchanged):**
- Email found + email generated → status = 'queued'
- No email found → status = 'found' (invisible in UI)

### 4. `src/lib/smartlead.ts`
- Campaign creation: add Day 3 + Day 7 follow-up sequences
  - seq 1 (Day 0): main email with {{custom_subject}} / {{custom_body}}
  - seq 2 (Day 3): short bump — placeholder copy (Fabio/Smartlead AI to fill)
  - seq 3 (Day 7): final touch — placeholder copy (Fabio/Smartlead AI to fill)
- Sending window: 7am–9pm UTC, Mon–Fri
- Daily cap in campaign scheduler: 200/day

### 5. `src/trigger/outreach/indeed-send-orchestrator.ts`
- Daily cap constant: 270 → 200

### 6. `src/components/IndeedScreen.tsx`
- "Send Queued" button: currently calls `supabase.functions.invoke('send-queued-emails')` (Gmail SMTP)
- Change to: trigger Smartlead orchestrator via `trigger('indeed-send-orchestrator')`
- Remove all Gmail polling/send state logic, replace with standard trigger state pattern

### 7. Database migrations (check if tables exist first)
Tables needed: `indeed_jobs`, `indeed_templates`, `indeed_settings`, `email_accounts`
- If missing: create them
- Seed `indeed_templates` with 6 placeholder rows (one per active category):
  receptionist, intake_coordinator, live_chat, sdr, admin, after_hours
- Placeholder body uses {{icebreaker}}, {{company}}, {{job_title}}, {{pricing_note}}
- Fabio edits these via Config panel after build

---

## Environment Variables (Trigger.dev — Production)

New keys needed:
- `LINKUP_API_KEY` — Linkup (primary search — finding company websites) ✅ added by Fabio
- `TAVILY_API_KEY` — fallback search ✅ added by Fabio

Dropped (do not use):
- `BRAVE_API_KEY` — dropped
- `GOOGLE_CSE_API_KEY` — dropped (CSE useless without "search entire web")
- `GOOGLE_CSE_CX` — dropped

Already should exist (verify):
- `EXA_API_KEY`
- `SMARTLEAD_API_KEY`
- `ANTHROPIC_API_KEY`

Jina AI: no key needed (plain HTTP GET to r.jina.ai)

## Search Stack (final agreed)
SEARCH (find company website):
  1. Linkup API (primary — paid, good coverage)
  2. Tavily (fallback — 1,000/month free)
  3. Exa (fallback — free tier)

CRAWL (extract email from website):
  1. Jina AI Reader — r.jina.ai (free, unlimited, primary)
  2. info@{domain} guess (last resort fallback)

---

## Manual Steps for Fabio AFTER Build

1. Sign up for Brave Search API at `api.search.brave.com`, add `BRAVE_API_KEY` to Trigger.dev
2. In Smartlead UI: open "Atlas AI — Indeed Pipeline" campaign → assign all 12 mailboxes
3. In Smartlead UI: pause "Lead Gen Studio - Run 1" campaign (preserve daily limit for Indeed)
4. In Lead Gen Studio Config panel (Indeed tab → gear icon): edit the 6 placeholder templates
5. Run hijacker manually once to test ("Run Hijacker" button in UI)

---

## What Is NOT Changing

- Scraper filtering logic (relevance filter, agency filter, repost detection) — keep as-is
- UI components (IndeedScreen, IndeedConfigPanel) — minimal changes only
- Supabase edge function send-queued-emails — kept but no longer used by UI
- indeed_jobs table schema — no changes
- Status flow: found → queued → approved → sent
- AU city list

---

## Build Order

1. Migrations / DB check first (foundation)
2. indeed-hijacker.ts (UK nationwide)
3. indeed-hijacker-orchestrator.ts (timing + cap)
4. indeed-enrichment.ts (full rewrite — most complex)
5. smartlead.ts (add FU sequences + sending window)
6. indeed-send-orchestrator.ts (cap update)
7. IndeedScreen.tsx (wire to Smartlead)
8. Deploy to Trigger.dev
9. Test run
