/**
 * send-queued-emails
 *
 * Supabase Edge Function — sends all status='approved' jobs directly via Gmail SMTP.
 * No Trigger.dev dependency. Called by the UI "Send Queued" button.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Job {
  id: string;
  company_name: string;
  dm_email: string;
  email_subject: string;
  email_body: string;
  status: string;
}

interface EmailAccount {
  id: string;
  email: string;
  sent_today: number;
  daily_cap: number;
}

// Send via Gmail SMTP using the gmail API-compatible approach with app passwords
// Uses fetch to call a simple SMTP relay via Deno SMTP
async function sendViaSmtp(
  fromEmail: string,
  appPassword: string,
  toEmail: string,
  subject: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Use Gmail's SMTP via the smtp Deno library
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: fromEmail,
          password: appPassword,
        },
      },
    });

    await client.send({
      from: `Atlas AI <${fromEmail}>`,
      to: toEmail,
      subject: subject,
      content: body,
    });

    await client.close();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch all approved jobs
  const { data: jobs, error: jobsErr } = await supabase
    .from("indeed_jobs")
    .select("id, company_name, dm_email, email_subject, email_body, status")
    .eq("status", "approved")
    .limit(100);

  if (jobsErr) {
    return new Response(
      JSON.stringify({ error: jobsErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!jobs || jobs.length === 0) {
    return new Response(
      JSON.stringify({ success: true, sent: 0, reason: "no_approved_jobs" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fetch active email accounts under cap
  const { data: accounts } = await supabase
    .from("email_accounts")
    .select("id, email, sent_today, daily_cap")
    .eq("active", true)
    .order("sent_today", { ascending: true });

  const eligible = ((accounts ?? []) as EmailAccount[]).filter(
    (a) => a.sent_today < a.daily_cap
  );

  if (!eligible.length) {
    return new Response(
      JSON.stringify({ success: true, sent: 0, reason: "all_accounts_at_cap" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Build SMTP config from env vars
  const smtpConfigs: Record<string, { appPassword: string; host: string }> = {};
  const gmail1 = Deno.env.get("GMAIL_1") ?? "";
  const gmail1Pass = Deno.env.get("GMAIL_1_APP_PASSWORD") ?? "";
  const gmail2 = Deno.env.get("GMAIL_2") ?? "";
  const gmail2Pass = Deno.env.get("GMAIL_2_APP_PASSWORD") ?? "";
  const zoho = Deno.env.get("ZOHO_EMAIL") ?? "";
  const zohoPass = Deno.env.get("ZOHO_PASSWORD") ?? "";

  if (gmail1 && gmail1Pass) smtpConfigs[gmail1] = { appPassword: gmail1Pass, host: "gmail" };
  if (gmail2 && gmail2Pass) smtpConfigs[gmail2] = { appPassword: gmail2Pass, host: "gmail" };
  if (zoho && zohoPass) smtpConfigs[zoho] = { appPassword: zohoPass, host: "zoho" };

  let sent = 0;
  let accountIdx = 0;
  const results: Array<{ jobId: string; ok: boolean; via?: string; error?: string }> = [];

  for (const job of jobs as Job[]) {
    if (!job.dm_email || !job.email_subject || !job.email_body) {
      await supabase.from("indeed_jobs").update({ status: "skipped" }).eq("id", job.id);
      continue;
    }

    // Round-robin through eligible accounts
    const account = eligible[accountIdx % eligible.length];
    if (account.sent_today >= account.daily_cap) {
      accountIdx++;
      continue;
    }

    const cfg = smtpConfigs[account.email];
    if (!cfg) {
      accountIdx++;
      continue;
    }

    const result = await sendViaSmtp(
      account.email,
      cfg.appPassword,
      job.dm_email,
      job.email_subject,
      job.email_body
    );

    if (result.ok) {
      await Promise.all([
        supabase
          .from("indeed_jobs")
          .update({ status: "sent", sent_at: new Date().toISOString(), sent_via: account.email })
          .eq("id", job.id),
        supabase
          .from("email_accounts")
          .update({ sent_today: account.sent_today + sent + 1 })
          .eq("id", account.id),
      ]);
      sent++;
      results.push({ jobId: job.id, ok: true, via: account.email });
    } else {
      results.push({ jobId: job.id, ok: false, error: result.error });
    }

    accountIdx++;
  }

  return new Response(
    JSON.stringify({ success: true, sent, total: jobs.length, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
