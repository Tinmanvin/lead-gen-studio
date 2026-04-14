import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { supabase } from "../../lib/supabase-server.js";
import type { RawLead } from "../../lib/types.js";

// UK niches mapped to OpenCorporates-friendly search terms
const UK_NICHES = [
  { query: "mortgage broker" },
  { query: "solicitor" },
  { query: "dental practice" },
  { query: "physiotherapy" },
  { query: "estate agent" },
  { query: "accountant" },
  { query: "architect" },
  { query: "electrical contractor" },
  { query: "plumbing contractor" },
];

interface OpenCorporatesCompany {
  name: string;
  company_number: string;
  jurisdiction_code: string;
  current_status: string;
  registered_address?: {
    locality?: string;
    region?: string;
  };
  registered_address_in_full?: string;
  company_type?: string;
}

async function searchCompanies(
  query: string,
  page = 1
): Promise<OpenCorporatesCompany[]> {
  const url = new URL("https://api.opencorporates.com/v0.4/companies/search");
  url.searchParams.set("q", query);
  url.searchParams.set("jurisdiction_code", "gb");
  url.searchParams.set("inactive", "false");
  url.searchParams.set("per_page", "20");
  url.searchParams.set("page", String(page));

  const res = await fetch(url.toString());
  if (!res.ok) {
    logger.warn("OpenCorporates search failed", { status: res.status, query });
    return [];
  }

  const data = (await res.json()) as {
    results?: {
      companies?: Array<{ company: OpenCorporatesCompany }>;
    };
  };

  return (data.results?.companies ?? []).map((c) => c.company);
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
    logger.error("Failed to save lead", { error, company: lead.company_name });
    return null;
  }

  return data.id;
}

export const opencorporatesScrape = schemaTask({
  id: "opencorporates-scrape",
  schema: z.object({
    niche: z.string(),
    userId: z.string(),
    page: z.number().optional().default(1),
  }),
  machine: "small-1x",
  maxDuration: 180,
  run: async (payload) => {
    const { niche, userId, page } = payload;

    logger.log(`Scraping OpenCorporates (UK): ${niche} page ${page}`);

    const companies = await searchCompanies(niche, page);
    logger.log(`Found ${companies.length} active companies for: ${niche}`);

    let saved = 0;
    let skipped = 0;

    for (const company of companies) {
      const city =
        company.registered_address?.locality ??
        company.registered_address?.region;

      const lead: RawLead = {
        company_name: company.name,
        niche,
        country: "UK",
        city,
        timezone: "Europe/London",
        source: "opencorporates",
        source_url: `https://opencorporates.com/companies/gb/${company.company_number}`,
        source_raw: company as unknown as Record<string, unknown>,
      };

      const leadId = await saveLead(lead, userId);
      if (!leadId) {
        skipped++;
        continue;
      }

      saved++;
    }

    logger.log(`Done: ${saved} saved, ${skipped} skipped`);
    return { saved, skipped, niche, page };
  },
});

export { UK_NICHES };
