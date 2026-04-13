import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Maps friendly task names → one or more Trigger.dev task IDs
const TASK_MAP: Record<string, string[]> = {
  "main-full-run":    ["daily-scrape-orchestrator", "enrich-new-leads"],
  "indeed-full-run":  ["indeed-hijacker-scrape-orchestrator"],
  "indeed-send":      ["indeed-send-orchestrator"],
  "main-scrape":      ["daily-scrape-orchestrator"],
  "main-enrich":      ["enrich-new-leads"],
  "indeed-scrape":    ["indeed-hijacker-scrape-orchestrator"],
  "indeed-enrich":    ["indeed-hijacker-enrich-orchestrator"],
};

// Minimal ScheduledPayload — our orchestrators only log this, don't depend on it
function scheduledPayload() {
  const now = new Date().toISOString();
  return {
    timestamp: now,
    lastTimestamp: null,
    externalId: null,
    timezone: "UTC",
    scheduleId: "manual-trigger",
    upcoming: [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { task } = await req.json() as { task: string };
    const taskIds = TASK_MAP[task];

    if (!taskIds) {
      return new Response(
        JSON.stringify({ error: `Unknown task: ${task}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("TRIGGER_SECRET_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "TRIGGER_SECRET_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = await Promise.all(
      taskIds.map(async (taskId) => {
        const res = await fetch(
          `https://api.trigger.dev/api/v1/tasks/${taskId}/trigger`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ payload: scheduledPayload() }),
          }
        );
        const data = await res.json();
        return { taskId, ok: res.ok, status: res.status, runId: data.id, error: data.error ?? null };
      })
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      console.error("Trigger.dev errors:", failed);
      return new Response(
        JSON.stringify({ error: "One or more tasks failed to trigger", details: failed }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, runs: results.map((r) => ({ taskId: r.taskId, runId: r.runId })) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("trigger-run error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
