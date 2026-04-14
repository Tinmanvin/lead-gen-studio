/**
 * Checkatrade Scraper — UK
 * Source: checkatrade.com — UK's largest vetted trades platform
 * Covers: Plumbers, electricians, builders, roofers, decorators, etc.
 * Signal: Any tradie listed here is PAYING for leads — same as HiPages AU.
 *         Pitch: "Cut your cost per lead with an AI receptionist."
 * Method: Playwright — JS-rendered listing pages
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import puppeteer from "puppeteer";
import { supabase } from "../../lib/supabase-server.js";
import type { RawLead } from "../../lib/types.js";

const CHECKATRADE_CATEGORIES = [
  { slug: "plumbers", niche: "plumber" },
  { slug: "electricians", niche: "electrician" },
  { slug: "builders", niche: "builder" },
  { slug: "roofers", niche: "roofer" },
  { slug: "painters-and-decorators", niche: "painter" },
  { slug: "landscapers", niche: "landscaper" },
  { slug: "carpenters-and-joiners", niche: "carpenter" },
  { slug: "tilers", niche: "tiler" },
  { slug: "pest-control", niche: "pest control" },
  { slug: "locksmiths", niche: "locksmith" },
  { slug: "heating-engineers", niche: "heating engineer" },
  { slug: "gas-engineers", niche: "gas engineer" },
  { slug: "bathroom-fitters", niche: "bathroom fitter" },
  { slug: "kitchen-fitters", niche: "kitchen fitter" },
  { slug: "solar-panels", niche: "solar panels" },
  { slug: "damp-proofing", niche: "damp proofing" },
  { slug: "groundworkers", niche: "groundworker" },
  { slug: "double-glazing", niche: "double glazing" },
];

const UK_CITIES_CHECKATRADE = [
  { city: "London", citySlug: "london" },
  { city: "Manchester", citySlug: "manchester" },
  { city: "Birmingham", citySlug: "birmingham" },
  { city: "Leeds", citySlug: "leeds" },
  { city: "Bristol", citySlug: "bristol" },
  { city: "Sheffield", citySlug: "sheffield" },
  { city: "Liverpool", citySlug: "liverpool" },
  { city: "Edinburgh", citySlug: "edinburgh" },
  { city: "Glasgow", citySlug: "glasgow" },
  { city: "Cardiff", citySlug: "cardiff" },
  { city: "Leicester", citySlug: "leicester" },
  { city: "Nottingham", citySlug: "nottingham" },
  { city: "Coventry", citySlug: "coventry" },
  { city: "Brighton", citySlug: "brighton" },
  { city: "Reading", citySlug: "reading" },
];

async function saveLead(lead: RawLead, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("company_name", lead.company_name)
    .eq("country", "UK")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("leads")
    .insert({ ...lead, user_id: userId, status: "new" })
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to save Checkatrade lead", { error, company: lead.company_name });
    return null;
  }
  return data.id;
}

export const checkatradeScrape = schemaTask({
  id: "checkatrade-scrape",
  schema: z.object({
    categorySlug: z.string(),
    niche: z.string(),
    citySlug: z.string(),
    city: z.string(),
    userId: z.string(),
  }),
  machine: "small-2x",
  maxDuration: 300,
  run: async (payload) => {
    const { categorySlug, niche, citySlug, city, userId } = payload;
    const url = `https://www.checkatrade.com/search?tradeType=${categorySlug}&location=${citySlug}`;
    logger.log(`Checkatrade scrape: ${niche} in ${city}`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Set a realistic user agent to avoid bot detection
    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    });

    let saved = 0;
    let skipped = 0;

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector(
        "[class*='TradeMemberCard'], [data-testid*='trade-card'], .trade-member-card",
        { timeout: 15000 }
      ).catch(() => null);

      const tradies = await page.evaluate(() => {
        const cards = document.querySelectorAll(
          "[class*='TradeMemberCard'], [data-testid*='trade-card'], [class*='MemberCard']"
        );
        return Array.from(cards).map((card) => ({
          name: card.querySelector("[class*='tradeName'], [class*='MemberName'], h2, h3")?.textContent?.trim() ?? "",
          rating: card.querySelector("[class*='rating'], [class*='Rating']")?.textContent?.trim() ?? "",
          reviewCount: card.querySelector("[class*='reviewCount'], [class*='reviews']")?.textContent?.trim() ?? "",
          location: card.querySelector("[class*='location'], [class*='Location']")?.textContent?.trim() ?? "",
          website: (card.querySelector("a[href*='http']:not([href*='checkatrade'])") as HTMLAnchorElement)?.href ?? "",
          profileUrl: (card.querySelector("a[href*='/find/']") as HTMLAnchorElement)?.href ?? "",
          verified: !!card.querySelector("[class*='vetted'], [class*='Vetted'], [class*='verified']"),
        }));
      });

      logger.log(`Found ${tradies.length} tradies on Checkatrade: ${niche} in ${city}`);

      for (const tradie of tradies) {
        if (!tradie.name) {
          skipped++;
          continue;
        }

        const ratingMatch = tradie.rating.match(/[\d.]+/);
        const ratingNum = ratingMatch ? parseFloat(ratingMatch[0]) : undefined;
        const reviewMatch = tradie.reviewCount.match(/\d+/);
        const reviewNum = reviewMatch ? parseInt(reviewMatch[0]) : undefined;

        const lead: RawLead = {
          company_name: tradie.name,
          website: tradie.website || undefined,
          niche,
          country: "UK",
          city: tradie.location || city,
          timezone: "Europe/London",
          source: "checkatrade",
          source_url: tradie.profileUrl
            ? `https://www.checkatrade.com${tradie.profileUrl}`
            : url,
          source_raw: tradie as unknown as Record<string, unknown>,
          rating: ratingNum,
          review_count: reviewNum,
          has_ssl: tradie.website?.startsWith("https") ?? false,
        };

        const leadId = await saveLead(lead, userId);
        if (!leadId) {
          skipped++;
          continue;
        }

        // Core Checkatrade signal: paying for leads = proven budget
        await supabase.from("lead_signals").insert({
          lead_id: leadId,
          signal_type: "ads_no_capture",
          evidence: "Listed on Checkatrade — paying for leads. AI receptionist pitch: cut cost per lead, never miss a call.",
        });

        // Low rating bonus signal
        if (ratingNum && ratingNum >= 3.2 && ratingNum <= 3.8) {
          await supabase.from("lead_signals").insert({
            lead_id: leadId,
            signal_type: "low_rating",
            evidence: `Checkatrade rating: ${ratingNum} (${reviewNum ?? 0} reviews)`,
          });
        }

        saved++;
      }
    } finally {
      await browser.close();
    }

    logger.log(`Checkatrade ${niche}/${city}: ${saved} saved, ${skipped} skipped`);
    return { saved, skipped, niche, city };
  },
});

export { CHECKATRADE_CATEGORIES, UK_CITIES_CHECKATRADE };
