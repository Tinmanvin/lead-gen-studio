/**
 * Owner Contact Enrichment — Multi-Source Pipeline
 *
 * Priority chain (each step feeds the next):
 *   1. Website deep scrape  — contact/about/team pages → email + owner name
 *   2. Exa owner search     — web + LinkedIn search for owner name + email
 *   3. Exa LinkedIn search  — site:linkedin.com/in for owner profile URL
 *   4. Email pattern gen    — build variants from owner name + domain, pick best
 *   5. Facebook page scrape — public page for email/phone/owner name
 *
 * Writes: dm_email, dm_name, dm_title, dm_linkedin_url, phone
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { supabase } from "../../lib/supabase-server.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const OWNER_TITLES = [
  "owner", "co-owner", "director", "managing director", "md",
  "founder", "co-founder", "principal", "partner", "proprietor",
  "ceo", "chief executive", "gm", "general manager", "president",
];

const GENERIC_EMAIL_PREFIXES = [
  "info", "admin", "hello", "contact", "support", "office", "enquiries",
  "enquiry", "mail", "noreply", "no-reply", "team", "sales", "help",
  "service", "services", "reception", "accounts", "booking", "bookings",
  "appointments", "general", "office",
];

const CONTACT_PATHS = [
  "", "/contact", "/contact-us", "/about", "/about-us", "/team",
  "/our-team", "/meet-the-team", "/staff", "/people", "/get-in-touch",
  "/who-we-are",
];

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ─── Utilities ────────────────────────────────────────────────────────────────

function cleanUrl(website: string): string {
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return website.split("?")[0].replace(/\/$/, "");
  }
}

function extractDomain(website: string): string | null {
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function extractEmails(text: string): string[] {
  const emailRegex = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
  const found = text.match(emailRegex) ?? [];
  return [...new Set(found)].filter((e) => {
    const lower = e.toLowerCase();
    return (
      !lower.endsWith(".png") && !lower.endsWith(".jpg") &&
      !lower.endsWith(".svg") && !lower.endsWith(".js") &&
      !lower.includes("sentry") && !lower.includes("example.com") &&
      !lower.includes("yourdomain") && !lower.includes("@2x") &&
      !lower.includes("wixpress") && !lower.includes("squarespace")
    );
  });
}

function rankEmail(emails: string[]): string | null {
  if (!emails.length) return null;
  const personal = emails.filter((e) => {
    const prefix = e.split("@")[0].toLowerCase();
    return !GENERIC_EMAIL_PREFIXES.some((g) => prefix === g || prefix.startsWith(g + "."));
  });
  return personal[0] ?? emails[0];
}

function isOwnerTitle(text: string): boolean {
  const lower = text.toLowerCase();
  return OWNER_TITLES.some((t) => lower.includes(t));
}

/**
 * Extract owner name from HTML — looks for names near owner-title words
 * and parses Schema.org Person + vCard markup.
 */
function extractOwnerFromHtml(html: string): { name: string | null; title: string | null; email: string | null } {
  const result: { name: string | null; title: string | null; email: string | null } = {
    name: null, title: null, email: null,
  };

  // 1. Schema.org Person markup
  const personSchema = html.match(/"@type"\s*:\s*"Person"[^}]*"name"\s*:\s*"([^"]+)"/);
  if (personSchema) {
    result.name = personSchema[1];
  }

  // 2. vCard cn field
  const vcardMatch = html.match(/fn;charset[^:]*:([^\r\n]+)/i) ||
                     html.match(/fn:([^\r\n]+)/i);
  if (vcardMatch && !result.name) {
    result.name = vcardMatch[1].trim();
  }

  // 3. Look for "Owner/Director: Name" or "Name — Owner" patterns
  const ownerPatterns = [
    /(?:owner|director|founder|principal|ceo|md|proprietor)[:\s—\-–]+([A-Z][a-z]+ [A-Z][a-z]+)/g,
    /([A-Z][a-z]+ [A-Z][a-z]+)[,\s—\-–]+(?:owner|director|founder|principal|ceo|md|proprietor)/g,
  ];

  for (const pattern of ownerPatterns) {
    const match = pattern.exec(html);
    if (match && !result.name) {
      result.name = match[1].trim();
    }
  }

  // 4. Meta author tag
  const metaAuthor = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i);
  if (metaAuthor && !result.name) {
    result.name = metaAuthor[1].trim();
  }

  // 5. Email near owner title
  const emailMatches = extractEmails(html);
  if (emailMatches.length) {
    result.email = rankEmail(emailMatches);
  }

  return result;
}

