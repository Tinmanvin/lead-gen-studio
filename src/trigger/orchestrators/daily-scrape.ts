/**
 * Daily Scrape Orchestrator
 * Runs at 2am UTC every day.
 * Fires ALL scrape jobs across every data source, then chains
 * enrichment → scoring → email enrichment → Exa icebreaker.
 *
 * Data sources:
 * AU: Google Maps, AHPRA, MFAA, Law Society (4 states), HiPages, REIA
 * UK: Google Maps, OpenCorporates, FCA Register, Law Society UK, Yell, Checkatrade, Trustpilot
 */
import { schedules, batch, logger } from "@trigger.dev/sdk/v3";
import {
  googleMapsScrape,
  NICHES_AU, NICHES_UK, CITIES_AU, CITIES_UK,
} from "../scrapers/google-maps-scrape.js";
import { opencorporatesScrape, UK_NICHES } from "../scrapers/opencorporates-scrape.js";
import { ahpraScrape, AHPRA_PROFESSIONS, AU_STATES } from "../scrapers/ahpra-scrape.js";
import { mfaaScrape, AU_CITIES_POSTCODES } from "../scrapers/mfaa-scrape.js";
import { lawSocietyAuScrape } from "../scrapers/law-society-au-scrape.js";
import { hipagesScrape, HIPAGES_CATEGORIES, AU_CITY_SLUGS } from "../scrapers/hipages-scrape.js";
import { reiaScrape } from "../scrapers/reia-scrape.js";
import { fcaRegisterScrape, FCA_NICHES } from "../scrapers/fca-register-scrape.js";
import { lawSocietyUkScrape, UK_CITIES_FOR_LAW } from "../scrapers/law-society-uk-scrape.js";
import { yellScrape, YELL_NICHES, UK_CITIES_YELL } from "../scrapers/yell-scrape.js";
import { trustpilotScrape, TRUSTPILOT_CATEGORIES_UK } from "../scrapers/trustpilot-scrape.js";
import { checkatradeScrape, CHECKATRADE_CATEGORIES, UK_CITIES_CHECKATRADE } from "../scrapers/checkatrade-scrape.js";
import { supabase } from "../../lib/supabase-server.js";

async function fireBatches(
  jobs: Array<{ id: string; payload: Record<string, unknown> }>,
  label: string
) {
  const chunkSize = 25;
  for (let i = 0; i < jobs.length; i += chunkSize) {
    const chunk = jobs.slice(i, i + chunkSize);
    await batch.trigger(chunk);
    logger.log(`${label}: triggered batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(jobs.length / chunkSize)}`);
  }
}

