/**
 * send-outreach-emails — Supabase Edge Function
 * Queues scored leads into Smartlead via the outreach-send-orchestrator Trigger.dev task.
 * Replaces direct Gmail SMTP sending — Smartlead handles delivery through warmed mailboxes.
 * Preserves the same request/response shape so the UI works unchanged.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TRIGGER_SECRET_KEY = Deno.env.get("TRIGGER_SECRET_KEY")!;

async function dbGet(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const excludeLeadIds: string[] = body.excludeLeadIds ?? [];
    const leadIds: string[] | null = body.leadIds ?? null;

    let rawLeads;
    if (leadIds && leadIds.length > 0) {
      const idList = leadIds.map((id: string) => `"${id}"`).join(",");
      rawLeads = await dbGet(
        `leads?id=in.(${idList})&dm_email=not.is.null&email_body=not.is.null&select=id`
      );
    } else {
      rawLeads = await dbGet(
        "leads?status=eq.scored&dm_email=not.is.null&email_body=not.is.null&select=id&limit=270"
      );
    }

    const leads = Array.isArray(rawLeads)
      ? rawLeads.filter((l: { id: string }) => !excludeLeadIds.includes(l.id))
      : [];

    if (leads.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "no_eligible_leads" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!TRIGGER_SECRET_KEY) {
      return new Response(JSON.stringify({ success: false, reason: "TRIGGER_SECRET_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const triggerRes = await fetch(
      "https://api.trigger.dev/api/v1/tasks/outreach-send-orchestrator/trigger",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TRIGGER_SECRET_KEY}`,
        },
        body: JSON.stringify({ payload: { leadIds: leads.map((l: { id: string }) => l.id) } }),
      }
    );

    if (!triggerRes.ok) {
      const err = await triggerRes.text();
      console.error("Trigger.dev error:", err);
      return new Response(JSON.stringify({ success: false, reason: "trigger_error", error: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const triggerData = await triggerRes.json();

    return new Response(
      JSON.stringify({ success: true, sent: leads.length, runId: triggerData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
