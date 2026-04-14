/**
 * Trustpilot Pain Signal Scanner — UK
 * Source: trustpilot.com
 * Purpose: Scan reviews of UK businesses for missed call / poor response signals
 *          This enriches existing leads AND discovers new ones
 * Method: Playwright — JS-rendered review pages
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import puppeteer from "puppeteer";
import { supabase } from "../../lib/supabase-server.js";
import type { RawLead } from "../../lib/types.js";

const MISSED_CALL_PATTERNS = [
  "no one picked up", "never called back", "voicemail was full",
  "didn't return my call", "couldn't reach", "no answer", "still waiting",
  "no response", "left a message", "never got back", "ignored my call",
  "phone just rings", "unobtainable", "not returned",
];

const AFTER_HOURS_PATTERNS = [
  "closed at weekends", "not available after", "after hours",
  "out of hours", "weekend call", "evening call", "called at night",
];

const TRUSTPILOT_CATEGORIES_UK = [
  { url: "https://www.trustpilot.com/categories/local_services?country=GB&page=", niche: "local services" },
  { url: "https://www.trustpilot.com/categories/home_services?country=GB&page=", niche: "home services" },
  { url: "https://www.trustpilot.com/categories/construction?country=GB&page=", niche: "construction" },
  { url: "https://www.trustpilot.com/categories/legal_services?country=GB&page=", niche: "law firm" },
  { url: "https://www.trustpilot.com/categories/mortgage_brokers?country=GB&page=", niche: "mortgage broker" },
  { url: "https://www.trustpilot.com/categories/dentists?country=GB&page=", niche: "dentist" },
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

  if (error) return null;
  return data.id;
}

export const trustpilotScrape = schemaTask({
  id: "trustpilot-scrape",
  schema: z.object({
    categoryUrl: z.string(),
    niche: z.string(),
    userId: z.string(),
  }),
  machine: "small-2x",
  maxDuration: 300,
  run: async (payload) => {
    const { categoryUrl, niche, userId } = payload;
    logger.log(`Trustpilot scan: ${niche}`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    let saved = 0;
    let signalsFound = 0;

    try {
      // Scan first 3 pages of category
      for (let pageNum = 1; pageNum <= 3; pageNum++) {
        await page.goto(`${categoryUrl}${pageNum}`, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });

        await page.waitForSelector("[class*='businessUnitCard'], .business-unit", {
          timeout: 15000,
        }).catch(() => null);

        const businesses = await page.evaluate(() => {
          const cards = document.querySelectorAll(
            "[class*='businessUnitCard'], [data-business-unit-id]"
          );
          return Array.from(cards).map((card) => ({
            name: card.querySelector("[class*='businessName'], h3")?.textContent?.trim() ?? "",
            website: (card.querySelector("a[href*='http']:not([href*='trustpilot'])") as HTMLAnchorElement)?.href ?? "",
            rating: parseFloat(card.querySelector("[class*='ratingNumber']")?.textContent ?? "0"),
            reviewCount: parseInt(card.querySelector("[class*='reviewCount']")?.textContent?.replace(/\D/g, "") ?? "0"),
            trustpilotUrl: (card.querySelector("a[href*='/review/']") as HTMLAnchorElement)?.href ?? "",
          }));
        });

        for (const biz of businesses) {
          if (!biz.name || biz.rating === 0) continue;

          // Only look at businesses with ratings suggesting pain (under 4.0)
          const isLowRating = biz.rating >= 3.0 && biz.rating < 4.0;

          if (!isLowRating) continue;

          // Scan actual reviews for pain signals
          if (biz.trustpilotUrl) {
            await page.goto(biz.trustpilotUrl, { waitUntil: "networkidle2", timeout: 20000 });

            const reviewTexts = await page.evaluate(() => {
              const reviews = document.querySelectorAll("[class*='reviewContent'], [data-service-review-text]");
              return Array.from(reviews).map((r) => r.textContent?.toLowerCase() ?? "");
            });

            const missedCallEvidence = reviewTexts.find((text: string) =>
              MISSED_CALL_PATTERNS.some((p: string) => text.includes(p))
            );

            const afterHoursEvidence = reviewTexts.find((text: string) =>
              AFTER_HOURS_PATTERNS.some((p: string) => text.includes(p))
            );

            if (missedCallEvidence || afterHoursEvidence) {
              // Check if lead already exists
              const { data: existing } = await supabase
                .from("leads")
                .select("id")
                .eq("company_name", biz.name)
                .eq("country", "UK")
                .eq("user_id", userId)
                .maybeSingle();

              let leadId = existing?.id;

              if (!leadId) {
                const lead: RawLead = {
                  company_name: biz.name,
                  website: biz.website || undefined,
                  niche,
                  country: "UK",
                  city: "UK",
                  timezone: "Europe/London",
                  source: "trustpilot",
                  source_url: biz.trustpilotUrl,
                  rating: biz.rating,
                  review_count: biz.reviewCount,
                };
                leadId = await saveLead(lead, userId);
                if (leadId) saved++;
              }

              if (leadId) {
                const signals = [];
                if (missedCallEvidence) {
                  signals.push({
                    lead_id: leadId,
                    signal_type: "missed_call",
                    evidence: missedCallEvidence.slice(0, 500),
                  });
                }
                if (afterHoursEvidence) {
                  signals.push({
                    lead_id: leadId,
                    signal_type: "after_hours_gap",
                    evidence: afterHoursEvidence.slice(0, 500),
                  });
                }
                if (biz.rating < 4.0) {
                  signals.push({
                    lead_id: leadId,
                    signal_type: "low_rating",
                    evidence: `Trustpilot rating: ${biz.rating} (${biz.reviewCount} reviews)`,
                  });
                }

                // Avoid duplicate signals
                for (const signal of signals) {
                  const { data: existingSignal } = await supabase
                    .from("lead_signals")
                    .select("id")
                    .eq("lead_id", leadId)
                    .eq("signal_type", signal.signal_type)
                    .maybeSingle();

                  if (!existingSignal) {
                    await supabase.from("lead_signals").insert(signal);
                    signalsFound++;
                  }
                }
              }

              // Go back to category page
              await page.goto(`${categoryUrl}${pageNum}`, {
                waitUntil: "networkidle2",
                timeout: 20000,
              });
            }
          }
        }

        logger.log(`Trustpilot ${niche} page ${pageNum}: scanned ${businesses.length} businesses`);
      }
    } finally {
      await browser.close();
    }

    logger.log(`Trustpilot ${niche}: ${saved} new leads, ${signalsFound} signals added`);
    return { saved, signalsFound, niche };
  },
});

export { TRUSTPILOT_CATEGORIES_UK };
