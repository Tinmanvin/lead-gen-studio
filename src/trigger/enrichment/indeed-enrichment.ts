/**
 * Indeed Enrichment
 *
 * For each indeed_jobs record (status='found'):
 * 1. Cross-contamination check — skip if company already in leads table
 * 2. Find company website:
 *    a. Jina reads the job listing page (free, might link to company site)
 *    b. Linkup API search (primary paid search)
 *    c. Tavily search (fallback)
 *    d. Exa search (last resort)
 * 3. Find contact email:
 *    a. Jina reads /contact, /contact-us, /about pages (free, unlimited)
 *    b. info@{domain} fallback
 * 4. Generate 1-2 line icebreaker via Claude Haiku (job data only, no extra API call)
 * 5. Build email from pre-written template + icebreaker
 * 6. Update DB record
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../../lib/supabase-server.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────
// Template loader
// ─────────────────────────────────────────────

interface DBTemplate {
  category: string;
  subject_template: string;
  body_prompt: string; // now stores pre-written template body, not a Claude prompt
  price_au: string;
  price_uk: string;
  active: boolean;
}

let _templateCache: DBTemplate[] | null = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadTemplates(): Promise<DBTemplate[]> {
  const now = Date.now();
  if (_templateCache && now - _cacheTs < CACHE_TTL_MS) return _templateCache;

  const { data, error } = await supabase
    .from("indeed_templates")
    .select("category, subject_template, body_prompt, price_au, price_uk, active")
    .eq("active", true);

  if (error || !data?.length) {
    logger.warn("Could not load templates from DB");
    return [];
  }

  _templateCache = data as DBTemplate[];
  _cacheTs = now;
  return _templateCache;
}

// ─────────────────────────────────────────────
// Cross-contamination check
// Skip if this company is already in the main leads pipeline
// ─────────────────────────────────────────────

async function isAlreadyInLeads(companyName: string, website: string | null): Promise<boolean> {
  try {
    const domain = website ? extractDomain(website) : null;

    const { count: nameCount } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .ilike("company_name", companyName);

    if ((nameCount ?? 0) > 0) return true;

    if (domain) {
      const { count: domainCount } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .ilike("website", `%${domain}%`);

      if ((domainCount ?? 0) > 0) return true;
    }

    return false;
  } catch {
    return false; // on error, don't block — proceed
  }
}

// ─────────────────────────────────────────────
// URL / domain helpers
// ─────────────────────────────────────────────

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const JOB_BOARD_DOMAINS = [
  "indeed", "seek", "reed", "totaljobs", "linkedin", "glassdoor",
  "facebook", "yelp", "yellowpages", "truelocal", "wikipedia",
  "gov.au", "gov.uk", "twitter", "instagram", "google",
];

function isJobBoardUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return JOB_BOARD_DOMAINS.some((d) => lower.includes(d));
}

function pickBestUrl(urls: string[]): string | null {
  return urls.find((u) => u && !isJobBoardUrl(u)) ?? null;
}

// ─────────────────────────────────────────────
// Step 1a — Jina reads the job listing page
// Free, no rate limit — might contain employer website link
// ─────────────────────────────────────────────

async function findWebsiteFromJobListing(sourceUrl: string | null): Promise<string | null> {
  if (!sourceUrl) return null;

  try {
    const res = await fetch(`https://r.jina.ai/${sourceUrl}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    const text = await res.text();

    // Extract all URLs from the page text
    const urlRegex = /https?:\/\/[^\s"'<>)]+/g;
    const matches = [...text.matchAll(urlRegex)].map((m) => m[0]);

    return pickBestUrl(matches);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Step 1b — Linkup API search (primary)
// ─────────────────────────────────────────────

async function searchLinkup(query: string): Promise<string | null> {
  const apiKey = process.env.LINKUP_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.linkup.so/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        q: query,
        depth: "standard",
        outputType: "searchResults",
        numResults: 5,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ url?: string; name?: string }> };
    const urls = (data.results ?? []).map((r) => r.url ?? "").filter(Boolean);
    return pickBestUrl(urls);
  } catch (err) {
    logger.warn("Linkup search failed", { error: String(err) });
    return null;
  }
}

// ─────────────────────────────────────────────
// Step 1c — Tavily search (fallback)
// ─────────────────────────────────────────────

async function searchTavily(query: string): Promise<string | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 5,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ url?: string }> };
    const urls = (data.results ?? []).map((r) => r.url ?? "").filter(Boolean);
    return pickBestUrl(urls);
  } catch (err) {
    logger.warn("Tavily search failed", { error: String(err) });
    return null;
  }
}

// ─────────────────────────────────────────────
// Step 1d — Exa search (last resort)
// ─────────────────────────────────────────────

async function searchExa(query: string): Promise<string | null> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ query, numResults: 5 }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ url?: string }> };
    const urls = (data.results ?? []).map((r) => r.url ?? "").filter(Boolean);
    return pickBestUrl(urls);
  } catch (err) {
    logger.warn("Exa search failed", { error: String(err) });
    return null;
  }
}

// ─────────────────────────────────────────────
// Find company website — tries all sources in order
// ─────────────────────────────────────────────

async function findCompanyWebsite(
  companyName: string,
  location: string | null,
  sourceUrl: string | null
): Promise<string | null> {
  // 1. Free: try job listing page first
  const fromListing = await findWebsiteFromJobListing(sourceUrl);
  if (fromListing) {
    logger.log(`Website from job listing: ${fromListing}`);
    return fromListing;
  }

  const query = location
    ? `"${companyName}" ${location} official website contact`
    : `"${companyName}" official website contact`;

  // 2. Linkup (primary paid search)
  const fromLinkup = await searchLinkup(query);
  if (fromLinkup) {
    logger.log(`Website from Linkup: ${fromLinkup}`);
    return fromLinkup;
  }

  // 3. Tavily (fallback)
  const fromTavily = await searchTavily(query);
  if (fromTavily) {
    logger.log(`Website from Tavily: ${fromTavily}`);
    return fromTavily;
  }

  // 4. Exa (last resort)
  const fromExa = await searchExa(query);
  if (fromExa) {
    logger.log(`Website from Exa: ${fromExa}`);
    return fromExa;
  }

  return null;
}

// ─────────────────────────────────────────────
// Find email — Jina crawls contact pages, then info@ fallback
// ─────────────────────────────────────────────

function extractEmailFromText(text: string): string | null {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const matches = text.match(emailRegex) ?? [];

  const skip = ["noreply", "no-reply", "donotreply", "example.com", "sentry", ".png", ".jpg"];
  const candidates = matches.filter((e) => !skip.some((s) => e.toLowerCase().includes(s)));

  if (!candidates.length) return null;

  const preferred = candidates.find((e) => {
    const local = e.split("@")[0].toLowerCase();
    return ["contact", "info", "hello", "enquir", "admin", "office"].some((p) =>
      local.startsWith(p)
    );
  });

  return preferred ?? candidates[0];
}

async function findEmailWithJina(website: string): Promise<string | null> {
  const base = new URL(website).origin;
  const contactUrls = [`${base}/contact`, `${base}/contact-us`, `${base}/about`, base];

  for (const url of contactUrls) {
    try {
      const res = await fetch(`https://r.jina.ai/${url}`, {
        headers: { Accept: "text/plain" },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) continue;
      const text = await res.text();
      const email = extractEmailFromText(text);
      if (email) return email;
    } catch {
      continue;
    }
  }

  return null;
}

async function findContactEmail(website: string): Promise<string | null> {
  // Primary: Jina crawl
  const fromJina = await findEmailWithJina(website);
  if (fromJina) return fromJina;

  // Last resort: guess info@ from domain
  const domain = extractDomain(website);
  if (domain) {
    logger.log(`Email fallback: info@${domain}`);
    return `info@${domain}`;
  }

  return null;
}

// ─────────────────────────────────────────────
// Icebreaker generation
// Claude Haiku — 1-2 lines from job data only, no extra API calls
// ─────────────────────────────────────────────

async function generateIcebreaker(
  companyName: string,
  jobTitle: string,
  location: string | null,
  hoursSincePosted: number | null,
  repostCount: number
): Promise<string> {
  const daysSincePosted = hoursSincePosted ? Math.round(hoursSincePosted / 24) : null;
  const isRepost = repostCount > 1;

  let context = `Company: ${companyName}\nRole posted: ${jobTitle}`;
  if (location) context += `\nLocation: ${location}`;
  if (daysSincePosted) context += `\nDays since posted: ${daysSincePosted}`;
  if (isRepost) context += `\nTimes reposted: ${repostCount}`;

  const repostInstruction = isRepost
    ? `IMPORTANT: This role has been reposted ${repostCount} times. Your opening MUST call this out directly and conversationally — e.g. "Seen you've been trying to find a ${jobTitle} for a while now." or "Looks like finding the right ${jobTitle} has been trickier than expected." Be direct about the repeated posting without being rude.`
    : `Reference the specific role or hiring situation naturally.`;

  const prompt = `Write 1-2 sentences as the opening line of a cold email. Do not include a greeting.

Context:
${context}

Task:
${repostInstruction}

Rules:
- If posted recently (1-3 days) and NOT a repost, acknowledge the fresh search
- Direct and natural — sound like a human, not a marketer
- No hyphens, no dashes, no em dashes, no en dashes
- No "I noticed", no "I came across", no "thought this might be well timed", no filler endings
- End with a complete thought — do not trail off with a vague phrase
- Output only the 1-2 sentences, nothing else`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const text = raw.replace(/[-–—]/g, "");
    return text || `Saw ${companyName} is looking for a ${jobTitle}.`;
  } catch {
    return `Saw ${companyName} is looking for a ${jobTitle}.`;
  }
}

// ─────────────────────────────────────────────
// Salary normalisation — converts raw job board salary strings to annual
// Adzuna/Reed store annual figures as "28000–35000"
// Seek/Totaljobs store display text like "$4,000 per month" or "£28k–£32k per annum"
// ─────────────────────────────────────────────

function parseSalaryToAnnual(raw: string | null, country: string): string {
  if (!raw || raw.trim() === "") return "a competitive salary";

  const text = raw.toLowerCase();
  const isMonthly = /per month|monthly|\/month|p\.m\b/.test(text);
  const isWeekly = /per week|weekly|\/week|p\.w\b/.test(text);

  const nums = (text.match(/\d[\d,]*/g) ?? [])
    .map((s) => parseInt(s.replace(/,/g, ""), 10))
    .filter((n) => !isNaN(n) && n > 100 && n < 1_000_000);

  if (!nums.length) return "a competitive salary";

  let min = nums[0];
  let max: number | null = nums.length > 1 ? nums[1] : null;

  if (isMonthly) { min *= 12; if (max !== null) max *= 12; }
  else if (isWeekly) { min *= 52; if (max !== null) max *= 52; }

  const sym = country === "UK" ? "£" : "$";
  const fmt = (n: number) =>
    n >= 1000 ? `${sym}${Math.round(n / 1000)}k` : `${sym}${n}`;

  return max !== null && max !== min
    ? `${fmt(min)}–${fmt(max)}/yr`
    : `${fmt(min)}/yr`;
}

