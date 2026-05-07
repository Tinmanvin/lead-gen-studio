/**
 * Indeed Send Orchestrator
 *
 * Picks up all status='approved' jobs and fires individual indeed-send tasks
 * to queue them in Smartlead. Smartlead enforces the per-account daily limits.
 *
 * Runs on-demand (triggered from UI "Run Hijacker") or scheduled (9am UTC daily).
 */
import { task, batch, logger } from "@trigger.dev/sdk/v3";
import { indeedSend } from "./indeed-send.js";
import { supabase } from "../../lib/supabase-server.js";

const DAILY_CAP = 250;

export const indeedSendOrchestrator = task({
  id: "indeed-send-orchestrator",
  machine: "small-1x",
  maxDuration: 300,
  run: async () => {
    // How many have already been sent today
    const todayISO = new Date();
    todayISO.setHours(0, 0, 0, 0);
    const { count: sentToday } = await supabase
      .from("indeed_jobs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayISO.toISOString())
      .in("status", ["sent", "opened", "replied"]);

    const remaining = Math.max(0, DAILY_CAP - (sentToday ?? 0));
    if (remaining === 0) {
      logger.log("Daily cap already reached", { sentToday, DAILY_CAP });
      return { success: true, queued: 0 };
    }

    const { data: jobs, error } = await supabase
      .from("indeed_jobs")
      .select("id")
      .eq("status", "approved")
      .limit(remaining);

    if (error || !jobs?.length) {
      logger.log("No approved jobs to queue", { error: error?.message });
      return { success: true, queued: 0 };
    }

    logger.log(`Queuing ${jobs.length} jobs in Smartlead`);

    const sendJobs = jobs.map((job) => ({
      id: indeedSend.id,
      payload: { jobId: job.id },
    }));

    const chunkSize = 20;
    for (let i = 0; i < sendJobs.length; i += chunkSize) {
      await batch.trigger(sendJobs.slice(i, i + chunkSize));
    }

    return { success: true, queued: jobs.length };
  },
});
