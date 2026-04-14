/**
 * Email Enrichment — Hunter.io
 * Runs after a lead is saved. Finds the decision maker's direct email
 * using Hunter.io domain search + person finder.
 * Updates lead record with dm_email if found.
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { supabase } from "../../lib/supabase-server.js";

interface HunterDomainResult {
  data: {
    emails: Array<{
      value: string;
      type: string;
      first_name?: string;
      last_name?: string;
      position?: string;
      confidence: number;
    }>;
    organization?: string;
  };
}

interface HunterPersonResult {
  data: {
    email?: string;
    score?: number;
  };
}

async function findEmailByDomain(
  domain: string,
  apiKey: string
): Promise<string | null> {
  const url = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}&limit=10`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const data = (await res.json()) as HunterDomainResult;
    const emails = data.data?.emails ?? [];

    // Prefer owner/director/manager level contacts
    const ownerEmails = emails.filter((e) => {
      const pos = (e.position ?? "").toLowerCase();
      return (
        pos.includes("owner") ||
        pos.includes("director") ||
        pos.includes("founder") ||
        pos.includes("manager") ||
        pos.includes("principal") ||
        e.type === "personal"
      );
    });

    const best = ownerEmails[0] ?? emails[0];
    if (best && best.confidence >= 50) return best.value;

    return null;
  } catch (err) {
    logger.warn("Hunter domain search failed", { domain, error: String(err) });
    return null;
  }
}

async function findEmailByPerson(
  firstName: string,
  lastName: string,
  domain: string,
  apiKey: string
): Promise<string | null> {
  const url = `https://api.hunter.io/v2/email-finder?first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&domain=${domain}&api_key=${apiKey}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const data = (await res.json()) as HunterPersonResult;
    if (data.data?.email && (data.data.score ?? 0) >= 50) {
      return data.data.email;
    }
    return null;
  } catch {
    return null;
  }
}

function extractDomain(website: string): string | null {
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export const emailEnrichment = schemaTask({
  id: "email-enrichment",
  schema: z.object({
    leadId: z.string(),
    userId: z.string(),
  }),
  machine: "micro",
  maxDuration: 60,
  run: async (payload) => {
    const { leadId, userId } = payload;
    const apiKey = process.env.HUNTER_API_KEY;

    if (!apiKey) {
      logger.warn("HUNTER_API_KEY not set — skipping email enrichment");
      return { success: false, reason: "no_api_key" };
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .select("id, dm_email, website, dm_name, company_name")
      .eq("id", leadId)
      .eq("user_id", userId)
      .single();

    if (error || !lead) return { success: false };

    // Already has email — nothing to do
    if (lead.dm_email) return { success: true, reason: "already_has_email" };

    // Need a website domain to search
    if (!lead.website) return { success: false, reason: "no_website" };

    const domain = extractDomain(lead.website);
    if (!domain) return { success: false, reason: "invalid_domain" };

    let email: string | null = null;

    // If we have a named DM, try person finder first (more accurate)
    if (lead.dm_name) {
      const parts = lead.dm_name.trim().split(" ");
      if (parts.length >= 2) {
        const firstName = parts[0];
        const lastName = parts[parts.length - 1];
        email = await findEmailByPerson(firstName, lastName, domain, apiKey);
      }
    }

    // Fallback to domain search
    if (!email) {
      email = await findEmailByDomain(domain, apiKey);
    }

    if (email) {
      await supabase
        .from("leads")
        .update({ dm_email: email })
        .eq("id", leadId);

      logger.log(`Email found for ${lead.company_name}: ${email}`);
      return { success: true, email };
    }

    logger.log(`No email found for ${lead.company_name} (${domain})`);
    return { success: false, reason: "not_found" };
  },
});