export const dailyScrapeOrchestrator = schedules.task({
  id: "daily-scrape-orchestrator",
  cron: "0 2 * * *",
  machine: "small-1x",
  maxDuration: 600,
  run: async (payload) => {
    logger.log("Daily scrape starting", { timestamp: payload.timestamp });

    // Get user
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error || !users.users.length) {
      logger.error("No users found", { error });
      return { success: false };
    }
    const userId = users.users[0].id;

    // Read geo toggles
    const { data: geoSettings } = await supabase
      .from("settings")
      .select("key, value")
      .eq("user_id", userId)
      .in("key", ["geo_au_scrape", "geo_uk_scrape"]);

    const geo = Object.fromEntries((geoSettings ?? []).map((s) => [s.key, s.value]));
    const scrapeAU = geo["geo_au_scrape"] !== false;
    const scrapeUK = geo["geo_uk_scrape"] !== false;

    logger.log("Geo config", { scrapeAU, scrapeUK });

    // ────────────────────────────────────────────────────────────
    // AUSTRALIA
    // ────────────────────────────────────────────────────────────
    if (scrapeAU) {
      // 1. Google Maps AU
      const googleMapsAU = CITIES_AU.flatMap(({ city, timezone }) =>
        NICHES_AU.map((niche) => ({
          id: googleMapsScrape.id,
          payload: { country: "AU", niche, city, timezone, userId },
        }))
      );
      await fireBatches(googleMapsAU, "Google Maps AU");

      // 2. AHPRA — clinics, dentists, physios, chiros
      const ahpraBatches = AHPRA_PROFESSIONS.flatMap(({ code, niche }) =>
        AU_STATES.map((state) => ({
          id: ahpraScrape.id,
          payload: { professionCode: code, niche, state, userId },
        }))
      );
      await fireBatches(ahpraBatches, "AHPRA");

      // 3. MFAA — mortgage brokers
      const mfaaBatches = AU_CITIES_POSTCODES.map(({ city, postcode, state }) => ({
        id: mfaaScrape.id,
        payload: { city, postcode, state, userId },
      }));
      await fireBatches(mfaaBatches, "MFAA");

      // 4. Law Society AU — solicitors across 4 states
      const lawAuBatches = (["NSW", "VIC", "QLD", "WA"] as const).map((state) => ({
        id: lawSocietyAuScrape.id,
        payload: { state, userId },
      }));
      await fireBatches(lawAuBatches, "Law Society AU");

      // 5. HiPages — tradies
      const hipagesBatches = AU_CITY_SLUGS.flatMap(({ citySlug, city, state, timezone }) =>
        HIPAGES_CATEGORIES.map(({ slug, niche }) => ({
          id: hipagesScrape.id,
          payload: { categorySlug: slug, niche, citySlug, city, state, timezone, userId },
        }))
      );
      await fireBatches(hipagesBatches, "HiPages");

      // 6. REIA — property managers
      const reiaBatches = (["VIC", "NSW", "QLD", "WA"] as const).map((state) => ({
        id: reiaScrape.id,
        payload: { state, userId },
      }));
      await fireBatches(reiaBatches, "REIA");

    }

    // ────────────────────────────────────────────────────────────
    // UK
    // ────────────────────────────────────────────────────────────
    if (scrapeUK) {
      // 1. Google Maps UK
      const googleMapsUK = CITIES_UK.flatMap(({ city, timezone }) =>
        NICHES_UK.map((niche) => ({
          id: googleMapsScrape.id,
          payload: { country: "UK", niche, city, timezone, userId },
        }))
      );
      await fireBatches(googleMapsUK, "Google Maps UK");

      // 2. OpenCorporates UK
      const opencorporatesBatches = UK_NICHES.map(({ query: niche }) => ({
        id: opencorporatesScrape.id,
        payload: { niche, userId },
      }));
      await fireBatches(opencorporatesBatches, "OpenCorporates");

      // 3. FCA Register — financial services, mortgage brokers
      const fcaBatches = FCA_NICHES.map(({ query, niche }) => ({
        id: fcaRegisterScrape.id,
        payload: { query, niche, userId },
      }));
      await fireBatches(fcaBatches, "FCA Register");

      // 4. Law Society UK — solicitors
      const lawUkBatches = UK_CITIES_FOR_LAW.map((city) => ({
        id: lawSocietyUkScrape.id,
        payload: { city, userId },
      }));
      await fireBatches(lawUkBatches, "Law Society UK");

      // 5. Yell — local UK businesses
      const yellBatches = UK_CITIES_YELL.flatMap((city) =>
        YELL_NICHES.map((niche) => ({
          id: yellScrape.id,
          payload: { niche, city, userId },
        }))
      );
      await fireBatches(yellBatches, "Yell");

      // 6. Checkatrade — tradies paying for leads (UK equivalent of HiPages)
      const checkatradeBatches = UK_CITIES_CHECKATRADE.flatMap(({ citySlug, city }) =>
        CHECKATRADE_CATEGORIES.map(({ slug, niche }) => ({
          id: checkatradeScrape.id,
          payload: { categorySlug: slug, niche, citySlug, city, userId },
        }))
      );
      await fireBatches(checkatradeBatches, "Checkatrade");

      // 7. Trustpilot — pain signal scanner
      const trustpilotBatches = TRUSTPILOT_CATEGORIES_UK.map(({ url, niche }) => ({
        id: trustpilotScrape.id,
        payload: { categoryUrl: url, niche, userId },
      }));
      await fireBatches(trustpilotBatches, "Trustpilot");

    }

    // Update daily stats
    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("daily_stats")
      .upsert({ user_id: userId, date: today }, { onConflict: "user_id,date" });

    logger.log("Daily scrape orchestrator complete — all sources triggered");

    return {
      success: true,
      sourcesTriggered: [
        ...(scrapeAU ? ["google_maps_au", "ahpra", "mfaa", "law_society_au", "hipages", "reia"] : []),
        ...(scrapeUK ? ["google_maps_uk", "opencorporates", "fca_register", "law_society_uk", "yell", "checkatrade", "trustpilot"] : []),
      ],
    };
  },
});

