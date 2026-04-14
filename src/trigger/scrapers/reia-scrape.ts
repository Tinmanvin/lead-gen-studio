/**
 * REIA Scraper — Australia
 * Source: Real Estate Institute of Australia + state bodies (REIV, REINSW, REIQ, REIWA)
 * Covers: Property managers, real estate agents — high-volume lead nurture niche
 * Method: Playwright — each state's member search is JS-rendered
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import puppeteer from "puppeteer";
import { supabase } from "../../lib/supabase-server.js";
import type { RawLead } from "../../lib/types.js";

const STATE_REI_CONFIGS: Record<string, {
  url: string;
  timezone: string;
  cardSelector: string;
}> = {
  VIC: {
    url: "https://www.reiv.com.au/find-an-agent",
    timezone: "Australia/Melbourne",
    cardSelector: ".agent-card, .member-listing, [class*='AgentCard']",
  },
  NSW: {
    url: "https://www.reinsw.com.au/find-an-agent",
    timezone: "Australia/Sydney",
    cardSelector: ".agent-result, .member-card",
  },
  QLD: {
    url: "https://www.reiq.com/find-a-member",
    timezone: "Australia/Brisbane",
    cardSelector: ".member-result, .agent-listing",
  },
  WA: {
    url: "https://reiwa.com.au/real-estate-agents",
    timezone: "Australia/Perth",
    cardSelector: "[data-agent], .agent-card, .profile-card",
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
    logger.error("Failed to save REIA lead", { error, company: lead.company_name });
    return null;
  }
  return data.id;
}

export const reiaScrape = schemaTask({
  id: "reia-scrape",
  schema: z.object({
    state: z.enum(["VIC", "NSW", "QLD", "WA"]),
    userId: z.string(),
  }),
  machine: "small-2x",
  maxDuration: 300,
  run: async (payload) => {
    const { state, userId } = payload;
    const config = STATE_REI_CONFIGS[state];
    logger.log(`REIA scrape: ${state}`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    let saved = 0;
    let skipped = 0;

    try {
      await page.goto(config.url, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector(config.cardSelector, { timeout: 15000 }).catch(() => null);

      const agents = await page.evaluate((cardSel: string) => {
        const cards = document.querySelectorAll(cardSel);
        return Array.from(cards).map((card) => ({
          name: card.querySelector("h2, h3, .name, .agent-name")?.textContent?.trim() ?? "",
          agency: card.querySelector(".agency, .company, .brand")?.textContent?.trim() ?? "",
          website: (card.querySelector("a[href*='http']:not([href*='reiv']):not([href*='reinsw']):not([href*='reiq']):not([href*='reiwa'])") as HTMLAnchorElement)?.href ?? "",
          email: card.querySelector("a[href^='mailto:']")?.getAttribute("href")?.replace("mailto:", "") ?? "",
          suburb: card.querySelector(".suburb, .location, .address")?.textContent?.trim() ?? "",
          profileUrl: (card.querySelector("a[href]") as HTMLAnchorElement)?.href ?? "",
        }));
      }, config.cardSelector);

      logger.log(`Found ${agents.length} agents in ${state}`);

      for (const agent of agents) {
        if (!agent.agency && !agent.name) {
          skipped++;
          continue;
        }

        const companyName = agent.agency || `${agent.name} — Real Estate`;

        const lead: RawLead = {
          company_name: companyName,
          website: agent.website || undefined,
          niche: "property manager",
          country: "AU",
          city: agent.suburb || state,
          timezone: config.timezone,
          dm_name: agent.name || undefined,
          dm_title: "Real Estate Agent / Property Manager",
          dm_email: agent.email || undefined,
          source: "reia",
          source_url: agent.profileUrl || config.url,
          source_raw: agent as unknown as Record<string, unknown>,
        };

        const leadId = await saveLead(lead, userId);
        leadId ? saved++ : skipped++;
      }
    } finally {
      await browser.close();
    }

    logger.log(`REIA ${state}: ${saved} saved, ${skipped} skipped`);
    return { saved, skipped, state };
  },
});
