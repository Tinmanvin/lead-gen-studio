/**
 * FCA Register Scraper — UK
 * Source: Financial Conduct Authority register (free, no auth required for basic search)
 * Covers: Mortgage brokers, IFAs, financial advisers — UK's highest-value niche
 * Method: FCA public API — no Playwright needed
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { supabase } from "../../lib/supabase-server.js";
import type { RawLead } from "../../lib/types.js";

const FCA_NICHES = [
  { query: "mortgage broker", niche: "mortgage broker", activity: "arranging mortgages" },
  { query: "financial adviser", niche: "financial adviser", activity: "advising on investments" },
  { query: "mortgage advice", niche: "mortgage adviser", activity: "mortgage advice" },
  { query: "insurance broker", niche: "insurance broker", activity: "insurance mediation" },
];

const UK_CITIES = [
  "London", "Manchester", "Birmingham", "Leeds", "Bristol",
  "Sheffield", "Liverpool", "Edinburgh", "Glasgow", "Cardiff",
  "Leicester", "Coventry", "Nottingham", "Reading", "Brighton",
];

interface FcaFirm {
  FRN: string;
  Name: string;
  Status: string;
  Address?: {
    "Address Line 1"?: string;
    Town?: string;
    Postcode?: string;
  };
  Websites?: string[];
  Email?: string;
  Phone?: string;
}

async function searchFcaFirms(
  query: string,
  page: number
): Promise<{ results: FcaFirm[]; total: number }> {
  // FCA public register API
  const url = `https://register.fca.org.uk/services/V0.1/Firms?q=${encodeURIComponent(query)}&page=${page}&per_page=20&status=Authorised`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Auth-Email": "",
        "X-Auth-Key": "",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return { results: [], total: 0 };
    const data = (await res.json()) as { Data: FcaFirm[]; ResultInfo?: { total_size?: number } };
    return {
      results: data.Data ?? [],
      total: data.ResultInfo?.total_size ?? 0,
    };
  } catch (err) {
    logger.warn("FCA API request failed", { error: String(err) });
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
    logger.error("Failed to save FCA lead", { error, company: lead.company_name });
    return null;
  }
  return data.id;
}

export const fcaRegisterScrape = schemaTask({
  id: "fca-register-scrape",
  schema: z.object({
    query: z.string(),
    niche: z.string(),
    userId: z.string(),
  }),
  machine: "small-1x",
  maxDuration: 240,
  run: async (payload) => {
    const { query, niche, userId } = payload;
    logger.log(`FCA Register scrape: ${niche}`);

    let page = 1;
    let saved = 0;
    let skipped = 0;
    const maxPages = 10; // 200 firms max per niche per run

    while (page <= maxPages) {
      const { results, total } = await searchFcaFirms(query, page);
      if (results.length === 0) break;

      for (const firm of results) {
        if (firm.Status !== "Authorised") {
          skipped++;
          continue;
        }

        const website = firm.Websites?.[0];
        const city = firm.Address?.Town;

        const lead: RawLead = {
          company_name: firm.Name,
          website,
          niche,
          country: "UK",
          city,
          timezone: "Europe/London",
          dm_email: firm.Email,
          source: "fca_register",
          source_url: `https://register.fca.org.uk/s/firm?id=${firm.FRN}`,
          source_raw: firm as unknown as Record<string, unknown>,
          has_ssl: website?.startsWith("https") ?? false,
        };

        const leadId = await saveLead(lead, userId);
        leadId ? saved++ : skipped++;
      }

      logger.log(`FCA ${niche} page ${page}: ${results.length} results`);

      if (page * 20 >= total) break;
      page++;
    }

    logger.log(`FCA ${niche}: ${saved} saved, ${skipped} skipped`);
    return { saved, skipped, niche };
  },
});

export { FCA_NICHES };
