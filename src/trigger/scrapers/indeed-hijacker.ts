/**
 * Indeed Hijacker — Job Board Scraper
 * Sources: Adzuna API (AU+UK), Reed API (UK), Seek/Totaljobs Puppeteer (AU/UK)
 * Saves raw records to indeed_jobs table.
 * Enrichment (website + email + email gen) is a separate task.
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import puppeteer from "puppeteer";
import { supabase } from "../../lib/supabase-server.js";

// ─────────────────────────────────────────────
// Job title categories → search terms + template
// ─────────────────────────────────────────────

export const JOB_CATEGORIES: Record<
  string,
  { searchTerms: string[]; template: string; label: string }
> = {
  receptionist: {
    searchTerms: [
      "receptionist",
      "front desk",
      "front of house",
      "call handler",
      "virtual receptionist",
      "appointment scheduler",
      "booking coordinator",
    ],
    template: "receptionist",
    label: "AI Receptionist / Voice Agent",
  },
  intake_coordinator: {
    searchTerms: [
      "patient coordinator",
      "intake coordinator",
      "client coordinator",
      "care coordinator",
      "admissions coordinator",
      "practice manager assistant",
      "dental coordinator",
      "medical receptionist",
    ],
    template: "intake",
    label: "Patient / Intake Coordinator",
  },
  live_chat: {
    searchTerms: [
      "live chat agent",
      "chat support",
      "customer support representative",
      "inbound sales representative",
      "online enquiries coordinator",
      "website support agent",
    ],
    template: "chat",
    label: "AI Chat / Website Lead Capture",
  },
  sdr: {
    searchTerms: [
      "sales development representative",
      "appointment setter",
      "lead qualifier",
      "outbound caller",
      "telesales",
    ],
    template: "sdr",
    label: "Speed-to-Lead / SDR",
  },
  admin: {
    searchTerms: [
      "office administrator",
      "administrative assistant",
      "scheduling coordinator",
      "follow-up coordinator",
      "client success coordinator",
      "operations coordinator",
    ],
    template: "admin",
    label: "Admin / Follow-Up Automation",
  },
  after_hours: {
    searchTerms: [
      "after hours coordinator",
      "on call coordinator",
      "emergency response coordinator",
      "out of hours support",
    ],
    template: "after_hours",
    label: "After-Hours / Emergency Coverage",
  },
  social: {
    searchTerms: [
      "social media manager",
      "social media coordinator",
      "content coordinator",
      "digital marketing assistant",
    ],
    template: "social",
    label: "Social / Content",
  },
};

// Market configs
export const AU_CITIES_INDEED = [
  "Sydney NSW",
  "Melbourne VIC",
  "Brisbane QLD",
  "Perth WA",
  "Adelaide SA",
];

export const UK_CITIES_INDEED = [
  "London",
  "Manchester",
  "Birmingham",
  "Leeds",
  "Bristol",
];

export const AU_CITIES_SEEK = [
  "All Sydney NSW",
  "All Melbourne VIC",
  "All Brisbane QLD",
  "All Perth WA",
  "All Adelaide SA",
];

export const UK_CITIES_REED = [
  "london",
  "manchester",
  "birmingham",
  "leeds",
  "bristol",
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

interface RawJob {
  company_name: string;
  job_title: string;
  location: string | null;
  salary: string | null;
  source_url: string | null;
  posted_text: string | null;
}

function parseHoursSincePosted(text: string | null): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("just") || t.includes("today") || t.includes("now")) return 1;
  const daysMatch = t.match(/(\d+)\s*day/);
  if (daysMatch) return parseInt(daysMatch[1]) * 24;
  const hoursMatch = t.match(/(\d+)\s*hour/);
  if (hoursMatch) return parseInt(hoursMatch[1]);
  const minsMatch = t.match(/(\d+)\s*min/);
  if (minsMatch) return 1;
  if (t.includes("week") || t.includes("7")) return 168;
  if (t.includes("30+")) return 720;
  return null;
}

function detectCategory(jobTitle: string): string {
  const title = jobTitle.toLowerCase();
  for (const [cat, config] of Object.entries(JOB_CATEGORIES)) {
    if (config.searchTerms.some((term) => title.includes(term.toLowerCase()))) {
      return cat;
    }
  }
  return "receptionist"; // fallback
}

async function checkAndSaveJob(
  job: RawJob,
  source: string,
  country: string,
  category: string,
  userId: string
): Promise<"saved" | "duplicate" | "error"> {
  try {
    // Check for duplicate today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayDup } = await supabase
      .from("indeed_jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("company_name", job.company_name)
      .eq("job_title", job.job_title)
      .eq("country", country)
      .gte("created_at", today.toISOString())
      .maybeSingle();

    if (todayDup) return "duplicate";

    // Check repost count (same company + same general title in last 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { count: repostCount } = await supabase
      .from("indeed_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("company_name", job.company_name)
      .ilike("job_title", `%${job.job_title.split(" ").slice(0, 2).join(" ")}%`)
      .eq("country", country)
      .gte("created_at", sixtyDaysAgo.toISOString());

    const hours = parseHoursSincePosted(job.posted_text);

    const { error } = await supabase.from("indeed_jobs").insert({
      user_id: userId,
      company_name: job.company_name,
      job_title: job.job_title,
      job_category: category,
      location: job.location,
      country,
      source,
      source_url: job.source_url,
      salary: job.salary,
      hours_since_posted: hours,
      repost_count: (repostCount ?? 0) + 1,
      email_found: false,
      status: "found",
    });

    if (error) {
      logger.error("Save failed", { error: error.message, company: job.company_name });
      return "error";
    }

    return "saved";
  } catch (err) {
    logger.warn("checkAndSaveJob threw", { error: String(err) });
    return "error";
  }
}

// ─────────────────────────────────────────────
// Job title relevance filter
// Only save jobs that look like they need a receptionist / admin / coordination role.
// Kills tech, engineering, medical-professional, and other irrelevant results that
// slip through keyword searches on broad job boards.
// ─────────────────────────────────────────────

const RELEVANT_TITLE_TERMS = [
  // Receptionist / front desk
  "receptionist", "front desk", "front of house", "front-of-house",
  // Admin / coordination
  "administrator", "administrative", "office manager", "office admin",
  "coordinator", "scheduling", "scheduler", "bookings",
  // Patient / intake
  "patient", "intake", "care coordinator", "dental coordinator",
  "medical receptionist", "clinic coordinator", "practice manager",
  // Customer-facing / inbound
  "customer service", "customer support", "call handler", "call centre",
  "inbound", "live chat", "chat agent", "web chat",
  // Sales / SDR adjacent
  "appointment setter", "lead qualifier", "telesales", "sales support",
  // Virtual / remote comms
  "virtual assistant", "virtual receptionist", "remote receptionist",
];

const IRRELEVANT_TITLE_TERMS = [
  // Tech / engineering
  "engineer", "developer", "software", "devops", "qa ", " qa", "quality assurance",
  "architect", "data scientist", "machine learning", "ai engineer", "backend", "frontend",
  "full stack", "fullstack", "sysadmin", "cloud", "security analyst", "cyber",
  "network", "infrastructure", "programmer", "coder",
  // Finance / legal professional
  "accountant", "solicitor", "barrister", "paralegal", "lawyer", "compliance officer",
  "financial advisor", "financial analyst", "actuary",
  // Medical professional (not admin)
  "nurse", "doctor", "physician", "surgeon", "therapist", "physiotherapist",
  "dentist", "pharmacist", "radiographer", "paramedic",
  // Management / executive
  "chief ", "ceo", "cto", "coo", "vp ", "vice president", "director",
  "head of ", "general manager",
  // Skilled trades (not our market)
  "electrician", "plumber", "carpenter", "welder", "mechanic",
  // Other unrelated
  "driver", "delivery", "warehouse", "cleaner", "chef", "cook", "barista",
  "security guard", "teacher", "lecturer", "professor",
];

function isRelevantJobTitle(title: string): boolean {
  const t = title.toLowerCase();

  // Immediately reject irrelevant titles
  if (IRRELEVANT_TITLE_TERMS.some((term) => t.includes(term))) return false;

  // Accept if it matches any relevant term
  if (RELEVANT_TITLE_TERMS.some((term) => t.includes(term))) return true;

  // Default: reject — if we can't positively identify it, skip it
  return false;
}

// ─────────────────────────────────────────────
// Recruitment agency filter
// Agencies post jobs on behalf of clients — they have a conflict of interest
// (they place human receptionists for a fee) and won't pass our message on.
// We want direct employers only: the business that actually feels the pain.
// ─────────────────────────────────────────────

const AGENCY_TERMS = [
  // Generic agency words
  "recruitment", "recruiting", "recruiter",
  "staffing", "staff solutions",
  "talent", "talent acquisition",
  "agency", " search ltd", "search group",
  "executive search", "headhunt",
  "personnel", "resourcing", "manpower",
  "workforce solutions", "workforce group",
  // Known large agencies (UK + AU)
  "hays ", " hays", "reed ", "michael page", "page group",
  "robert half", "adecco", "randstad", "kelly services",
  "manpower", "gi group", "austin fraser",
  "tiger recruitment", "career legal", "huntress",
  "cld recruitment", "meridian", "candidate source",
  "brook street", "pertemps", "blue arrow",
  "search consultancy", "pure staff", "office angels",
  // AU-specific
  "chandler macleod", "people2people", "hudson",
  "drake international", "trojan", "labour solutions",
];

export function isRecruitmentAgency(companyName: string): boolean {
  const name = companyName.toLowerCase();
  return AGENCY_TERMS.some((term) => name.includes(term));
}

// ─────────────────────────────────────────────
// Board scrapers
// ─────────────────────────────────────────────

const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID!;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY!;
const REED_API_KEY = process.env.REED_API_KEY!;

// ─────────────────────────────────────────────
// Adzuna API — UK + AU (free 250/day)
// ─────────────────────────────────────────────
async function scrapeAdzuna(
  searchTerm: string,
  location: string,
  country: "AU" | "UK"
): Promise<RawJob[]> {
  const countryCode = country === "AU" ? "au" : "gb";
  const params = new URLSearchParams({
    app_id: ADZUNA_APP_ID,
    app_key: ADZUNA_APP_KEY,
    what: searchTerm,
    where: location,
    max_days_old: "3",
    results_per_page: "10",
    sort_by: "date",
  });

  try {
    const res = await fetch(
      `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1?${params.toString()}`
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn("Adzuna API error", { status: res.status, country: countryCode, body: body.slice(0, 200) });
      return [];
    }

    const data = await res.json() as { results?: Record<string, unknown>[] };
    const results = data.results ?? [];

    return results.map((item) => ({
      job_title: String(item.title ?? ""),
      company_name: String((item.company as Record<string, unknown>)?.display_name ?? ""),
      location: String((item.location as Record<string, unknown>)?.display_name ?? location),
      salary: item.salary_min
        ? `${item.salary_min}–${item.salary_max ?? item.salary_min}`
        : null,
      source_url: item.redirect_url ? String(item.redirect_url) : null,
      posted_text: item.created ? String(item.created) : null,
    })).filter((j) => j.job_title && j.company_name);
  } catch (err) {
    logger.warn("Adzuna scrape threw", { error: String(err) });
    return [];
  }
}

// ─────────────────────────────────────────────
// Reed API — UK only (free, official)
// ─────────────────────────────────────────────
async function scrapeReedApi(
  searchTerm: string,
  location: string
): Promise<RawJob[]> {
  const params = new URLSearchParams({
    keywords: searchTerm,
    locationName: location,
    daysAgedAtMost: "3",
    resultsToTake: "10",
  });

  // Reed uses Basic auth: API key as username, empty password
  const auth = Buffer.from(`${REED_API_KEY}:`).toString("base64");

  try {
    const res = await fetch(
      `https://www.reed.co.uk/api/1.0/search?${params.toString()}`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    if (!res.ok) {
      logger.warn("Reed API error", { status: res.status });
      return [];
    }

    const data = await res.json() as { results?: Record<string, unknown>[] };
    const results = data.results ?? [];

    return results.map((item) => ({
      job_title: String(item.jobTitle ?? ""),
      company_name: String(item.employerName ?? ""),
      location: String(item.locationName ?? location),
      salary: item.minimumSalary
        ? `${item.minimumSalary}–${item.maximumSalary ?? item.minimumSalary}`
        : null,
      source_url: item.jobUrl ? String(item.jobUrl) : null,
      posted_text: item.date ? String(item.date) : null,
    })).filter((j) => j.job_title && j.company_name);
  } catch (err) {
    logger.warn("Reed API threw", { error: String(err) });
    return [];
  }
}

async function scrapeSeek(searchTerm: string, location: string): Promise<RawJob[]> {
  const url = `https://www.seek.com.au/jobs?keywords=${encodeURIComponent(searchTerm)}&where=${encodeURIComponent(location)}&daterange=3`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
  );

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2500 + Math.random() * 1000));

    const jobs = await page.evaluate((): RawJob[] => {
      const results: RawJob[] = [];
      const cards = document.querySelectorAll(
        "[data-testid='job-card'], article[data-card-type='JobCard']"
      );

      cards.forEach((card) => {
        const titleEl = card.querySelector(
          "a[data-automation='jobTitle'], h3[data-automation='jobTitle']"
        );
        const companyEl = card.querySelector(
          "a[data-automation='jobCompany'], [data-automation='jobListingCompany']"
        );
        const locationEl = card.querySelector(
          "a[data-automation='jobLocation'], [data-automation='jobListingLocation']"
        );
        const salaryEl = card.querySelector("[data-automation='jobSalary']");
        const dateEl = card.querySelector("[data-automation='jobListingDate'], time");
        const linkEl = card.querySelector("a[data-automation='jobTitle']") as HTMLAnchorElement | null;

        const title = titleEl?.textContent?.trim() ?? "";
        const company = companyEl?.textContent?.trim() ?? "";
        if (!title || !company) return;

        results.push({
          job_title: title,
          company_name: company,
          location: locationEl?.textContent?.trim() ?? null,
          salary: salaryEl?.textContent?.trim() ?? null,
          source_url: linkEl?.href ? `https://www.seek.com.au${new URL(linkEl.href).pathname}` : null,
          posted_text: dateEl?.textContent?.trim() ?? null,
        });
      });

      return results;
    });

    return jobs;
  } catch (err) {
    logger.warn("Seek scrape failed", { url, error: String(err) });
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeReed(searchTerm: string, location: string): Promise<RawJob[]> {
  const termSlug = searchTerm.toLowerCase().replace(/\s+/g, "-");
  const url = `https://www.reed.co.uk/jobs/${termSlug}-jobs-in-${location}?dateCreatedOffSet=3`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
  );

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));

    const jobs = await page.evaluate((): RawJob[] => {
      const results: RawJob[] = [];
      const cards = document.querySelectorAll(
        "article[data-qa='job-result'], .job-result-heading"
      );

      cards.forEach((card) => {
        const titleEl = card.querySelector(
          "h2 a, .job-result-heading__title a, a[data-qa='job-title']"
        );
        const companyEl = card.querySelector(
          ".job-result-heading__employer a, a[data-qa='employer-name']"
        );
        const locationEl = card.querySelector(
          ".job-result-heading__meta address, [data-qa='job-location']"
        );
        const salaryEl = card.querySelector(".job-metadata__item--salary");
        const dateEl = card.querySelector(".job-result-heading__posted, time");
        const linkEl = titleEl as HTMLAnchorElement | null;

        const title = titleEl?.textContent?.trim() ?? "";
        const company = companyEl?.textContent?.trim() ?? "";
        if (!title || !company) return;

        results.push({
          job_title: title,
          company_name: company,
          location: locationEl?.textContent?.trim() ?? null,
          salary: salaryEl?.textContent?.trim() ?? null,
          source_url: linkEl?.href ?? null,
          posted_text: dateEl?.textContent?.trim() ?? null,
        });
      });

      return results;
    });

    return jobs;
  } catch (err) {
    logger.warn("Reed scrape failed", { url, error: String(err) });
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeTotaljobs(searchTerm: string, location: string): Promise<RawJob[]> {
  const termSlug = searchTerm.toLowerCase().replace(/\s+/g, "-");
  const url = `https://www.totaljobs.com/jobs/${termSlug}/in-${location}?postedin=3`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
  );

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));

    const jobs = await page.evaluate((): RawJob[] => {
      const results: RawJob[] = [];
      const cards = document.querySelectorAll("article.job, .job-item");

      cards.forEach((card) => {
        const titleEl = card.querySelector("h2 a, .job-title a, a[data-at='job-item-title']");
        const companyEl = card.querySelector(".employer a, a[data-at='job-item-company-name']");
        const locationEl = card.querySelector(
          ".location, [data-at='job-item-location']"
        );
        const salaryEl = card.querySelector(".job-title__salary, .salary");
        const dateEl = card.querySelector("time, .posted-date");
        const linkEl = titleEl as HTMLAnchorElement | null;

        const title = titleEl?.textContent?.trim() ?? "";
        const company = companyEl?.textContent?.trim() ?? "";
        if (!title || !company) return;

        results.push({
          job_title: title,
          company_name: company,
          location: locationEl?.textContent?.trim() ?? null,
          salary: salaryEl?.textContent?.trim() ?? null,
          source_url: linkEl?.href ?? null,
          posted_text: dateEl?.textContent?.trim() ?? null,
        });
      });

      return results;
    });

    return jobs;
  } catch (err) {
    logger.warn("Totaljobs scrape failed", { url, error: String(err) });
    return [];
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────
// Task
// ─────────────────────────────────────────────

export const indeedHijackerScrape = schemaTask({
  id: "indeed-hijacker-scrape",
  schema: z.object({
    board: z.enum(["adzuna_au", "adzuna_uk", "reed_api", "seek", "totaljobs"]),
    searchTerm: z.string(),
    category: z.string(),
    location: z.string(),
    userId: z.string(),
  }),
  machine: "small-2x",
  maxDuration: 120,
  run: async (payload) => {
    const { board, searchTerm, category, location, userId } = payload;

    logger.log(`Indeed Hijacker scraping: ${board} — "${searchTerm}" in ${location}`, {
      hasAdzunaId: !!process.env.ADZUNA_APP_ID,
      hasAdzunaKey: !!process.env.ADZUNA_APP_KEY,
      hasReedKey: !!process.env.REED_API_KEY,
    });

    let rawJobs: RawJob[] = [];

    switch (board) {
      case "adzuna_au":
        rawJobs = await scrapeAdzuna(searchTerm, location, "AU");
        break;
      case "adzuna_uk":
        rawJobs = await scrapeAdzuna(searchTerm, location, "UK");
        break;
      case "reed_api":
        rawJobs = await scrapeReedApi(searchTerm, location);
        break;
      case "seek":
        rawJobs = await scrapeSeek(searchTerm, location);
        break;
      case "totaljobs":
        rawJobs = await scrapeTotaljobs(searchTerm, location);
        break;
    }

    logger.log(`Found ${rawJobs.length} raw listings`);

    const country = board === "adzuna_au" || board === "seek" ? "AU" : "UK";
    const sourceLabel = board === "adzuna_au" ? "adzuna_au" : board === "adzuna_uk" ? "adzuna_uk" : board;

    let saved = 0;
    let duplicates = 0;
    let errors = 0;
    let skipped = 0;
    let agencies = 0;

    for (const job of rawJobs) {
      if (!job.company_name || !job.job_title) continue;

      if (!isRelevantJobTitle(job.job_title)) {
        skipped++;
        continue;
      }

      // Skip recruitment agencies — they place human staff for a fee and won't
      // act on our message. We want direct employers only.
      if (isRecruitmentAgency(job.company_name)) {
        agencies++;
        continue;
      }

      const detectedCategory = detectCategory(job.job_title) ?? category;
      const result = await checkAndSaveJob(job, sourceLabel, country, detectedCategory, userId);

      if (result === "saved") saved++;
      else if (result === "duplicate") duplicates++;
      else errors++;
    }

    logger.log(`Indeed Hijacker done: ${saved} saved, ${duplicates} duplicates, ${skipped} skipped (irrelevant), ${agencies} skipped (recruitment agency), ${errors} errors`);

    return { board, searchTerm, location, found: rawJobs.length, saved, duplicates, skipped, errors };
  },
});
