/**
 * Law Society AU Scraper — Australia
 * Sources: Law Society registers for NSW, VIC, QLD, WA
 * Covers: Solicitors, family law, personal injury lawyers — high-value niche
 * Method: Playwright — each state has its own JS-rendered register
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import puppeteer from "puppeteer";
import { supabase } from "../../lib/supabase-server.js";
import type { RawLead } from "../../lib/types.js";

const STATE_CONFIGS: Record<string, {
  url: string;
  timezone: string;
  cardSelector: string;
  nameSelector: string;
  firmSelector: string;
  websiteSelector: string;
}> = {
  NSW: {
    url: "https://www.lawsociety.com.au/for-the-public/solicitor-search",
    timezone: "Australia/Sydney",
    cardSelector: ".solicitor-result, .search-result",
    nameSelector: ".solicitor-name, .name",
    firmSelector: ".firm-name, .company",
    websiteSelector: "a.website",
  },
  VIC: {
    url: "https://www.lawsociety.org.au/for-the-community/find-a-solicitor",
    timezone: "Australia/Melbourne",
    cardSelector: ".result-item, .solicitor-card",
    nameSelector: ".solicitor-name, h3",
    firmSelector: ".firm, .company-name",
    websiteSelector: "a[href*='http']",
  },
  QLD: {
    url: "https://www.qls.com.au/For_the_Public/Find_a_Solicitor",
    timezone: "Australia/Brisbane",
    cardSelector: ".solicitor-listing, .result",
    nameSelector: ".name, h3",
    firmSelector: ".firm, .company",
    websiteSelector: "a.website, a[href*='http']",
  },
  WA: {
    url: "https://www.lawsocietywa.asn.au/solicitor-search/",
    timezone: "Australia/Perth",
    cardSelector: ".member-result, .solicitor-result",
    nameSelector: ".member-name, .name",
    firmSelector: ".firm-name, .company",
    websiteSelector: "a[href*='http']",
  },
};

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
    logger.error("Failed to save Law Society AU lead", { error, company: lead.company_name });
    return null;
  }
  return data.id;
}

export const lawSocietyAuScrape = schemaTask({
  id: "law-society-au-scrape",
  schema: z.object({
    state: z.enum(["NSW", "VIC", "QLD", "WA"]),
    userId: z.string(),
  }),
  machine: "small-2x",
  maxDuration: 300,
  run: async (payload) => {
    const { state, userId } = payload;
    const config = STATE_CONFIGS[state];
    logger.log(`Law Society AU scrape: ${state}`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    let saved = 0;
    let skipped = 0;

    try {
      await page.goto(config.url, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector(config.cardSelector, { timeout: 15000 }).catch(() => null);

      const firms = await page.evaluate((selectors: { cardSelector: string; nameSelector: string; firmSelector: string; websiteSelector: string }) => {
        const cards = document.querySelectorAll(selectors.cardSelector);
        return Array.from(cards).map((card) => ({
          name: card.querySelector(selectors.nameSelector)?.textContent?.trim() ?? "",
          firm: card.querySelector(selectors.firmSelector)?.textContent?.trim() ?? "",
          website: (card.querySelector(selectors.websiteSelector) as HTMLAnchorElement)?.href ?? "",
          address: card.querySelector(".address, .location")?.textContent?.trim() ?? "",
        }));
      }, config);

      logger.log(`Found ${firms.length} law firms in ${state}`);

      for (const firm of firms) {
        if (!firm.firm && !firm.name) {
          skipped++;
          continue;
        }

        const companyName = firm.firm || `${firm.name} — Solicitor`;

        const lead: RawLead = {
          company_name: companyName,
          website: firm.website || undefined,
          niche: "law firm",
          country: "AU",
          city: state,
          timezone: config.timezone,
          dm_name: firm.name || undefined,
          dm_title: "Solicitor",
          source: "law_society_au",
          source_url: config.url,
          source_raw: firm as unknown as Record<string, unknown>,
        };

        const leadId = await saveLead(lead, userId);
        leadId ? saved++ : skipped++;
      }
    } finally {
      await browser.close();
    }

    logger.log(`Law Society AU ${state}: ${saved} saved, ${skipped} skipped`);
    return { saved, skipped, state };
  },
});
