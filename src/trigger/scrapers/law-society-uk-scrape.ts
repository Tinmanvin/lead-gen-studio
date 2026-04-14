/**
 * Law Society UK Scraper — UK
 * Source: Solicitors Regulation Authority (SRA) — England & Wales
 * Covers: Solicitors, law firms — personal injury, family law, conveyancing
 * Method: SRA public search API + Playwright for detail pages
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { supabase } from "../../lib/supabase-server.js";
import type { RawLead } from "../../lib/types.js";

const LAW_SPECIALISMS = [
  "personal injury",
  "family",
  "conveyancing",
  "employment",
  "immigration",
  "criminal",
  "wills and probate",
];

const UK_CITIES_FOR_LAW = [
  "London", "Manchester", "Birmingham", "Leeds", "Bristol",
  "Sheffield", "Liverpool", "Nottingham", "Leicester", "Cardiff",
];

interface SraFirm {
  id: string;
  name: string;
  status: string;
  town?: string;
  website?: string;
  email?: string;
  phone?: string;
}

async function searchSraFirms(
  location: string,
  page: number
): Promise<{ results: SraFirm[]; total: number }> {
  // SRA public API
  const url = `https://api.sra.org.uk/api/search/firms?q=&location=${encodeURIComponent(location)}&page=${page}&pageSize=20&status=active`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return { results: [], total: 0 };
    const data = (await res.json()) as { results: SraFirm[]; total?: number };
    return { results: data.results ?? [], total: data.total ?? 0 };
  } catch (err) {
    logger.warn("SRA API failed", { error: String(err), location });
    return { results: [], total: 0 };
  }
}

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
    logger.error("Failed to save SRA lead", { error, company: lead.company_name });
    return null;
  }
  return data.id;
}

export const lawSocietyUkScrape = schemaTask({
  id: "law-society-uk-scrape",
  schema: z.object({
    city: z.string(),
    userId: z.string(),
  }),
  machine: "small-1x",
  maxDuration: 240,
  run: async (payload) => {
    const { city, userId } = payload;
    logger.log(`Law Society UK scrape: ${city}`);

    let page = 1;
    let saved = 0;
    let skipped = 0;
    const maxPages = 5;

    while (page <= maxPages) {
      const { results, total } = await searchSraFirms(city, page);
      if (results.length === 0) break;

      for (const firm of results) {
        if (firm.status !== "active") {
          skipped++;
          continue;
        }

        const lead: RawLead = {
          company_name: firm.name,
          website: firm.website,
          niche: "law firm",
          country: "UK",
          city: firm.town || city,
          timezone: "Europe/London",
          dm_email: firm.email,
          source: "law_society_uk",
          source_url: `https://www.sra.org.uk/consumers/register/firm/?id=${firm.id}`,
          source_raw: firm as unknown as Record<string, unknown>,
          has_ssl: firm.website?.startsWith("https") ?? false,
        };

        const leadId = await saveLead(lead, userId);
        leadId ? saved++ : skipped++;
      }

      if (page * 20 >= total) break;
      page++;
    }

    logger.log(`Law Society UK ${city}: ${saved} saved, ${skipped} skipped`);
    return { saved, skipped, city };
  },
});

export { UK_CITIES_FOR_LAW };
