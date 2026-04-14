import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { supabase } from "../../lib/supabase-server.js";
import type { SignalType } from "../../lib/types.js";
import { leadScorer } from "./lead-scorer.js";

async function checkTechStack(website: string): Promise<{
  has_chatbot: boolean;
  has_booking_link: boolean;
  has_tracking_pixel: boolean;
  is_wordpress: boolean;
  has_ssl: boolean;
  tech_stack: string[];
}> {
  const result = {
    has_chatbot: false,
    has_booking_link: false,
    has_tracking_pixel: false,
    is_wordpress: false,
    has_ssl: website.startsWith("https"),
    tech_stack: [] as string[],
  };

  try {
    const res = await fetch(website, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; bot/1.0)" },
      signal: AbortSignal.timeout(10000),
    });

    const html = await res.text();
    const lower = html.toLowerCase();

    // Chatbot detection
    if (
      lower.includes("intercom") ||
      lower.includes("tidio") ||
      lower.includes("drift") ||
      lower.includes("livechat") ||
      lower.includes("crisp") ||
      lower.includes("zendesk") ||
      lower.includes("tawk")
    ) {
      result.has_chatbot = true;
      result.tech_stack.push("live_chat");
    }

    // Booking link detection
    if (
      lower.includes("calendly") ||
      lower.includes("acuityscheduling") ||
      lower.includes("booksy") ||
      lower.includes("setmore") ||
      lower.includes("book online") ||
      lower.includes("book now") ||
      lower.includes("schedule") ||
      lower.includes("fresha")
    ) {
      result.has_booking_link = true;
    }

    // Tracking pixel detection
    if (
      lower.includes("gtag") ||
      lower.includes("google-analytics") ||
      lower.includes("fbq(") ||
      lower.includes("_fbq") ||
      lower.includes("hotjar")
    ) {
      result.has_tracking_pixel = true;
    }

    // WordPress detection
    if (lower.includes("wp-content") || lower.includes("wordpress")) {
      result.is_wordpress = true;
      result.tech_stack.push("wordpress");
    }

    // Ad platforms (indicates they're running ads)
    if (lower.includes("googletag") || lower.includes("adsbygoogle")) {
      result.tech_stack.push("google_ads");
    }
    if (lower.includes("fbq(") || lower.includes("facebook pixel")) {
      result.tech_stack.push("facebook_ads");
    }
  } catch (err) {
    logger.warn("Tech scan failed", { website, error: String(err) });
  }

  return result;
}

export const signalEnrichment = schemaTask({
  id: "signal-enrichment",
  schema: z.object({
    leadId: z.string(),
    userId: z.string(),
  }),
  machine: "small-1x",
  maxDuration: 120,
  run: async (payload) => {
    const { leadId, userId } = payload;

    const { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("user_id", userId)
      .single();

    if (error || !lead) {
      logger.error("Lead not found", { leadId });
      return { success: false };
    }

    const newSignals: Array<{ signal_type: SignalType; evidence: string }> = [];

    // Tech stack scan (if website exists)
    let techData = null;
    if (lead.website) {
      techData = await checkTechStack(lead.website);

      if (!techData.has_chatbot) {
        newSignals.push({
          signal_type: "no_chatbot",
          evidence: "No chatbot or live chat detected on website",
        });
      }

      if (!techData.has_booking_link) {
        newSignals.push({
          signal_type: "no_booking_link",
          evidence: "No booking or scheduling link detected on website",
        });
      }

      if (!techData.has_ssl) {
        newSignals.push({
          signal_type: "no_ssl",
          evidence: "Website does not use HTTPS",
        });
      }

      if (!techData.has_tracking_pixel) {
        newSignals.push({
          signal_type: "no_tracking_pixel",
          evidence: "No analytics or tracking pixel detected",
        });
      }

      if (techData.is_wordpress && !techData.has_chatbot) {
        newSignals.push({
          signal_type: "wordpress_no_chat",
          evidence: "WordPress site with no live chat — common pitch scenario",
        });
      }
    } else {
      // No website at all
      newSignals.push({
        signal_type: "no_chatbot",
        evidence: "No website found — no chatbot possible",
      });
    }

    // Save new signals (avoid dupes)
    if (newSignals.length > 0) {
      const { data: existing } = await supabase
        .from("lead_signals")
        .select("signal_type")
        .eq("lead_id", leadId);

      const existingTypes = new Set((existing ?? []).map((s) => s.signal_type));
      const toInsert = newSignals.filter((s) => !existingTypes.has(s.signal_type));

      if (toInsert.length > 0) {
        await supabase.from("lead_signals").insert(
          toInsert.map((s) => ({ ...s, lead_id: leadId }))
        );
      }
    }

    // Update lead with tech data
    const updateData: Record<string, unknown> = { status: "enriched" };
    if (techData) {
      updateData.has_chatbot = techData.has_chatbot;
      updateData.has_booking_link = techData.has_booking_link;
      updateData.has_tracking_pixel = techData.has_tracking_pixel;
      updateData.has_ssl = techData.has_ssl;
      updateData.tech_stack = techData.tech_stack;
    }

    await supabase.from("leads").update(updateData).eq("id", leadId);

    // Trigger scorer immediately after enrichment
    await leadScorer.trigger({ leadId, userId });

    logger.log(`Enriched lead ${leadId}: ${newSignals.length} new signals`);
    return { success: true, signalsAdded: newSignals.length };
  },
});
