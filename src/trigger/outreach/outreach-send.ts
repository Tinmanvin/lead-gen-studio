import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { supabase } from "../../lib/supabase-server.js";
import { getOrCreateCampaign, addLeadToSmartlead } from "../../lib/smartlead.js";

export const outreachSend = schemaTask({
  id: "outreach-send",
  schema: z.object({ leadId: z.string() }),
  machine: "micro",
  maxDuration: 30,
  run: async (payload) => {
    const { leadId } = payload;

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, company_name, dm_email, email_subject, email_body")
      .eq("id", leadId)
      .single();

    if (leadErr || !lead) {
      logger.warn("Lead not found", { leadId });
      return { success: false, reason: "lead_not_found" };
    }

    if (!lead.dm_email || !lead.email_body) {
      logger.warn("Lead missing email fields — skipping", { leadId });
      return { success: false, reason: "missing_email_fields" };
    }

    const campaignId = await getOrCreateCampaign("outreach");

    const result = await addLeadToSmartlead(campaignId, {
      email: lead.dm_email,
      firstName: "there",
      companyName: lead.company_name,
      subject: lead.email_subject ?? `Quick question about ${lead.company_name}`,
      body: lead.email_body,
    });

    if (!result.ok) {
      logger.error("Smartlead add failed", { leadId, error: result.error });
      return { success: false, reason: "smartlead_error", error: result.error };
    }

    await supabase
      .from("leads")
      .update({ status: "outreached", sent_at: new Date().toISOString(), sent_via: "smartlead" })
      .eq("id", leadId);

    logger.log(`Queued ${lead.dm_email} in Smartlead`, { company: lead.company_name, leadId });
    return { success: true, leadId, to: lead.dm_email };
  },
});
