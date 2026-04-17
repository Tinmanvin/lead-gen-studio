/**
 * send-outreach-emails — Supabase Edge Function
 * Sends all status='scored' leads that have dm_email + email_body populated.
 * Mirrors send-queued-emails exactly — same Gmail SMTP rotation, same daily cap logic.
 * Updates lead status to 'outreached' on success.
 */
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

async function dbPatch(table: string, id: string, data: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(data),
  });
}

async function sendEmail(
  fromEmail: string,
  appPassword: string,
  to: string,
  subject: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: fromEmail, password: appPassword },
      },
    });
    await client.send({ from: fromEmail, to, subject, content: body });
    await client.close();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Parse optional body params
    const body = await req.json().catch(() => ({}));
    const excludeLeadIds: string[] = body.excludeLeadIds ?? [];
    const leadIds: string[] | null = body.leadIds ?? null; // if set, only send these specific leads

    let rawLeads;
    if (leadIds && leadIds.length > 0) {
      // Selected mode — only fetch the specific lead IDs passed from the UI
      const idList = leadIds.map((id: string) => `"${id}"`).join(",");
      rawLeads = await dbGet(
        `leads?id=in.(${idList})&dm_email=not.is.null&email_body=not.is.null&select=id,company_name,dm_email,email_subject,email_body`
      );
    } else {
      // Batch mode — fetch all scored leads (450 cap = 3 accounts × 150)
      rawLeads = await dbGet(
        "leads?status=eq.scored&dm_email=not.is.null&email_body=not.is.null&select=id,company_name,dm_email,email_subject,email_body&limit=450"
      );
    }

    // Exclude hot leads pool to avoid duplicate outreach
    const leads = Array.isArray(rawLeads)
      ? rawLeads.filter((l: { id: string }) => !excludeLeadIds.includes(l.id))
      : [];

    if (leads.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "no_eligible_leads" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch active email accounts under cap
    const accounts = await dbGet(
      "email_accounts?active=eq.true&select=id,email,sent_today,daily_cap&order=sent_today.asc"
    );
    const eligible = (Array.isArray(accounts) ? accounts : []).filter(
      (a: { sent_today: number; daily_cap: number }) => a.sent_today < a.daily_cap
    );

    if (!eligible.length) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "all_at_cap" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Build SMTP config map from env vars
    const smtpMap: Record<string, string> = {};
    const g1 = Deno.env.get("GMAIL_1") ?? "";
    const g1p = Deno.env.get("GMAIL_1_APP_PASSWORD") ?? "";
    const g2 = Deno.env.get("GMAIL_2") ?? "";
    const g2p = Deno.env.get("GMAIL_2_APP_PASSWORD") ?? "";
    const g3 = Deno.env.get("GMAIL_3") ?? "";
    const g3p = Deno.env.get("GMAIL_3_APP_PASSWORD") ?? "";
    if (g1 && g1p) smtpMap[g1] = g1p;
    if (g2 && g2p) smtpMap[g2] = g2p;
    if (g3 && g3p) smtpMap[g3] = g3p;

    // 4. Only use accounts with SMTP credentials configured
    const sendableAccounts = eligible.filter((a: { email: string }) => !!smtpMap[a.email]);

    if (!sendableAccounts.length) {
      return new Response(
        JSON.stringify({ success: false, reason: "no_smtp_accounts_configured", smtpMapKeys: Object.keys(smtpMap) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Send emails — rotate accounts, track counters locally to avoid stale reads
    let sent = 0;
    const results = [];
    const accountSentCounts: Record<string, number> = {};

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      if (!lead.dm_email || !lead.email_body) {
        continue;
      }

      const subject = lead.email_subject ?? `Quick question about ${lead.company_name}`;
      const account = sendableAccounts[i % sendableAccounts.length];
      const appPass = smtpMap[account.email];

      const result = await sendEmail(account.email, appPass, lead.dm_email, subject, lead.email_body);

      if (result.ok) {
        await dbPatch("leads", lead.id, {
          status: "outreached",
          sent_at: new Date().toISOString(),
          sent_via: account.email,
        });
        accountSentCounts[account.id] = (accountSentCounts[account.id] ?? 0) + 1;
        await dbPatch("email_accounts", account.id, {
          sent_today: account.sent_today + accountSentCounts[account.id],
        });
        sent++;
        results.push({ leadId: lead.id, ok: true, via: account.email });
      } else {
        results.push({ leadId: lead.id, ok: false, via: account.email, error: result.error });
      }
    }

    return new Response(JSON.stringify({ success: true, sent, total: leads.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
