/**
 * AHPRA Scraper — Australia
 * Source: Australian Health Practitioner Regulation Agency
 * Covers: GPs, dentists, physiotherapists, chiropractors, optometrists,
 *         psychologists, nurses, pharmacists, aesthetics practitioners
 * Method: Paginated search via AHPRA's public practitioner register API
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { supabase } from "../../lib/supabase-server.js";
import type { RawLead } from "../../lib/types.js";

// AHPRA profession codes mapped to our niches
const AHPRA_PROFESSIONS = [
  { code: "DEN", niche: "dentist", profession: "Dental" },
  { code: "PHY", niche: "physiotherapist", profession: "Physiotherapy" },
  { code: "CHI", niche: "chiropractor", profession: "Chiropractic" },
  { code: "MED", niche: "gp clinic", profession: "Medical" },
  { code: "OPT", niche: "optometrist", profession: "Optometry" },
  { code: "PSY", niche: "psychologist", profession: "Psychology" },
  { code: "POD", niche: "podiatrist", profession: "Podiatry" },
  { code: "OST", niche: "osteopath", profession: "Osteopathy" },
];

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

interface AhpraPractitioner {
  RegistrationNumber: string;
  FirstName: string;
  FamilyName: string;
  ProfessionType: string;
  RegistrationStatus: string;
  PrincipalPlaceOfPractice: string;
  State: string;
}

async function searchAhpra(
  profession: string,
  state: string,
  page: number
): Promise<{ results: AhpraPractitioner[]; total: number }> {
  const url = `https://www.ahpra.gov.au/Registration/Registers-of-Practitioners.aspx`;
  // AHPRA uses a form-based search — we use their public search endpoint
  const searchUrl = `https://www.ahpra.gov.au/api/v1/practitioner/search?professionType=${profession}&state=${state}&page=${page}&pageSize=20&registrationStatus=Current`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return { results: [], total: 0 };
    const data = (await res.json()) as { results: AhpraPractitioner[]; totalCount: number };
    return { results: data.results ?? [], total: data.totalCount ?? 0 };
  } catch {
    return { results: [], total: 0 };
  }
}

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
    logger.error("Failed to save AHPRA lead", { error, company: lead.company_name });
    return null;
  }
  return data.id;
}

export const ahpraScrape = schemaTask({
  id: "ahpra-scrape",
  schema: z.object({
    professionCode: z.string(),
    niche: z.string(),
    state: z.string(),
    userId: z.string(),
  }),
  machine: "small-1x",
  maxDuration: 240,
  run: async (payload) => {
    const { professionCode, niche, state, userId } = payload;
    logger.log(`AHPRA scrape: ${niche} in ${state}`);

    let page = 1;
    let saved = 0;
    let skipped = 0;

    while (true) {
      const { results, total } = await searchAhpra(professionCode, state, page);
      if (results.length === 0) break;

      for (const practitioner of results) {
        if (practitioner.RegistrationStatus !== "Current") {
          skipped++;
          continue;
        }

        // Use practice location as company name proxy
        const companyName = practitioner.PrincipalPlaceOfPractice ||
          `${practitioner.FirstName} ${practitioner.FamilyName} — ${niche}`;

        const lead: RawLead = {
          company_name: companyName,
          niche,
          country: "AU",
          city: state,
          timezone: stateToTimezone(state),
          dm_name: `${practitioner.FirstName} ${practitioner.FamilyName}`,
          dm_title: niche.charAt(0).toUpperCase() + niche.slice(1),
          source: "ahpra",
          source_url: `https://www.ahpra.gov.au/Registration/Registers-of-Practitioners.aspx`,
          source_raw: practitioner as unknown as Record<string, unknown>,
        };

        const leadId = await saveLead(lead, userId);
        leadId ? saved++ : skipped++;
      }

      logger.log(`AHPRA ${niche}/${state} page ${page}: ${results.length} results (${total} total)`);

      // Stop if we've fetched all pages or hit 5 pages max per run
      if (page * 20 >= total || page >= 5) break;
      page++;
    }

    return { saved, skipped, niche, state };
  },
});

function stateToTimezone(state: string): string {
  const map: Record<string, string> = {
    NSW: "Australia/Sydney",
    VIC: "Australia/Melbourne",
    QLD: "Australia/Brisbane",
    WA: "Australia/Perth",
    SA: "Australia/Adelaide",
    TAS: "Australia/Hobart",
    ACT: "Australia/Sydney",
    NT: "Australia/Darwin",
  };
  return map[state] ?? "Australia/Sydney";
}

export { AHPRA_PROFESSIONS, AU_STATES };