// ─────────────────────────────────────────────
// Niche inference — keyword-based, no API call needed
// ─────────────────────────────────────────────

function inferNiche(companyName: string, jobTitle: string): string {
  const t = `${companyName} ${jobTitle}`.toLowerCase();
  if (/dental|dentist|orthodon/.test(t)) return "dental";
  if (/medical|clinic|gp |health|hospital|physio|chiro|osteo|allied health/.test(t)) return "healthcare";
  if (/law firm|legal|solicitor|conveyancing|barrister/.test(t)) return "legal";
  if (/real estate|estate agent|letting agent|property management/.test(t)) return "real estate";
  if (/plumb|electric|hvac|mechanical|builder|construc|roofing|tradies/.test(t)) return "trades";
  if (/account|bookkeep|tax advisor|cpa\b/.test(t)) return "accounting";
  if (/veterinar|vet clinic|animal hospital/.test(t)) return "veterinary";
  if (/salon|beauty|spa|hair|nail/.test(t)) return "beauty";
  if (/restaurant|cafe|hospitality|hotel|catering/.test(t)) return "hospitality";
  if (/gym|fitness|personal train|pilates|yoga/.test(t)) return "fitness";
  if (/auto|vehicle|car dealership|mechanic/.test(t)) return "automotive";
  if (/insurance/.test(t)) return "insurance";
  return "local business";
}

