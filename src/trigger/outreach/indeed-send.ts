/**
 * Indeed Send — dispatches one queued outreach email via Gmail SMTP
 *
 * Picks up a single indeed_jobs record (status='queued'),
 * selects the least-used active email account that hasn't hit its daily cap,
 * sends via nodemailer + Gmail app password, then marks status='sent'.
 *
 * test_mode accounts still send — they're real addresses in controlled testing.
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import nodemailer from "nodemailer";
import { supabase } from "../../lib/supabase-server.js";

// ─── SMTP config per account ──────────────────────────────────────────────────
interface SmtpConfig { host: string; port: number; user: string; pass: string; }

function getSmtpConfig(email: string): SmtpConfig | null {
  const gmail1 = process.env.GMAIL_1 ?? "";
  const gmail2 = process.env.GMAIL_2 ?? "";
  const zoho   = process.env.ZOHO_EMAIL ?? "";

  if (email === gmail1 && process.env.GMAIL_1_APP_PASSWORD) {
    return { host: "smtp.gmail.com", port: 587, user: email, pass: process.env.GMAIL_1_APP_PASSWORD };
  }
  if (email === gmail2 && process.env.GMAIL_2_APP_PASSWORD) {
    return { host: "smtp.gmail.com", port: 587, user: email, pass: process.env.GMAIL_2_APP_PASSWORD };
  }
  if (email === zoho && process.env.ZOHO_PASSWORD) {
    return { host: "smtp.zoho.com", port: 587, user: email, pass: process.env.ZOHO_PASSWORD };
  }
  return null;
}

function buildTransport(email: string) {
  const cfg = getSmtpConfig(email);
  if (!cfg) throw new Error(`No SMTP config for ${email}`);
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: false,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

// ─── Pick the least-used active account under its cap ────────────────────────
async function pickSendAccount(): Promise<{
  id: string;
  email: string;
  sent_today: number;
  daily_cap: number;
} | null> {
  const { data, error } = await supabase
    .from("email_accounts")
    .select("id, email, sent_today, daily_cap")
    .eq("active", true)
    .order("sent_today", { ascending: true })
    .limit(10);

  // Filter: under cap + has a configured SMTP password
  const eligible = ((data ?? []) as Array<{ id: string; email: string; sent_today: number; daily_cap: number }>)
    .filter((a) => a.sent_today < a.daily_cap && getSmtpConfig(a.email) !== null);

  if (error || !eligible.length) return null;
  return eligible[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Task
// ─────────────────────────────────────────────────────────────────────────────

export const indeedSend = schemaTask({
  id: "indeed-send",
  schema: z.object({ jobId: z.string() }),
  machine: "micro",
  maxDuration: 30,
  run: async (payload) => {
    const { jobId } = payload;

    // Fetch job
    const { data: job, error: jobErr } = await supabase
      .from("indeed_jobs")
      .select("id, company_name, dm_email, email_subject, email_body, status")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      logger.warn("Job not found", { jobId });
      return { success: false, reason: "job_not_found" };
    }

    if (job.status !== "approved" && job.status !== "queued") {
      return { success: true, reason: "not_approved_for_sending" };
    }

    if (!job.dm_email || !job.email_subject || !job.email_body) {
      logger.warn("Job missing email fields — skipping", { jobId });
      await supabase.from("indeed_jobs").update({ status: "skipped" }).eq("id", jobId);
      return { success: false, reason: "missing_email_fields" };
    }

    // Pick sending account
    const account = await pickSendAccount();
    if (!account) {
      logger.warn("No email accounts available (all at cap)", { jobId });
      return { success: false, reason: "no_accounts_available" };
    }

    // Send
    const transport = buildTransport(account.email);

    try {
      await transport.sendMail({
        from: `Atlas AI <${account.email}>`,
        to: job.dm_email,
        subject: job.email_subject,
        text: job.email_body,
      });

      logger.log(`Sent to ${job.dm_email} via ${account.email}`, {
        company: job.company_name,
        jobId,
      });
    } catch (err) {
      logger.error("SMTP send failed", { jobId, account: account.email, error: String(err) });
      return { success: false, reason: "smtp_error", error: String(err) };
    }

    // Mark sent + increment account counter — both in parallel
    await Promise.all([
      supabase
        .from("indeed_jobs")
        .update({ status: "sent", sent_at: new Date().toISOString(), sent_via: account.email })
        .eq("id", jobId),
      supabase
        .from("email_accounts")
        .update({ sent_today: account.sent_today + 1 })
        .eq("id", account.id),
    ]);

    return { success: true, jobId, via: account.email, to: job.dm_email };
  },
});
