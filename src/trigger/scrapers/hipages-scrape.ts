/**
 * HiPages Scraper — Australia
 * Source: hipages.com.au (Australia's largest tradie platform)
 * Covers: Plumbers, electricians, builders, roofers, painters, concreters, etc.
 * Signal: Any tradie paying for leads here = proven budget + proven pain
 * Method: Playwright — JS-rendered listing pages
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import puppeteer from "puppeteer";
import { supabase } from "../../lib/supabase-server.js";
import type { RawLead } from "../../lib/types.js";

const HIPAGES_CATEGORIES = [
  { slug: "plumbers", niche: "plumber" },
  { slug: "electricians", niche: "electrician" },
  { slug: "builders", niche: "builder" },
  { slug: "roofers", niche: "roofer" },
  { slug: "painters", niche: "painter" },
  { slug: "landscapers", niche: "landscaper" },
  { slug: "concreters", niche: "concreter" },
  { slug: "tilers", niche: "tiler" },
  { slug: "carpenters", niche: "carpenter" },
  { slug: "pest-control", niche: "pest control" },
  { slug: "locksmiths", niche: "locksmith" },
  { slug: "air-conditioning", niche: "air conditioning" },
];

const AU_CITY_SLUGS: Array<{ city: string; citySlug: string; state: string; timezone: string }> = [
  { city: "Sydney", citySlug: "sydney-nsw", state: "NSW", timezone: "Australia/Sydney" },
  { city: "Melbourne", citySlug: "melbourne-vic", state: "VIC", timezone: "Australia/Melbourne" },
  { city: "Brisbane", citySlug: "brisbane-qld", state: "QLD", timezone: "Australia/Brisbane" },
  { city: "Perth", citySlug: "perth-wa", state: "WA", timezone: "Australia/Perth" },
  { city: "Adelaide", citySlug: "adelaide-sa", state: "SA", timezone: "Australia/Adelaide" },
  { city: "Gold Coast", citySlug: "gold-coast-qld", state: "QLD", timezone: "Australia/Brisbane" },
];

async function saveLead(lead: RawLead, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("company_name", lead.company_name)
    .eq("country", "AU")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("leads")
    .insert({ ...lead, user_id: userId, status: "new" })
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to save HiPages lead", { error, company: lead.company_name });
    return null;
  }
  return data.id;
}

export const hipagesScrape = schemaTask({
  id: "hipages-scrape",
  schema: z.object({
    categorySlug: z.string(),
    niche: z.string(),
    citySlug: z.string(),
    city: z.string(),
    state: z.string(),
    timezone: z.string(),
    userId: z.string(),
  }),
  machine: "small-2x",
  maxDuration: 300,
  run: async (payload) => {
    const { categorySlug, niche, citySlug, city, state, timezone, userId } = payload;
    const url = `https://hipages.com.au/${categorySlug}/${citySlug}`;
    logger.log(`HiPages scrape: ${niche} in ${city}`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    let saved = 0;
    let skipped = 0;

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector("[data-testid='contractor-card'], .tradie-card, .business-card", {
        timeout: 15000,
      }).catch(() => null);

      const tradies = await page.evaluate(() => {
        const cards = document.querySelectorAll(
          "[data-testid='contractor-card'], .tradie-card, .business-listing, [class*='BusinessCard']"
        );
        return Array.from(cards).map((card) => ({
          name: card.querySelector("[class*='businessName'], .business-name, h3")?.textContent?.trim() ?? "",
          rating: card.querySelector("[class*='rating'], .rating-value")?.textContent?.trim() ?? "",
          reviewCount: card.querySelector("[class*='review'], .review-count")?.textContent?.trim() ?? "",
          suburb: card.querySelector("[class*='suburb'], [class*='location'], .location")?.textContent?.trim() ?? "",
          profileUrl: (card.querySelector("a[href]") as HTMLAnchorElement)?.href ?? "",
          verified: !!card.querySelector("[class*='verified'], .verified-badge"),
        }));
      });

      logger.log(`Found ${tradies.length} tradies on HiPages: ${niche} in ${city}`);

      for (const tradie of tradies) {
        if (!tradie.name) {
          skipped++;
          continue;
        }

        const ratingNum = parseFloat(tradie.rating) || undefined;
        const reviewNum = parseInt(tradie.reviewCount) || undefined;

        const lead: RawLead = {
          company_name: tradie.name,
          niche,
          country: "AU",
          city: tradie.suburb || city,
          timezone,
          source: "hipages",
          source_url: tradie.profileUrl || url,
          source_raw: tradie as unknown as Record<string, unknown>,
          rating: ratingNum,
          review_count: reviewNum,
        };

        const leadId = await saveLead(lead, userId);
        if (!leadId) {
          skipped++;
          continue;
        }

        // HiPages tradies are paying for leads — strong "already has lead budget" signal
        await supabase.from("lead_signals").insert({
          lead_id: leadId,
          signal_type: "ads_no_capture",
          evidence: "Listed on HiPages — paying for leads. AI receptionist pitch: cut cost per lead.",
        });

        saved++;
      }
    } finally {
      await browser.close();
    }

    logger.log(`HiPages ${niche}/${city}: ${saved} saved, ${skipped} skipped`);
    return { saved, skipped, niche, city };
  },
});

export { HIPAGES_CATEGORIES, AU_CITY_SLUGS };
