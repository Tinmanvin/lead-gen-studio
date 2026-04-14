import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { supabase } from "../../lib/supabase-server.js";
import type { DemoType, TouchpointTier } from "../../lib/types.js";

const LEAD_HEAVY_NICHES = [
  "mortgage broker",
  "dentist",
  "dental",
  "physiotherapist",
  "physio",
  "law firm",
  "solicitor",
  "personal injury",
  "property manager",
  "estate agent",
  "med spa",
  "aesthetic",
  "chiropractor",
  "solar",
  "roofing",
];

function isLeadHeavyNiche(niche: string): boolean {
  const lower = niche.toLowerCase();
  return LEAD_HEAVY_NICHES.some((n) => lower.includes(n));
}

function is24x7Niche(niche: string): boolean {
  const lower = niche.toLowerCase();
  return (
    lower.includes("plumber") ||
    lower.includes("electrician") ||
    lower.includes("locksmith") ||
    lower.includes("emergency") ||
    lower.includes("personal injury")
  );
}

function getTouchpointTier(lead: {
  dm_email?: string;
  dm_linkedin_url?: string;
  dm_whatsapp?: string;
  dm_facebook_url?: string;
}): { tier: TouchpointTier; touchpoints: string[] } {
  const touchpoints: string[] = [];

  if (lead.dm_email) touchpoints.push("email");
  if (lead.dm_linkedin_url) touchpoints.push("linkedin");
  if (lead.dm_whatsapp) touchpoints.push("whatsapp");
  if (lead.dm_facebook_url) touchpoints.push("facebook");

  let tier: TouchpointTier;
  if (touchpoints.includes("email") && touchpoints.includes("linkedin") &&
      (touchpoints.includes("whatsapp") || touchpoints.includes("facebook"))) {
    tier = touchpoints.length >= 4 ? "A" : "B";
  } else if (touchpoints.includes("email") && touchpoints.includes("linkedin")) {
    tier = "C";
  } else {
    tier = "D";
  }

  return { tier, touchpoints };
}

function classifyDemoType(lead: {
  website?: string;
  has_chatbot?: boolean;
  has_ssl?: boolean;
}, signals: string[]): DemoType {
  if (!lead.website) return "NEW_SITE";

  const noSsl = signals.includes("no_ssl");
  const noChatbot = signals.includes("no_chatbot");

  if (noSsl && noChatbot) return "COMPOUND";
  if (noSsl) return "REDESIGN";
  if (noChatbot) return "WIDGET";

  return "EMAIL_ONLY";
}

export const leadScorer = schemaTask({
  id: "lead-scorer",
  schema: z.object({
    leadId: z.string(),
    userId: z.string(),
  }),
  machine: "micro",
  maxDuration: 60,
  run: async (payload) => {
    const { leadId, userId } = payload;

    // Fetch lead + all signals
    const [leadResult, signalsResult] = await Promise.all([
      supabase.from("leads").select("*").eq("id", leadId).eq("user_id", userId).single(),
      supabase.from("lead_signals").select("signal_type").eq("lead_id", leadId),
    ]);

    if (leadResult.error || !leadResult.data) {
      logger.error("Lead not found for scoring", { leadId });
      return { success: false };
    }

    const lead = leadResult.data;
    const signalTypes = (signalsResult.data ?? []).map((s) => s.signal_type);

    const services: string[] = [];

    // 1. Lead Reactivation
    if (isLeadHeavyNiche(lead.niche ?? "")) {
      services.push("lead_reactivation");
    }

    // 2. Speed to Lead
    const hasAds = (lead.tech_stack as string[] ?? []).some((t) =>
      t.includes("ads")
    );
    if (hasAds && !lead.has_chatbot) {
      services.push("speed_to_lead");
    }

    // 3. Website Widget
    if (lead.website && !lead.has_chatbot) {
      services.push("website_widget");
    }

    // 4. Website Rebuild
    if (lead.website && !lead.has_ssl) {
      services.push("website_rebuild");
    }

    // 5. New Website
    if (!lead.website) {
      services.push("new_website");
    }

    // 6. Follow-Up Automation
    if (signalTypes.includes("missed_call")) {
      services.push("follow_up_automation");
    }

    // 7. After-Hours Automation
    if (signalTypes.includes("after_hours_gap") && is24x7Niche(lead.niche ?? "")) {
      services.push("after_hours_automation");
    }

    const valueAddScore = services.length;
    const { tier: touchpointTier, touchpoints } = getTouchpointTier(lead);
    const demoType = classifyDemoType(lead, signalTypes);

    // Composite score: value_add (primary) + touchpoint bonus
    const touchpointBonus = { A: 2, B: 1.5, C: 1, D: 0.5 }[touchpointTier];
    const compositeScore = valueAddScore + touchpointBonus;

    // Upsert score
    await supabase.from("lead_scores").upsert(
      {
        lead_id: leadId,
        value_add_score: valueAddScore,
        applicable_services: services,
        has_lead_reactivation: services.includes("lead_reactivation"),
        has_speed_to_lead: services.includes("speed_to_lead"),
        has_website_widget: services.includes("website_widget"),
        has_website_rebuild: services.includes("website_rebuild"),
        has_new_website: services.includes("new_website"),
        has_follow_up_automation: services.includes("follow_up_automation"),
        has_after_hours_automation: services.includes("after_hours_automation"),
        touchpoint_tier: touchpointTier,
        touchpoints_available: touchpoints,
        composite_score: compositeScore,
        scored_at: new Date().toISOString(),
      },
      { onConflict: "lead_id" }
    );

    // Update lead status + demo type
    await supabase
      .from("leads")
      .update({ status: "scored", demo_type: demoType })
      .eq("id", leadId);

    logger.log(`Scored lead ${leadId}: ${valueAddScore} services, tier ${touchpointTier}, demo: ${demoType}`);
    return { success: true, valueAddScore, touchpointTier, demoType, compositeScore };
  },
});
