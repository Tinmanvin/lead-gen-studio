const BASE = "https://server.smartlead.ai/api/v1";

function getApiKey(): string {
  const key = process.env.SMARTLEAD_API_KEY;
  if (!key) throw new Error("SMARTLEAD_API_KEY not configured");
  return key;
}

async function sl<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}api_key=${getApiKey()}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Smartlead ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export type CampaignSource = "indeed" | "outreach";

// Hardcoded IDs for known campaigns — bypasses name lookup and campaign creation entirely
const HARDCODED_IDS: Partial<Record<CampaignSource, number>> = {
  outreach: 3205641,
};

// In-memory cache for dynamically resolved campaigns (e.g. indeed)
const campaignCache = new Map<CampaignSource, number>();

export async function getOrCreateCampaign(source: CampaignSource): Promise<number> {
  if (HARDCODED_IDS[source]) return HARDCODED_IDS[source]!;
  if (campaignCache.has(source)) return campaignCache.get(source)!;

  const campaigns = await sl<{ id: number; name: string }[]>("/campaigns");
  const name = source === "indeed" ? "Atlas AI — Indeed Pipeline" : `Atlas AI — ${source} Pipeline`;

  const existing = campaigns.find((c) => c.id && c.name?.includes(source === "indeed" ? "Indeed" : source));
  if (existing) {
    campaignCache.set(source, existing.id);
    return existing.id;
  }

  const created = await sl<{ id: number }>("/campaigns/create", "POST", {
    name,
    client_id: null,
    scheduler_cron_value: {
      timezone: "UTC",
      days_of_the_week: [1, 2, 3, 4, 5],
      start_hour: "08:00",
      end_hour: "17:00",
      min_time_btw_emails: 60,
      max_new_leads_per_day: 300,
    },
    stop_lead_settings: "REPLY_TO_AN_EMAIL",
  });

  const campaignId = created.id;

  await sl(`/campaigns/${campaignId}/sequences`, "POST", {
    sequences: [
      {
        seq_number: 1,
        seq_delay_details: { delay_in_days: 0 },
        seq_variants: [
          {
            subject: "{{custom_subject}}",
            email_body: "<p style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a\">{{custom_body}}</p>",
            id: 0,
          },
        ],
      },
    ],
  });

  await sl(`/campaigns/${campaignId}/status`, "POST", { status: "ACTIVE" });

  campaignCache.set(source, campaignId);
  return campaignId;
}

export interface SmartleadLead {
  email: string;
  firstName: string;
  companyName: string;
  subject: string;
  body: string;
}

export interface SmartleadAddResult {
  ok: boolean;
  error?: string;
}

export async function addLeadToSmartlead(
  campaignId: number,
  lead: SmartleadLead
): Promise<SmartleadAddResult> {
  try {
    await sl(`/campaigns/${campaignId}/leads`, "POST", {
      lead_list: [
        {
          email: lead.email,
          first_name: lead.firstName,
          company_name: lead.companyName,
          custom_fields: {
            custom_subject: lead.subject,
            custom_body: lead.body,
          },
        },
      ],
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
