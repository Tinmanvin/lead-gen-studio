/**
 * Indeed Send Orchestrator
 *
 * Picks up all status='queued' jobs, calculates remaining capacity across
 * email accounts, and fires individual indeed-send tasks up to the cap.
 *
 * Runs on-demand (triggered from UI "Run Hijacker" → Edge Function TASK_MAP)
 * or can be scheduled (e.g. 9am UTC daily).
 */
import { task, batch, logger } from "@trigger.dev/sdk/v3";
import { indeedSend } from "./indeed-send.js";
import { supabase } from "../../lib/supabase-server.js";

export const indeedSendOrchestrator = task({
  id: "indeed-send-orchestrator",
  machine: "small-1x",
  maxDuration: 300,
  run: async () => {
    // How much capacity do we have across active accounts?
    const { data: accounts } = await supabase
      .from("email_accounts")
      .select("sent_today, daily_cap")
      .eq("active", true);

    const totalCapacity = (accounts ?? []).reduce(
      (sum, a) => sum + Math.max(0, (a.daily_cap as number) - (a.sent_today as number)),
      0
    );

    if (totalCapacity <= 0) {
      logger.log("All email accounts at daily cap — nothing to send");
      return { success: true, sent: 0, reason: "all_accounts_at_cap" };
    }

    logger.log(`Total send capacity: ${totalCapacity}`);

    // Fetch approved jobs up to capacity (user queued via Queue button in UI → status='approved')
    const { data: jobs, error } = await supabase
      .from("indeed_jobs")
      .select("id")
      .eq("status", "approved")
      .limit(totalCapacity);

    if (error || !jobs?.length) {
      logger.log("No queued jobs to send", { error: error?.message });
      return { success: true, sent: 0 };
    }

    logger.log(`Firing ${jobs.length} send tasks`);

    const sendJobs = jobs.map((job) => ({
      id: indeedSend.id,
      payload: { jobId: job.id },
    }));

    // Batch in chunks of 20
    const chunkSize = 20;
    for (let i = 0; i < sendJobs.length; i += chunkSize) {
      await batch.trigger(sendJobs.slice(i, i + chunkSize));
    }

    return { success: true, sent: jobs.length };
  },
});
