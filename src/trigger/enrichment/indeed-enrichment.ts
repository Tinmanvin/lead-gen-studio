/**
 * Indeed Enrichment — Website + Email + Outreach Generator
 * For a given indeed_jobs record:
 * 1. Finds the company website via Exa search
 * 2. Finds a contact email via Exa crawl + common patterns
 * 3. Generates a personalised outreach email via Claude Haiku
 * Updates: company_website, dm_email, email_found, template_used,
 *          email_subject, email_body, status ('queued' if email found)
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../../lib/supabase-server.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────
// Template loader — reads from indeed_templates table
// Falls back to a generic prompt if category not found
// ─────────────────────────────────────────────

interface DBTemplate {
  category: string;
  subject_template: string;
  body_prompt: string;
  price_au: string;
  price_uk: string;
  active: boolean;
}

let _templateCache: DBTemplate[] | null = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function loadTemplates(): Promise<DBTemplate[]> {
  const now = Date.now();
  if (_templateCache && now - _cacheTs < CACHE_TTL_MS) return _templateCache;

  const { data, error } = await supabase
    .from("indeed_templates")
    .select("category, subject_template, body_prompt, price_au, price_uk, active")
    .eq("active", true);

  if (error || !data?.length) {
    logger.warn("Could not load templates from DB, using fallback");
    return [];
  }

  _templateCache = data as DBTemplate[];
  _cacheTs = now;
  return _templateCache;
}

function resolveSubject(template: string, company: string, jobTitle: string): string {
  return template
    .replace(/\{\{company\}\}/g, company)
    .replace(/\{\{job_title\}\}/g, jobTitle);
}

// ─────────────────────────────────────────────
// Exa helpers
// ─────────────────────────────────────────────

interface ExaSearchResult {
  url: string;
  title?: string;
  text?: string;
}

async function findWebsiteWithExa(
  companyName: string,
  location: string | null
): Promise<string | null> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return null;

  const query = location
    ? `${companyName} ${location} official website contact`
    : `${companyName} official website contact`;

  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        query,
        numResults: 5,
        contents: { text: { maxCharacters: 500 } },
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { results: ExaSearchResult[] };

    // Find the most likely company website (not a jobs board)
    const junk = ["indeed", "seek", "reed", "totaljobs", "linkedin", "glassdoor", "facebook", "yelp", "yellowpages", "truelocal", "wikipedia", "gov.au", "gov.uk"];
    const bestResult = (data.results ?? []).find((r) => {
      const domain = r.url.toLowerCase();
      return !junk.some((j) => domain.includes(j));
    });

    return bestResult?.url ?? null;
  } catch (err) {
    logger.warn("Exa website search failed", { company: companyName, error: String(err) });
    return null;
  }
}

async function findEmailWithExa(website: string): Promise<string | null> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return null;

  // Try to get the contact page
  const base = new URL(website).origin;
  const contactUrls = [`${base}/contact`, `${base}/contact-us`, `${base}/about`, website];

  try {
    const res = await fetch("https://api.exa.ai/contents", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        urls: contactUrls.slice(0, 3),
        text: { maxCharacters: 2000 },
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { results: ExaSearchResult[] };
    const allText = (data.results ?? []).map((r) => r.text ?? "").join("\n");

    return extractEmailFromText(allText);
  } catch (err) {
    logger.warn("Exa email crawl failed", { website, error: String(err) });
    return null;
  }
}

function extractEmailFromText(text: string): string | null {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const matches = text.match(emailRegex) ?? [];

  // Filter out likely non-contact emails
  const skip = ["noreply", "no-reply", "donotreply", "example.com", "sentry", "png", "jpg"];
  const candidates = matches.filter((e) => !skip.some((s) => e.toLowerCase().includes(s)));

  if (!candidates.length) return null;

  // Prefer contact/info/hello/owner-style emails
  const preferred = candidates.find((e) => {
    const local = e.split("@")[0].toLowerCase();
    return ["contact", "info", "hello", "enquir", "admin", "office"].some((p) =>
      local.startsWith(p)
    );
  });

  return preferred ?? candidates[0];
}

function tryCommonEmailPatterns(domain: string): string[] {
  return [
    `info@${domain}`,
    `hello@${domain}`,
    `contact@${domain}`,
    `admin@${domain}`,
    `enquiries@${domain}`,
  ];
}

// ─────────────────────────────────────────────
// Email generation
// ─────────────────────────────────────────────

async function generateOutreachEmail(
  companyName: string,
  jobTitle: string,
  category: string,
  country: string
): Promise<{ subject: string; body: string; template: string } | null> {
  const templates = await loadTemplates();
  const dbTemplate = templates.find((t) => t.category === category)
    ?? templates.find((t) => t.category === "receptionist");

  if (!dbTemplate) {
    logger.warn("No template found for category", { category });
    return null;
  }

  const pricingNote = country === "AU" ? dbTemplate.price_au : dbTemplate.price_uk;
  const fallbackSubject = resolveSubject(dbTemplate.subject_template, companyName, jobTitle);

  const prompt = dbTemplate.body_prompt
    .replace(/\{\{job_title\}\}/g, jobTitle)
    .replace(/\{\{pricing_note\}\}/g, pricingNote)
    .replace(/\{\{company\}\}/g, companyName)
    .concat(`\n\nCompany: ${companyName}\nJob posted: ${jobTitle}\n\nWrite the email now.`);

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    if (!text) return null;

    // Extract subject if included
    const lines = text.split("\n");
    const subjectLine = lines.find((l) => l.toLowerCase().startsWith("subject:"));
    const subject = subjectLine
      ? subjectLine.replace(/^subject:\s*/i, "").trim()
      : fallbackSubject;
    const body = subjectLine
      ? lines.filter((l) => l !== subjectLine).join("\n").trim()
      : text;

    return { subject, body, template: category };
  } catch (err) {
    logger.warn("Email generation failed", { company: companyName, error: String(err) });
    return null;
  }
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

    // Step 1: Find website
    let website = job.company_website as string | null;
    if (!website) {
      website = await findWebsiteWithExa(job.company_name, job.location);
    }

    // Step 2: Find email
    let email: string | null = null;
    if (website) {
      email = await findEmailWithExa(website);

      // Note: common pattern fallback intentionally NOT used for email_found
      // Sending to unverified pattern addresses causes hard bounces and hurts deliverability
    }

    // Step 3: Generate email if we have a contact point
    let emailGen: { subject: string; body: string; template: string } | null = null;
    if (email || website) {
      emailGen = await generateOutreachEmail(
        job.company_name,
        job.job_title,
        job.job_category ?? "receptionist",
        job.country ?? "AU"
      );
    }

    const emailFound = Boolean(email);
    const newStatus = emailFound && emailGen ? "queued" : "found";

    await supabase
      .from("indeed_jobs")
      .update({
        company_website: website ?? null,
        dm_email: email ?? null,
        email_found: emailFound,
        template_used: emailGen?.template ?? null,
        email_subject: emailGen?.subject ?? null,
        email_body: emailGen?.body ?? null,
        status: newStatus,
      })
      .eq("id", jobId);

    logger.log(
      `${job.company_name}: email_found=${emailFound}, status=${newStatus}`
    );

    return { success: true, jobId, emailFound, status: newStatus };
  },
});
