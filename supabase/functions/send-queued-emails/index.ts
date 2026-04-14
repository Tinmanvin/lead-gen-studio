/**
 * send-queued-emails — Supabase Edge Function
 * Sends all status='approved' indeed_jobs via Gmail SMTP using app passwords.
 * Uses Deno.serve (NOT std/http/server.ts — causes BOOT_ERROR in newer Supabase).
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
    // 1. Fetch approved jobs
    const jobs = await dbGet("indeed_jobs?status=eq.approved&select=id,company_name,dm_email,email_subject,email_body&limit=100");

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "no_approved_jobs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch active email accounts under cap
    const accounts = await dbGet("email_accounts?active=eq.true&select=id,email,sent_today,daily_cap&order=sent_today.asc");
    const eligible = (Array.isArray(accounts) ? accounts : []).filter(
      (a: { sent_today: number; daily_cap: number }) => a.sent_today < a.daily_cap
    );

    if (!eligible.length) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "all_at_cap" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Build SMTP config map
    const smtpMap: Record<string, string> = {};
    const g1 = Deno.env.get("GMAIL_1") ?? "";
    const g1p = Deno.env.get("GMAIL_1_APP_PASSWORD") ?? "";
    const g2 = Deno.env.get("GMAIL_2") ?? "";
    const g2p = Deno.env.get("GMAIL_2_APP_PASSWORD") ?? "";
    if (g1 && g1p) smtpMap[g1] = g1p;
    if (g2 && g2p) smtpMap[g2] = g2p;

    // 4. Only use accounts that have SMTP credentials configured
    const sendableAccounts = eligible.filter((a: { email: string }) => !!smtpMap[a.email]);

    if (!sendableAccounts.length) {
      return new Response(JSON.stringify({ success: false, reason: "no_smtp_accounts_configured", smtpMapKeys: Object.keys(smtpMap) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send emails — track per-account counters to avoid stale sent_today
    let sent = 0;
    const results = [];
    const accountSentCounts: Record<string, number> = {};

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if (!job.dm_email || !job.email_subject || !job.email_body) {
        await dbPatch("indeed_jobs", job.id, { status: "skipped" });
        continue;
      }

      const account = sendableAccounts[i % sendableAccounts.length];
      const appPass = smtpMap[account.email];

      const result = await sendEmail(account.email, appPass, job.dm_email, job.email_subject, job.email_body);

      if (result.ok) {
        await dbPatch("indeed_jobs", job.id, {
          status: "sent",
          sent_at: new Date().toISOString(),
          sent_via: account.email,
        });
        // Track per-account sends to avoid stale counter
        accountSentCounts[account.id] = (accountSentCounts[account.id] ?? 0) + 1;
        await dbPatch("email_accounts", account.id, {
          sent_today: account.sent_today + accountSentCounts[account.id],
        });
        sent++;
        results.push({ jobId: job.id, ok: true, via: account.email });
      } else {
        results.push({ jobId: job.id, ok: false, via: account.email, error: result.error });
      }
    }

    return new Response(JSON.stringify({ success: true, sent, total: jobs.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
