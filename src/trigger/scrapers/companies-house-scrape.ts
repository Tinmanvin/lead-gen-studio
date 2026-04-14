import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { supabase } from "../../lib/supabase-server.js";
import type { CompaniesHouseOfficer, RawLead } from "../../lib/types.js";

// UK niches that map well to Companies House SIC codes
const UK_NICHES = [
  { query: "mortgage broker", sic: "64920" },
  { query: "solicitor", sic: "69102" },
  { query: "dental practice", sic: "86230" },
  { query: "physiotherapy", sic: "86909" },
  { query: "estate agent", sic: "68310" },
  { query: "accountant", sic: "69201" },
  { query: "architect", sic: "71111" },
  { query: "electrical contractor", sic: "43210" },
  { query: "plumbing contractor", sic: "43220" },
];

const DECISION_MAKER_ROLES = [
  "director",
  "secretary",
  "managing director",
  "chief executive",
  "proprietor",
];

async function fetchCompanyOfficers(
  companyNumber: string,
  apiKey: string
): Promise<CompaniesHouseOfficer[]> {
  const url = `https://api.company-information.service.gov.uk/company/${companyNumber}/officers`;
  const auth = Buffer.from(`${apiKey}:`).toString("base64");

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    items?: CompaniesHouseOfficer[];
  };

  return (data.items ?? []).filter(
    (o) =>
      !o.resigned_on &&
      DECISION_MAKER_ROLES.some((role) =>
        o.officer_role.toLowerCase().includes(role)
      )
  );
}

async function searchCompanies(
  query: string,
  apiKey: string
): Promise<Array<{ company_number: string; title: string; company_status: string; registered_office_address?: { locality?: string } }>> {
  const url = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(query)}&items_per_page=20`;
  const auth = Buffer.from(`${apiKey}:`).toString("base64");

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    items?: Array<{
      company_number: string;
      title: string;
      company_status: string;
      registered_office_address?: { locality?: string };
    }>;
  };

  return (data.items ?? []).filter((c) => c.company_status === "active");
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

export const companiesHouseScrape = schemaTask({
  id: "companies-house-scrape",
  schema: z.object({
    niche: z.string(),
    userId: z.string(),
  }),
  machine: "small-1x",
  maxDuration: 180,
  run: async (payload) => {
    const { niche, userId } = payload;
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY!;

    logger.log(`Scraping Companies House: ${niche}`);

    const companies = await searchCompanies(niche, apiKey);
    logger.log(`Found ${companies.length} active companies for: ${niche}`);

    let saved = 0;
    let skipped = 0;

    for (const company of companies) {
      const officers = await fetchCompanyOfficers(company.company_number, apiKey);
      const dm = officers[0]; // First active decision maker

      const lead: RawLead = {
        company_name: company.title,
        niche,
        country: "UK",
        city: company.registered_office_address?.locality,
        timezone: "Europe/London",
        dm_name: dm?.name,
        dm_title: dm?.officer_role,
        source: "companies_house",
        source_url: `https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`,
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
    return { saved, skipped, niche };
  },
});

export { UK_NICHES };