/**
 * Post-Scrape Enrichment Chain
 * Triggered manually or after batch scrapes complete.
 * Picks up all 'new' leads and runs the full pipeline:
 * signal enrichment → scoring → email enrichment → Exa icebreaker
 */
export const enrichNewLeads = schedules.task({
  id: "enrich-new-leads",
  cron: "0 6 * * *", // 6am UTC — after overnight scrape completes
  machine: "small-1x",
  maxDuration: 600,
  run: async () => {
    const { data: users } = await supabase.auth.admin.listUsers();
    if (!users?.users.length) return { success: false };
    const userId = users.users[0].id;

    // Fetch all 'new' leads (not yet enriched)
    const { data: newLeads } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "new")
      .limit(500); // Process up to 500 at a time

    if (newLeads?.length) {
      logger.log(`Enriching ${newLeads.length} new leads through signal pipeline`);
    } else {
      logger.log("No new leads — skipping signal enrichment, continuing to email + Exa stages");
    }

    // Import here to avoid circular dependency issues at module load time
    const { signalEnrichment } = await import("../enrichment/signal-enrichment.js");
    const { emailEnrichment } = await import("../enrichment/email-enrichment.js");
    const { exaResearch } = await import("../enrichment/exa-research.js");

    // Fire signal enrichment for all new leads (scorer is chained inside)
    if (newLeads?.length) {
      for (let i = 0; i < newLeads.length; i += 25) {
        const chunk = newLeads.slice(i, i + 25);
        await signalEnrichment.batchTrigger(
          chunk.map((lead) => ({ payload: { leadId: lead.id, userId } }))
        );
      }
    }

    // Fire email enrichment for ALL leads with websites but no email yet (any status)
    // Process in pages of 200 to cover the full backlog
    let emailOffset = 0;
    let emailTotal = 0;
    while (true) {
      const { data: leadsWithWebsites } = await supabase
        .from("leads")
        .select("id")
        .eq("user_id", userId)
        .in("status", ["new", "enriched", "scored"])
        .not("website", "is", null)
        .is("dm_email", null)
        .range(emailOffset, emailOffset + 199);

      if (!leadsWithWebsites?.length) break;

      for (let i = 0; i < leadsWithWebsites.length; i += 25) {
        const chunk = leadsWithWebsites.slice(i, i + 25);
        await emailEnrichment.batchTrigger(
          chunk.map((lead) => ({ payload: { leadId: lead.id, userId } }))
        );
      }

      emailTotal += leadsWithWebsites.length;
      if (leadsWithWebsites.length < 200) break;
      emailOffset += 200;
    }
    logger.log(`Email enrichment triggered for ${emailTotal} leads`);

    // Fire Exa research only for high-scoring leads (value_add_score >= 2, no icebreaker yet)
    const { data: hotScores } = await supabase
      .from("lead_scores")
      .select("lead_id")
      .gte("value_add_score", 2)
      .limit(100);

    const hotLeadIds = (hotScores ?? []).map((s) => s.lead_id);

    const { data: hotLeads } = hotLeadIds.length
      ? await supabase
          .from("leads")
          .select("id")
          .in("id", hotLeadIds)
          .is("icebreaker", null)
          .limit(50)
      : { data: null };

    if (hotLeads?.length) {
      for (let i = 0; i < hotLeads.length; i += 10) {
        const chunk = hotLeads.slice(i, i + 10);
        await exaResearch.batchTrigger(
          chunk.map((lead) => ({ payload: { leadId: lead.id, userId } }))
        );
      }
      logger.log(`Exa research triggered for ${hotLeads.length} hot leads`);
    }

    return { success: true, enriched: newLeads.length };
  },
});