// ─────────────────────────────────────────────
// Build final email from pre-written template + all tokens
// ─────────────────────────────────────────────

function buildEmail(
  template: DBTemplate,
  icebreaker: string,
  companyName: string,
  jobTitle: string,
  country: string,
  salary: string,
  niche: string
): { subject: string; body: string } {
  const pricingNote = country === "AU" ? template.price_au : template.price_uk;

  const replace = (str: string) =>
    str
      .replace(/\{\{iceBreaker\}\}/gi, icebreaker)
      .replace(/\{\{firstName\}\}/gi, "there")
      .replace(/\{\{company\}\}/gi, companyName)
      .replace(/\{\{job_title\}\}/gi, jobTitle)
      .replace(/\{\{niche\}\}/gi, niche)
      .replace(/\{\{salary\}\}/gi, salary)
      .replace(/\{\{pricing_note\}\}/gi, pricingNote);

  return { subject: replace(template.subject_template), body: replace(template.body_prompt) };
}

// ─────────────────────────────────────────────
// Task
// ─────────────────────────────────────────────

export const indeedEnrichment = schemaTask({
  id: "indeed-enrichment",
  schema: z.object({
    jobId: z.string(),
    userId: z.string().optional(),
  }),
  machine: "small-1x",
  maxDuration: 120,
  run: async (payload) => {
    const { jobId } = payload;

    const { data: job, error } = await supabase
      .from("indeed_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error || !job) {
      logger.warn("Job not found", { jobId });
      return { success: false };
    }

    if (job.status !== "found") {
      return { success: true, reason: "already_enriched" };
    }

    logger.log(`Enriching: ${job.company_name} — ${job.job_title}`);

    // Step 1: Find company website
    let website = job.company_website as string | null;
    if (!website) {
      website = await findCompanyWebsite(job.company_name, job.location, job.source_url);
    }

    if (!website) {
      await supabase.from("indeed_jobs").update({ status: "found" }).eq("id", jobId);
      logger.log(`${job.company_name}: no website found — staying in found`);
      return { success: true, jobId, emailFound: false, status: "found" };
    }

    // Step 2: Cross-contamination check (after website found so we can check domain too)
    const alreadyInLeads = await isAlreadyInLeads(job.company_name, website);
    if (alreadyInLeads) {
      await supabase.from("indeed_jobs").update({ status: "skipped" }).eq("id", jobId);
      logger.log(`${job.company_name}: already in leads table — skipped`);
      return { success: true, jobId, reason: "cross_contamination" };
    }

    // Step 3: Find contact email
    const email = await findContactEmail(website);
    const emailFound = Boolean(email);

    if (!emailFound) {
      await supabase.from("indeed_jobs").update({ company_website: website }).eq("id", jobId);
      logger.log(`${job.company_name}: website found but no email`);
      return { success: true, jobId, emailFound: false, status: "found" };
    }

    // Step 4: Generate icebreaker
    const icebreaker = await generateIcebreaker(
      job.company_name,
      job.job_title,
      job.location,
      job.hours_since_posted,
      job.repost_count ?? 1
    );

    // Step 5: Build email from pre-written template
    const templates = await loadTemplates();
    const template = templates.find((t) => t.category === job.job_category)
      ?? templates.find((t) => t.category === "receptionist");

    if (!template) {
      logger.warn("No template found", { category: job.job_category });
      await supabase.from("indeed_jobs").update({
        company_website: website,
        dm_email: email,
        email_found: true,
        status: "found",
      }).eq("id", jobId);
      return { success: true, jobId, emailFound: true, status: "found" };
    }

    const salary = parseSalaryToAnnual(job.salary as string | null, job.country ?? "AU");
    const niche = inferNiche(job.company_name, job.job_title);
    const { subject, body } = buildEmail(template, icebreaker, job.company_name, job.job_title, job.country ?? "AU", salary, niche);

    await supabase.from("indeed_jobs").update({
      company_website: website,
      dm_email: email,
      email_found: true,
      template_used: template.category,
      email_subject: subject,
      email_body: body,
      status: "queued",
    }).eq("id", jobId);

    logger.log(`${job.company_name}: enriched and queued`, { email, subject });

    return { success: true, jobId, emailFound: true, status: "queued" };
  },
});
