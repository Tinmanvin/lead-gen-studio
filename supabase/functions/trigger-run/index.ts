import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Maps friendly task names → Trigger.dev task IDs
const TASK_MAP: Record<string, string> = {
  "main-scrape":    "daily-scrape-orchestrator",
  "main-enrich":    "enrich-new-leads",
  "indeed-scrape":  "indeed-hijacker-scrape-orchestrator",
  "indeed-enrich":  "indeed-hijacker-enrich-orchestrator",
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
    const taskId = TASK_MAP[task];

    if (!taskId) {
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

    const res = await fetch(
      `https://api.trigger.dev/api/v3/tasks/${taskId}/trigger`,
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

    if (!res.ok) {
      console.error("Trigger.dev error:", data);
      return new Response(
        JSON.stringify({ error: "Trigger.dev rejected the request", details: data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, taskId, runId: data.id }),
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
