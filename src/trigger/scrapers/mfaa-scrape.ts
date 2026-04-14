/**
 * MFAA Scraper — Australia
 * Source: Mortgage & Finance Association of Australia broker finder
 * Covers: Mortgage brokers, finance brokers — AU's highest-value niche for AI
 * Method: Playwright — broker finder is JS-rendered
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import puppeteer from "puppeteer";
import { supabase } from "../../lib/supabase-server.js";
import type { RawLead } from "../../lib/types.js";

const AU_CITIES_POSTCODES: Array<{ city: string; postcode: string; state: string }> = [
  { city: "Sydney", postcode: "2000", state: "NSW" },
  { city: "Melbourne", postcode: "3000", state: "VIC" },
  { city: "Brisbane", postcode: "4000", state: "QLD" },
  { city: "Perth", postcode: "6000", state: "WA" },
  { city: "Adelaide", postcode: "5000", state: "SA" },
  { city: "Gold Coast", postcode: "4217", state: "QLD" },
  { city: "Canberra", postcode: "2600", state: "ACT" },
  { city: "Newcastle", postcode: "2300", state: "NSW" },
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
    logger.error("Failed to save MFAA lead", { error, company: lead.company_name });
    return null;
  }
  return data.id;
}

export const mfaaScrape = schemaTask({
  id: "mfaa-scrape",
  schema: z.object({
    city: z.string(),
    postcode: z.string(),
    state: z.string(),
    userId: z.string(),
  }),
  machine: "small-2x",
  maxDuration: 300,
  run: async (payload) => {
    const { city, postcode, state, userId } = payload;
    logger.log(`MFAA scrape: ${city} (${postcode})`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    let saved = 0;
    let skipped = 0;

    try {
      await page.goto(
        `https://www.mfaa.com.au/find-a-broker?postcode=${postcode}&radius=25`,
        { waitUntil: "networkidle2", timeout: 30000 }
      );

      // Wait for broker cards to load
      await page.waitForSelector(".broker-card, .member-card, [data-broker]", {
        timeout: 15000,
      }).catch(() => null);

      // Extract broker listings
      const brokers = await page.evaluate(() => {
        const cards = document.querySelectorAll(".broker-card, .member-card, .search-result-item");
        return Array.from(cards).map((card) => ({
          name: card.querySelector(".broker-name, .name, h3")?.textContent?.trim() ?? "",
          company: card.querySelector(".company-name, .business-name, .firm")?.textContent?.trim() ?? "",
          website: (card.querySelector("a[href*='http']") as HTMLAnchorElement)?.href ?? "",
          phone: card.querySelector(".phone, .tel")?.textContent?.trim() ?? "",
          email: card.querySelector(".email, a[href^='mailto']")?.textContent?.trim() ?? "",
          profileUrl: (card.querySelector("a.profile-link, a.view-profile") as HTMLAnchorElement)?.href ?? "",
        }));
      });

      logger.log(`Found ${brokers.length} brokers in ${city}`);

      for (const broker of brokers) {
        if (!broker.name && !broker.company) {
          skipped++;
          continue;
        }

        const companyName = broker.company || `${broker.name} — Mortgage Broker`;

        const lead: RawLead = {
          company_name: companyName,
          website: broker.website || undefined,
          niche: "mortgage broker",
          country: "AU",
          city,
          timezone: stateToTimezone(state),
          dm_name: broker.name || undefined,
          dm_title: "Mortgage Broker",
          dm_email: broker.email ? broker.email.replace("mailto:", "") : undefined,
          source: "mfaa",
          source_url: broker.profileUrl || "https://www.mfaa.com.au/find-a-broker",
          source_raw: broker as unknown as Record<string, unknown>,
        };

        const leadId = await saveLead(lead, userId);
        leadId ? saved++ : skipped++;
      }
    } finally {
      await browser.close();
    }

    logger.log(`MFAA ${city}: ${saved} saved, ${skipped} skipped`);
    return { saved, skipped, city };
  },
});

function stateToTimezone(state: string): string {
  const map: Record<string, string> = {
    NSW: "Australia/Sydney", VIC: "Australia/Melbourne",
    QLD: "Australia/Brisbane", WA: "Australia/Perth",
    SA: "Australia/Adelaide", ACT: "Australia/Sydney",
  };
  return map[state] ?? "Australia/Sydney";
}

export { AU_CITIES_POSTCODES };