// ─── Source 1: Website Deep Scrape ────────────────────────────────────────────

interface ScrapeResult {
  email: string | null;
  ownerName: string | null;
  ownerTitle: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
}

async function scrapeWebsite(website: string): Promise<ScrapeResult> {
  const base = cleanUrl(website);
  const result: ScrapeResult = {
    email: null, ownerName: null, ownerTitle: null,
    phone: null, linkedinUrl: null, facebookUrl: null,
  };

  for (const path of CONTACT_PATHS) {
    try {
      const url = `${base}${path}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) continue;

      const html = await res.text();
      const lower = html.toLowerCase();

      // Extract emails
      if (!result.email) {
        const emails = extractEmails(html);
        const ranked = rankEmail(emails);
        if (ranked) result.email = ranked;
      }

      // Extract owner info
      if (!result.ownerName) {
        const ownerData = extractOwnerFromHtml(html);
        if (ownerData.name) result.ownerName = ownerData.name;
        if (ownerData.title) result.ownerTitle = ownerData.title;
        if (ownerData.email && !result.email) result.email = ownerData.email;
      }

      // Extract phone (AU/UK format)
      if (!result.phone) {
        const phoneMatch = html.match(/(?:tel:|href="tel:)([+\d\s\(\)\-]{8,18})/i) ||
                           html.match(/\b(?:0[2-9]\d{8}|04\d{8}|\+61\s?\d{9}|0[12378]\d{9}|\+44\s?7\d{9})\b/);
        if (phoneMatch) result.phone = phoneMatch[1]?.replace(/\s+/g, "") ?? phoneMatch[0];
      }

      // Extract LinkedIn URL
      if (!result.linkedinUrl) {
        const liMatch = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/[a-zA-Z0-9\-_%]+/);
        if (liMatch) result.linkedinUrl = liMatch[0];
      }

      // Extract Facebook URL
      if (!result.facebookUrl) {
        const fbMatch = html.match(/https?:\/\/(?:www\.)?facebook\.com\/(?!sharer|share|dialog)[a-zA-Z0-9._\-]+/);
        if (fbMatch && !fbMatch[0].includes("facebook.com/tr")) {
          result.facebookUrl = fbMatch[0];
        }
      }

      // If we have an email AND name, stop early — we have what we need
      if (result.email && result.ownerName) break;

    } catch {
      // continue to next path
    }
  }

  return result;
}

// ─── Source 2: Exa Owner Search ───────────────────────────────────────────────

interface ExaOwnerResult {
  ownerName: string | null;
  email: string | null;
  linkedinUrl: string | null;
  title: string | null;
}

async function exaOwnerSearch(
  companyName: string,
  city: string | null,
  website: string | null
): Promise<ExaOwnerResult> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return { ownerName: null, email: null, linkedinUrl: null, title: null };

  const locationHint = city ? ` ${city}` : "";
  const query = `"${companyName}"${locationHint} owner OR director OR founder contact email`;

  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        query,
        num_results: 5,
        text: true,
        highlights: false,
        ...(website ? { includeDomains: [extractDomain(website)!].filter(Boolean) } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return { ownerName: null, email: null, linkedinUrl: null, title: null };

    const data = await res.json() as { results?: Array<{ text?: string; url?: string; title?: string }> };
    const combined = (data.results ?? []).map((r) => r.text ?? "").join("\n");
    const urls = (data.results ?? []).map((r) => r.url ?? "");

    // Extract emails from results
    const emails = extractEmails(combined);
    const email = rankEmail(emails);

    // Extract owner name
    const ownerData = extractOwnerFromHtml(combined);

    // Find LinkedIn URL in result URLs or text
    const linkedinUrl =
      urls.find((u) => u.includes("linkedin.com/in/")) ??
      combined.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/)?.[0] ??
      null;

    return {
      ownerName: ownerData.name,
      email: ownerData.email ?? email,
      linkedinUrl,
      title: ownerData.title,
    };
  } catch (err) {
    logger.warn("Exa owner search failed", { company: companyName, error: String(err) });
    return { ownerName: null, email: null, linkedinUrl: null, title: null };
  }
}

// ─── Source 3: Exa LinkedIn Search ───────────────────────────────────────────

async function exaLinkedInSearch(
  companyName: string,
  city: string | null
): Promise<{ ownerName: string | null; linkedinUrl: string | null; title: string | null }> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return { ownerName: null, linkedinUrl: null, title: null };

  const locationHint = city ? ` ${city}` : "";
  const query = `site:linkedin.com/in "${companyName}"${locationHint} owner OR director OR founder`;

  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ query, num_results: 3, text: true }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return { ownerName: null, linkedinUrl: null, title: null };

    const data = await res.json() as {
      results?: Array<{ url?: string; title?: string; text?: string }>
    };

    const results = data.results ?? [];
    const liResult = results.find((r) => r.url?.includes("linkedin.com/in/"));

    if (!liResult) return { ownerName: null, linkedinUrl: null, title: null };

    // LinkedIn profile titles are usually "Name - Title at Company"
    let ownerName: string | null = null;
    let title: string | null = null;

    if (liResult.title) {
      const parts = liResult.title.split(/[\-–|]/);
      if (parts[0]) ownerName = parts[0].trim();
      if (parts[1] && isOwnerTitle(parts[1])) title = parts[1].trim().split(" at ")[0].trim();
    }

    return {
      ownerName,
      linkedinUrl: liResult.url ?? null,
      title,
    };
  } catch (err) {
    logger.warn("Exa LinkedIn search failed", { company: companyName, error: String(err) });
    return { ownerName: null, linkedinUrl: null, title: null };
  }
}

// ─── Source 4: Email Pattern Generator ───────────────────────────────────────

// Generic business-owner contact prefixes ordered by likelihood of reaching DM
// For small businesses (<10 staff), these typically go directly to the owner
const OWNER_PREFIXES = [
  "owner", "director", "info", "hello", "contact",
  "admin", "office", "enquiries",
];

function generateEmailPatterns(ownerName: string | null, domain: string): string[] {
  const patterns: string[] = [];

  // If we have an owner name, personal patterns go first (highest deliverability to DM)
  if (ownerName) {
    const parts = ownerName.trim().toLowerCase().split(/\s+/);
    if (parts.length >= 2) {
      const [first, ...rest] = parts;
      const last = rest[rest.length - 1];
      const fi = first[0];
      patterns.push(
        `${first}@${domain}`,           // john@domain.com
        `${first}.${last}@${domain}`,   // john.smith@domain.com
        `${fi}${last}@${domain}`,       // jsmith@domain.com
        `${fi}.${last}@${domain}`,      // j.smith@domain.com
        `${first}${last}@${domain}`,    // johnsmith@domain.com
        `${last}@${domain}`,            // smith@domain.com
      );
    } else {
      patterns.push(`${parts[0]}@${domain}`);
    }
  }

  // Always add business prefixes as fallback — for small businesses these
  // typically reach the owner directly (they ARE the info@ person)
  for (const prefix of OWNER_PREFIXES) {
    const candidate = `${prefix}@${domain}`;
    if (!patterns.includes(candidate)) patterns.push(candidate);
  }

  return patterns;
}

// ─── Source 5: Facebook Page Scrape ──────────────────────────────────────────

async function scrapeFacebookPage(
  fbUrl: string
): Promise<{ email: string | null; phone: string | null; ownerName: string | null }> {
  try {
    // Facebook requires specific headers to get useful content
    const res = await fetch(fbUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return { email: null, phone: null, ownerName: null };

    const html = await res.text();
    const emails = extractEmails(html);
    const email = rankEmail(emails);

    const phoneMatch = html.match(/\b(?:0[2-9]\d{8}|04\d{8}|\+61\s?\d{9}|0[12378]\d{9}|\+44\s?7\d{9})\b/);

    return {
      email,
      phone: phoneMatch?.[0] ?? null,
      ownerName: null, // Facebook pages rarely expose owner name in HTML
    };
  } catch {
    return { email: null, phone: null, ownerName: null };
  }
}

// ─── Main Task ────────────────────────────────────────────────────────────────

export const emailEnrichment = schemaTask({
  id: "email-enrichment",
  schema: z.object({
    leadId: z.string(),
    userId: z.string(),
  }),
  machine: "small-1x",
  maxDuration: 120,
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload) => {
    const { leadId, userId } = payload;

    const { data: lead, error } = await supabase
      .from("leads")
      .select("id, dm_email, dm_name, dm_title, dm_linkedin_url, dm_facebook_url, phone, website, company_name, city, niche")
      .eq("id", leadId)
      .eq("user_id", userId)
      .single();

    if (error || !lead) return { success: false, reason: "lead_not_found" };
    if (lead.dm_email) return { success: true, reason: "already_enriched" };
    if (!lead.website) return { success: false, reason: "no_website" };

    const domain = extractDomain(lead.website);
    if (!domain) return { success: false, reason: "invalid_domain" };

    const updates: Record<string, string | null> = {};
    let ownerName: string | null = lead.dm_name ?? null;
    let foundVia = "none";

    // ── Source 1: Website deep scrape ──────────────────────────────────────
    logger.log(`[1/5] Scraping website for ${lead.company_name}`);
    const scraped = await scrapeWebsite(lead.website);

    if (scraped.email) { updates.dm_email = scraped.email; foundVia = "website"; }
    if (scraped.ownerName && !ownerName) { ownerName = scraped.ownerName; updates.dm_name = ownerName; }
    if (scraped.ownerTitle && !lead.dm_title) updates.dm_title = scraped.ownerTitle;
    if (scraped.phone && !lead.phone) updates.phone = scraped.phone;
    if (scraped.linkedinUrl && !lead.dm_linkedin_url) updates.dm_linkedin_url = scraped.linkedinUrl;
    if (scraped.facebookUrl && !lead.dm_facebook_url) updates.dm_facebook_url = scraped.facebookUrl;

    // ── Source 2: Exa owner search ─────────────────────────────────────────
    if (!updates.dm_email || !ownerName) {
      logger.log(`[2/5] Exa owner search for ${lead.company_name}`);
      const exaOwner = await exaOwnerSearch(lead.company_name, lead.city, lead.website);

      if (exaOwner.email && !updates.dm_email) {
        updates.dm_email = exaOwner.email;
        foundVia = "exa_web";
      }
      if (exaOwner.ownerName && !ownerName) {
        ownerName = exaOwner.ownerName;
        updates.dm_name = ownerName;
      }
      if (exaOwner.title && !updates.dm_title) updates.dm_title = exaOwner.title;
      if (exaOwner.linkedinUrl && !updates.dm_linkedin_url) updates.dm_linkedin_url = exaOwner.linkedinUrl;
    }

    // ── Source 3: Exa LinkedIn search ──────────────────────────────────────
    if (!updates.dm_linkedin_url || !ownerName) {
      logger.log(`[3/5] Exa LinkedIn search for ${lead.company_name}`);
      const liResult = await exaLinkedInSearch(lead.company_name, lead.city);

      if (liResult.linkedinUrl && !updates.dm_linkedin_url) updates.dm_linkedin_url = liResult.linkedinUrl;
      if (liResult.ownerName && !ownerName) {
        ownerName = liResult.ownerName;
        updates.dm_name = ownerName;
      }
      if (liResult.title && !updates.dm_title) updates.dm_title = liResult.title;
    }

    // ── Source 4: Email pattern generation ─────────────────────────────────
    // Always generate patterns — even without owner name we use owner/director/info@ prefixes.
    // For small businesses these reliably reach the decision-maker (they ARE the info@ person).
    if (!updates.dm_email) {
      logger.log(`[4/5] Generating email patterns for ${ownerName ?? "unknown owner"} @ ${domain}`);
      const patterns = generateEmailPatterns(ownerName, domain);
      // Personal name pattern first if available, else owner@ / director@ / info@
      updates.dm_email = patterns[0];
      foundVia = ownerName ? "pattern_personal" : "pattern_generic";
      logger.log(`Pattern email: ${patterns[0]} (${patterns.length} alternatives)`);
    }

    // ── Source 5: Facebook page scrape ─────────────────────────────────────
    const fbUrl = updates.dm_facebook_url ?? lead.dm_facebook_url;
    if ((!updates.dm_email || !updates.phone) && fbUrl) {
      logger.log(`[5/5] Scraping Facebook page for ${lead.company_name}`);
      const fbData = await scrapeFacebookPage(fbUrl);

      if (fbData.email && !updates.dm_email) {
        updates.dm_email = fbData.email;
        foundVia = "facebook";
      }
      if (fbData.phone && !updates.phone && !lead.phone) updates.phone = fbData.phone;
    }

    // ── Write all updates in one DB call ───────────────────────────────────
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", leadId);

      if (updateError) {
        logger.error("Failed to update lead", { leadId, error: updateError.message });
        return { success: false, reason: "db_error" };
      }
    }

    const hasEmail = !!updates.dm_email;
    const hasName = !!ownerName;

    logger.log(`Enriched ${lead.company_name}: email=${hasEmail} (${foundVia}), name=${hasName}, linkedin=${!!updates.dm_linkedin_url}`);

    return {
      success: hasEmail || hasName,
      email: updates.dm_email ?? null,
      ownerName,
      linkedinUrl: updates.dm_linkedin_url ?? null,
      source: foundVia,
    };
  },
});
