/**
 * Crunchbase Scraper — AU + UK
 * Source: Crunchbase API (free tier: 200 exports/month)
 * Covers: SaaS, tech startups, agencies — white-collar AI pitch
 * Method: Crunchbase Basic API
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { supabase } from "../../lib/supabase-server.js";
import type { RawLead, Country } from "../../lib/types.js";

const CRUNCHBASE_COUNTRY_CODES: Record<string, string> = {
  AU: "australia",
  UK: "united_kingdom",
};

interface CrunchbaseOrg {
  uuid: string;
  properties: {
    name: string;
    website_url?: string;
    short_description?: string;
    primary_job_title?: string;
    city_name?: string;
    country_code?: string;
    linkedin_url?: string;
    facebook_url?: string;
    twitter_url?: string;
    num_employees_enum?: string;
    founded_on?: { value: string };
  };
}

async function searchCrunchbase(
  countryCode: string,
  page: number,
  apiKey: string
): Promise<{ results: CrunchbaseOrg[]; total: number }> {
  const url = `https://api.crunchbase.com/api/v4/searches/organizations`;

  const body = {
    field_ids: [
      "name", "website_url", "short_description", "city_name",
      "country_code", "linkedin_url", "facebook_url",
      "num_employees_enum", "founded_on",
    ],
    query: [
      {
        type: "predicate",
        field_id: "location_identifiers",
        operator_id: "includes",
        values: [countryCode],
      },
      {
        type: "predicate",
        field_id: "facet_ids",
        operator_id: "includes",
        values: ["company"],
      },
    ],
    order: [{ field_id: "rank_org", sort: "asc" }],
    limit: 25,
    after_id: page > 1 ? ((page - 1) * 25).toString() : undefined,
  };

  try {
    const res = await fetch(`${url}?user_key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return { results: [], total: 0 };
    const data = (await res.json()) as {
      entities: CrunchbaseOrg[];
      count: number;
    };

    return { results: data.entities ?? [], total: data.count ?? 0 };
  } catch (err) {
    logger.warn("Crunchbase API failed", { error: String(err) });
    return { results: [], total: 0 };
  }
}

async function saveLead(lead: RawLead, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("company_name", lead.company_name)
    .eq("country", lead.country)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("leads")
    .insert({ ...lead, user_id: userId, status: "new" })
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to save Crunchbase lead", { error, company: lead.company_name });
    return null;
  }
  return data.id;
}

export const crunchbaseScrape = schemaTask({
  id: "crunchbase-scrape",
  schema: z.object({
    country: z.enum(["AU", "UK"]),
    userId: z.string(),
  }),
  machine: "small-1x",
  maxDuration: 240,
  run: async (payload) => {
    const { country, userId } = payload;
    const apiKey = process.env.CRUNCHBASE_API_KEY;

    if (!apiKey) {
      logger.warn("CRUNCHBASE_API_KEY not set — skipping");
      return { saved: 0, skipped: 0, reason: "no_api_key" };
    }

    const countryCode = CRUNCHBASE_COUNTRY_CODES[country];
    logger.log(`Crunchbase scrape: ${country}`);

    let page = 1;
    let saved = 0;
    let skipped = 0;
    const maxPages = 4; // Stay within free tier (200 limit)

    while (page <= maxPages) {
      const { results, total } = await searchCrunchbase(countryCode, page, apiKey);
      if (results.length === 0) break;

      for (const org of results) {
        const p = org.properties;
        if (!p.name) {
          skipped++;
          continue;
        }

        const timezone = country === "AU" ? "Australia/Sydney" : "Europe/London";

        const lead: RawLead = {
          company_name: p.name,
          website: p.website_url,
          niche: "tech / saas",
          country: country as Country,
          city: p.city_name,
          timezone,
          dm_linkedin_url: p.linkedin_url,
          dm_facebook_url: p.facebook_url,
          source: "crunchbase",
          source_url: `https://www.crunchbase.com/organization/${org.uuid}`,
          source_raw: p as unknown as Record<string, unknown>,
          has_ssl: p.website_url?.startsWith("https") ?? false,
        };

        const leadId = await saveLead(lead, userId);
        leadId ? saved++ : skipped++;
      }

      logger.log(`Crunchbase ${country} page ${page}: ${results.length} results`);
      if (page * 25 >= total) break;
      page++;
    }

    logger.log(`Crunchbase ${country}: ${saved} saved, ${skipped} skipped`);
    return { saved, skipped, country };
  },
});
