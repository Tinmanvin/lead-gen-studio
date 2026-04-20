import { createClient } from "@supabase/supabase-js";

type SmartleadEventType =
  | "EMAIL_SENT"
  | "EMAIL_OPENED"
  | "EMAIL_CLICKED"
  | "EMAIL_REPLIED"
  | "EMAIL_BOUNCED"
  | "EMAIL_UNSUBSCRIBED";

const EVENT_TO_STATUS: Partial<Record<SmartleadEventType, string>> = {
  EMAIL_SENT: "sent",
  EMAIL_OPENED: "opened",
  EMAIL_CLICKED: "clicked",
  EMAIL_REPLIED: "replied",
  EMAIL_BOUNCED: "bounced",
  EMAIL_UNSUBSCRIBED: "unsubscribed",
};

function getDb() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = process.env.SMARTLEAD_WEBHOOK_SECRET;
  if (secret) {
    const incoming = req.headers.get("x-smartlead-secret");
    if (incoming !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const eventType = body.event_type as SmartleadEventType | undefined;
  const leadEmail = body.to_email as string | undefined;

  if (!eventType || !leadEmail) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const status = EVENT_TO_STATUS[eventType];
  if (!status) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const db = getDb();

  // Update indeed_jobs if the lead exists there
  await db
    .from("indeed_jobs")
    .update({
      status,
      ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}),
    })
    .eq("dm_email", leadEmail.toLowerCase());

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
