/**
 * Outreach Send Orchestrator
 *
 * Picks up scored leads (with email) and fires individual outreach-send tasks
 * to queue them in Smartlead. Smartlead enforces the per-account daily limits.
 *
 * Accepts optional leadIds to process a specific subset (selected mode from UI).
 * With no leadIds, fetches all status='scored' leads up to DAILY_CAP.
 */
import { task, batch, logger } from "@trigger.dev/sdk/v3";
import { outreachSend } from "./outreach-send.js";
import { supabase } from "../../lib/supabase-server.js";

const DAILY_CAP = 270;

export const outreachSendOrchestrator = task({
  id: "outreach-send-orchestrator",
  machine: "small-1x",
  maxDuration: 300,
  run: async (payload: { leadIds?: string[] }) => {
    let leadIds = payload?.leadIds;

    if (!leadIds || leadIds.length === 0) {
      const { data: leads, error } = await supabase
        .from("leads")
        .select("id")
        .eq("status", "scored")
        .not("dm_email", "is", null)
        .not("email_body", "is", null)
        .limit(DAILY_CAP);

      if (error || !leads?.length) {
        logger.log("No scored leads to queue", { error: error?.message });
        return { success: true, queued: 0 };
      }

      leadIds = leads.map((l) => l.id);
    }

    logger.log(`Queuing ${leadIds.length} leads in Smartlead`);

    const sendJobs = leadIds.map((leadId) => ({
      id: outreachSend.id,
      payload: { leadId },
    }));

    const chunkSize = 20;
    for (let i = 0; i < sendJobs.length; i += chunkSize) {
      await batch.trigger(sendJobs.slice(i, i + chunkSize));
    }

    return { success: true, queued: leadIds.length };
  },
});
