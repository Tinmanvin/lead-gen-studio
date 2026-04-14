/**
 * Indeed Hijacker Orchestrator
 *
 * 3am UTC — scrapes all 4 job boards across all categories + markets
 * 7am UTC — enriches all newly scraped jobs (website + email + email gen)
 *
 * Board coverage:
 *   AU: Indeed AU (5 cities) + Seek (5 cities)
 *   UK: Indeed UK (5 cities) + Reed (5 cities) + Totaljobs (5 cities)
 *
 * Categories: receptionist, intake_coordinator, live_chat, sdr, admin,
 *             after_hours, social (7 categories, each with multiple search terms)
 */
import { schedules, batch, logger } from "@trigger.dev/sdk/v3";
import {
  indeedHijackerScrape,
  JOB_CATEGORIES,
  AU_CITIES_INDEED,
  UK_CITIES_INDEED,
  AU_CITIES_SEEK,
  UK_CITIES_REED,
} from "../scrapers/indeed-hijacker.js";
import { indeedEnrichment } from "../enrichment/indeed-enrichment.js";
import { supabase } from "../../lib/supabase-server.js";

const UK_CITIES_TOTALJOBS = UK_CITIES_REED; // Same cities

async function fireBatch(
  jobs: Array<{ id: string; payload: Record<string, unknown> }>,
  label: string
) {
  if (!jobs.length) return;
  const chunkSize = 20;
  for (let i = 0; i < jobs.length; i += chunkSize) {
    const chunk = jobs.slice(i, i + chunkSize);
    await batch.trigger(chunk);
    logger.log(
      `${label}: batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(jobs.length / chunkSize)}`
    );
  }
}

async function getUserId(): Promise<string | null> {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error || !users.users.length) return null;
  return users.users[0].id;
}

// ─────────────────────────────────────────────
// Scrape Orchestrator — 3am UTC
// ─────────────────────────────────────────────

export const indeedHijackerScrapeOrchestrator = schedules.task({
  id: "indeed-hijacker-scrape-orchestrator",
  cron: "0 3 * * *",
  machine: "small-1x",
  maxDuration: 600,
  run: async (payload) => {
    logger.log("Indeed Hijacker scrape starting", { timestamp: payload.timestamp });

    const userId = await getUserId();
    if (!userId) {
      logger.error("No user found");
      return { success: false };
    }

    // Build all scrape payloads
    const allJobs: Array<{ id: string; payload: Record<string, unknown> }> = [];

    for (const [categoryKey, categoryConfig] of Object.entries(JOB_CATEGORIES)) {
      // Skip social (lower priority) for now — can re-enable manually
      if (categoryKey === "social") continue;

      // Use first 3 search terms per category to avoid over-scraping
      const terms = categoryConfig.searchTerms.slice(0, 3);

      for (const searchTerm of terms) {
        // Adzuna AU — 5 cities
        for (const city of AU_CITIES_INDEED) {
          allJobs.push({
            id: indeedHijackerScrape.id,
            payload: {
              board: "adzuna_au",
              searchTerm,
              category: categoryKey,
              location: city,
              userId,
            },
          });
        }

        // Seek AU — 5 cities (Puppeteer)
        for (const city of AU_CITIES_SEEK) {
          allJobs.push({
            id: indeedHijackerScrape.id,
            payload: {
              board: "seek",
              searchTerm,
              category: categoryKey,
              location: city,
              userId,
            },
          });
        }

        // Adzuna UK — 5 cities
        for (const city of UK_CITIES_INDEED) {
          allJobs.push({
            id: indeedHijackerScrape.id,
            payload: {
              board: "adzuna_uk",
              searchTerm,
              category: categoryKey,
              location: city,
              userId,
            },
          });
        }

        // Reed UK — official API — 5 cities
        for (const city of UK_CITIES_REED) {
          allJobs.push({
            id: indeedHijackerScrape.id,
            payload: {
              board: "reed_api",
              searchTerm,
              category: categoryKey,
              location: city,
              userId,
            },
          });
        }

        // Totaljobs UK — 5 cities (Puppeteer)
        for (const city of UK_CITIES_TOTALJOBS) {
          allJobs.push({
            id: indeedHijackerScrape.id,
            payload: {
              board: "totaljobs",
              searchTerm,
              category: categoryKey,
              location: city,
              userId,
            },
          });
        }
      }
    }

    logger.log(`Firing ${allJobs.length} scrape tasks across all boards + categories`);
    await fireBatch(allJobs, "Indeed Hijacker Scrape");

    return { success: true, tasksTriggered: allJobs.length };
  },
});

// ─────────────────────────────────────────────
// Enrich Orchestrator — 7am UTC
// ─────────────────────────────────────────────

export const indeedHijackerEnrichOrchestrator = schedules.task({
  id: "indeed-hijacker-enrich-orchestrator",
  cron: "0 7 * * *",
  machine: "small-1x",
  maxDuration: 600,
  run: async () => {
    logger.log("Indeed Hijacker enrichment starting");

    // Fetch all jobs scraped today with status='found' (not yet enriched)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: jobs, error } = await supabase
      .from("indeed_jobs")
      .select("id")
      .eq("status", "found")
      .gte("created_at", today.toISOString())
      .limit(200);

    if (error || !jobs?.length) {
      logger.log("No jobs to enrich", { error: error?.message });
      return { success: true, enriched: 0 };
    }

    logger.log(`Enriching ${jobs.length} jobs`);

    const enrichJobs = jobs.map((job) => ({
      id: indeedEnrichment.id,
      payload: { jobId: job.id },
    }));

    await fireBatch(enrichJobs, "Indeed Enrichment");

    return { success: true, enriched: jobs.length };
  },
});
