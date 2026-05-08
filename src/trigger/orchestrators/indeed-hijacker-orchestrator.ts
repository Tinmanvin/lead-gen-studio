/**
 * Indeed Hijacker Orchestrator
 *
 * 6pm UTC — scrapes all job boards across all categories + markets
 * 9pm UTC — enriches all newly scraped jobs (website + email + email gen)
 *
 * Board coverage:
 *   AU: Adzuna AU (5 cities) + Seek (5 cities)
 *   UK: Adzuna UK (nationwide) + Reed API (nationwide) + CV-Library (nationwide)
 *
 * Categories: receptionist, intake_coordinator, live_chat, sdr, admin, after_hours
 */
import { schedules, batch, logger } from "@trigger.dev/sdk/v3";
import {
  indeedHijackerScrape,
  JOB_CATEGORIES,
  AU_CITIES_INDEED,
  AU_CITIES_SEEK,
} from "../scrapers/indeed-hijacker.js";
import { indeedEnrichment } from "../enrichment/indeed-enrichment.js";
import { supabase } from "../../lib/supabase-server.js";

const ENRICHMENT_CAP = 500;

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
// Scrape Orchestrator — 6pm UTC (1am BKK)
// ─────────────────────────────────────────────

export const indeedHijackerScrapeOrchestrator = schedules.task({
  id: "indeed-hijacker-scrape-orchestrator",
  cron: "0 18 * * *",
  machine: "small-1x",
  maxDuration: 600,
  run: async (payload) => {
    logger.log("Indeed Hijacker scrape starting", { timestamp: payload.timestamp });

    const userId = await getUserId();
    if (!userId) {
      logger.error("No user found");
      return { success: false };
    }

    // Read live settings from DB — geo, board toggles, category toggles
    const { data: settingsRows } = await supabase.from("indeed_settings").select("key, value");
    const sm: Record<string, any> = {};
    (settingsRows ?? []).forEach((r: any) => { sm[r.key] = r.value; });

    const geo = sm.geo ?? { au: true, uk: true };
    const boards = sm.boards_enabled ?? { indeed_au: true, indeed_uk: true, seek: true, reed: true, cv_library: true };
    const cats = sm.categories_enabled ?? {};

    const enabled = (k: string) => boards[k] !== false;

    const allJobs: Array<{ id: string; payload: Record<string, unknown> }> = [];

    for (const [categoryKey, categoryConfig] of Object.entries(JOB_CATEGORIES)) {
      if (categoryKey === "social") continue;
      if (cats[categoryKey] === false) continue;

      const terms = categoryConfig.searchTerms.slice(0, 3);

      for (const searchTerm of terms) {
        // ── AU boards — per city ──────────────────────────────────────
        if (geo.au) {
          if (enabled("indeed_au")) {
            for (const city of AU_CITIES_INDEED) {
              allJobs.push({
                id: indeedHijackerScrape.id,
                payload: { board: "adzuna_au", searchTerm, category: categoryKey, location: city, userId },
              });
            }
          }
          if (enabled("seek")) {
            for (const city of AU_CITIES_SEEK) {
              allJobs.push({
                id: indeedHijackerScrape.id,
                payload: { board: "seek", searchTerm, category: categoryKey, location: city, userId },
              });
            }
          }
        }

        // ── UK boards — nationwide ────────────────────────────────────
        if (geo.uk) {
          if (enabled("indeed_uk")) {
            allJobs.push({
              id: indeedHijackerScrape.id,
              payload: { board: "adzuna_uk", searchTerm, category: categoryKey, location: "", userId },
            });
          }
          if (enabled("reed")) {
            allJobs.push({
              id: indeedHijackerScrape.id,
              payload: { board: "reed_api", searchTerm, category: categoryKey, location: "", userId },
            });
          }
          if (enabled("cv_library")) {
            allJobs.push({
              id: indeedHijackerScrape.id,
              payload: { board: "cv_library", searchTerm, category: categoryKey, location: "", userId },
            });
          }
        }
      }
    }

    logger.log("Settings applied", { geo, auBoards: [enabled("indeed_au") && "adzuna_au", enabled("seek") && "seek"].filter(Boolean), ukBoards: [enabled("indeed_uk") && "adzuna_uk", enabled("reed") && "reed_api", enabled("cv_library") && "cv_library"].filter(Boolean) });

    logger.log(`Firing ${allJobs.length} scrape tasks`);
    await fireBatch(allJobs, "Indeed Hijacker Scrape");

    return { success: true, tasksTriggered: allJobs.length };
  },
});

// ─────────────────────────────────────────────
// Enrich Orchestrator — 9pm UTC (4am BKK)
// ─────────────────────────────────────────────

export const indeedHijackerEnrichOrchestrator = schedules.task({
  id: "indeed-hijacker-enrich-orchestrator",
  cron: "0 21 * * *",
  machine: "small-1x",
  maxDuration: 600,
  run: async () => {
    logger.log("Indeed Hijacker enrichment starting");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: jobs, error } = await supabase
      .from("indeed_jobs")
      .select("id")
      .eq("status", "found")
      .gte("created_at", today.toISOString())
      .limit(ENRICHMENT_CAP);

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
