/**
 * One-shot script: re-triggers lead-scorer for all scored leads
 * so lead_scores table gets populated (now that UNIQUE constraint is fixed)
 */
const SUPABASE_URL = "https://bdwapihepqfjazyybcwu.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TRIGGER_KEY = process.env.TRIGGER_SECRET_KEY;
const USER_ID = "328c34e6-41a1-428c-8e6a-f86daf95aa29";

if (!SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}
if (!TRIGGER_KEY) {
  console.error("Set TRIGGER_SECRET_KEY env var");
  process.exit(1);
}

async function getLeadIds(offset, limit) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/leads?select=id&status=eq.scored&offset=${offset}&limit=${limit}`,
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
  );
  return res.json();
}

async function batchTriggerScorer(leadIds) {
  const items = leadIds.map(({ id }) => ({
    payload: { leadId: id, userId: USER_ID },
  }));

  const res = await fetch("https://api.trigger.dev/api/v1/tasks/lead-scorer/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TRIGGER_KEY}`,
    },
    body: JSON.stringify({ items }),
  });

  const data = await res.json();
  return { ok: res.ok, count: items.length, data };
}

async function main() {
  let offset = 0;
  const pageSize = 100;
  let total = 0;

  console.log("Re-scoring all leads...");

  while (true) {
    const leads = await getLeadIds(offset, pageSize);
    if (!leads?.length) break;

    const result = await batchTriggerScorer(leads);
    total += leads.length;
    console.log(`Triggered ${total} leads so far... (batch ok: ${result.ok})`);

    if (leads.length < pageSize) break;
    offset += pageSize;

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`Done. ${total} lead-scorer tasks triggered.`);
}

main().catch(console.error);
