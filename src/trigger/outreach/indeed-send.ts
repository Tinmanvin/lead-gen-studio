/**
 * Indeed Send — queues one approved indeed_jobs record into Smartlead
 *
 * Picks up a single indeed_jobs record (status='approved'),
 * adds the lead to the Smartlead Indeed campaign, then marks status='queued'.
 * Smartlead handles actual delivery through the 12 warmed mailboxes.
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { supabase } from "../../lib/supabase-server.js";
import { getOrCreateCampaign, addLeadToSmartlead } from "../../lib/smartlead.js";

export const indeedSend = schemaTask({
  id: "indeed-send",
  schema: z.object({ jobId: z.string() }),
  machine: "micro",
  maxDuration: 30,
  run: async (payload) => {
    const { jobId } = payload;

    const { data: job, error: jobErr } = await supabase
      .from("indeed_jobs")
      .select("id, company_name, dm_email, email_subject, email_body, status")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      logger.warn("Job not found", { jobId });
      return { success: false, reason: "job_not_found" };
    }

    if (job.status !== "approved") {
      return { success: true, reason: "not_approved_for_sending" };
    }

    if (!job.dm_email || !job.email_subject || !job.email_body) {
      logger.warn("Job missing email fields — skipping", { jobId });
      await supabase.from("indeed_jobs").update({ status: "skipped" }).eq("id", jobId);
      return { success: false, reason: "missing_email_fields" };
    }

    const campaignId = await getOrCreateCampaign("indeed");

    const result = await addLeadToSmartlead(campaignId, {
      email: job.dm_email,
      firstName: "there",
      companyName: job.company_name,
      subject: job.email_subject,
      body: job.email_body,
    });

    if (!result.ok) {
      logger.error("Smartlead add failed", { jobId, error: result.error });
      return { success: false, reason: "smartlead_error", error: result.error };
    }

    await supabase
      .from("indeed_jobs")
      .update({ status: "queued", sent_at: new Date().toISOString() })
      .eq("id", jobId);

    logger.log(`Queued ${job.dm_email} in Smartlead`, { company: job.company_name, jobId });
    return { success: true, jobId, to: job.dm_email };
  },
});
