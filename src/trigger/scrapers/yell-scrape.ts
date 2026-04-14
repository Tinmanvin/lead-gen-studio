/**
 * Yell.com Scraper — UK
 * Source: yell.com — UK's largest local business directory
 * Covers: All UK local businesses not captured by FCA/SRA registers
 * Method: Playwright — JS-rendered search results
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import puppeteer from "puppeteer";
import { supabase } from "../../lib/supabase-server.js";
import type { RawLead } from "../../lib/types.js";

const YELL_NICHES = [
  "plumber",
  "electrician",
  "roofer",
  "mechanic",
  "locksmith",
  "pest control",
  "accountant",
  "dentist",
  "physiotherapist",
  "estate agent",
  "architect",
  "builder",
  "decorator",
  "landscaper",
  "solar panels",
];

const UK_CITIES_YELL = [
  "London", "Manchester", "Birmingham", "Leeds", "Bristol",
  "Sheffield", "Liverpool", "Edinburgh", "Glasgow", "Cardiff",
  "Leicester", "Nottingham", "Reading", "Brighton", "Coventry",
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
    logger.error("Failed to save Yell lead", { error, company: lead.company_name });
    return null;
  }
  return data.id;
}

export const yellScrape = schemaTask({
  id: "yell-scrape",
  schema: z.object({
    niche: z.string(),
    city: z.string(),
    userId: z.string(),
  }),
  machine: "small-2x",
  maxDuration: 300,
  run: async (payload) => {
    const { niche, city, userId } = payload;
    const url = `https://www.yell.com/s/${encodeURIComponent(niche)}-${encodeURIComponent(city)}.html`;
    logger.log(`Yell scrape: ${niche} in ${city}`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    let saved = 0;
    let skipped = 0;

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector("[class*='businessCapsule'], .businessCapsule--mainRow", {
        timeout: 15000,
      }).catch(() => null);

      const businesses = await page.evaluate(() => {
        const cards = document.querySelectorAll(
          "[class*='businessCapsule'], article[data-tracking]"
        );
        return Array.from(cards).map((card) => ({
          name: card.querySelector("h2 a, [class*='businessName'], .businessName")?.textContent?.trim() ?? "",
          website: (card.querySelector("a[data-tracking*='website'], a[href*='http']:not([href*='yell.com'])") as HTMLAnchorElement)?.href ?? "",
          phone: card.querySelector("[class*='phone'], .phone")?.textContent?.trim() ?? "",
          rating: card.querySelector("[class*='rating'], .starRating")?.getAttribute("aria-label") ?? "",
          reviewCount: card.querySelector("[class*='reviewCount'], .reviewCount")?.textContent?.trim() ?? "",
          address: card.querySelector("[class*='address'], address")?.textContent?.trim() ?? "",
          profileUrl: (card.querySelector("h2 a") as HTMLAnchorElement)?.href ?? "",
        }));
      });

      logger.log(`Found ${businesses.length} businesses on Yell: ${niche} in ${city}`);

      for (const biz of businesses) {
        if (!biz.name) {
          skipped++;
          continue;
        }

        const ratingMatch = biz.rating.match(/[\d.]+/);
        const ratingNum = ratingMatch ? parseFloat(ratingMatch[0]) : undefined;
        const reviewMatch = biz.reviewCount.match(/\d+/);
        const reviewNum = reviewMatch ? parseInt(reviewMatch[0]) : undefined;

        const lead: RawLead = {
          company_name: biz.name,
          website: biz.website || undefined,
          niche,
          country: "UK",
          city,
          timezone: "Europe/London",
          source: "yell",
          source_url: biz.profileUrl || url,
          source_raw: biz as unknown as Record<string, unknown>,
          rating: ratingNum,
          review_count: reviewNum,
          has_ssl: biz.website?.startsWith("https") ?? false,
        };

        const leadId = await saveLead(lead, userId);
        if (!leadId) {
          skipped++;
          continue;
        }

        // Missed call signal from rating text
        if (ratingNum && ratingNum >= 3.2 && ratingNum <= 3.8) {
          await supabase.from("lead_signals").insert({
            lead_id: leadId,
            signal_type: "low_rating",
            evidence: `Yell rating: ${ratingNum} (${reviewNum ?? 0} reviews)`,
          });
        }

        saved++;
      }
    } finally {
      await browser.close();
    }

    logger.log(`Yell ${niche}/${city}: ${saved} saved, ${skipped} skipped`);
    return { saved, skipped, niche, city };
  },
});

export { YELL_NICHES, UK_CITIES_YELL };
