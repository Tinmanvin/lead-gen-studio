/**
 * Email Verification — MX + SMTP handshake
 *
 * Flow per email:
 *   1. Syntax check
 *   2. MX record lookup (eliminates dead domains instantly)
 *   3. Catch-all probe (random address → if 250, domain accepts everything)
 *   4. SMTP handshake on real address
 *
 * foundVia controls leniency on timeouts:
 *   'website' | 'exa'  → trust the source even if SMTP times out (it was found somewhere real)
 *   'pattern'          → must get explicit 250, otherwise reject
 */
import { promises as dns } from "node:dns";
import * as net from "node:net";
import { logger } from "@trigger.dev/sdk/v3";

export type EmailFoundVia = "website" | "exa" | "pattern";

export type EmailVerificationStatus =
  | "verified"        // SMTP confirmed 250
  | "catch_all"       // domain accepts any address (found on site = ok, pattern = skip)
  | "rejected"        // SMTP explicit 550/551/553
  | "invalid"         // no MX records — dead domain
  | "syntax_error"    // malformed email
  | "timeout";        // SMTP unreachable (cloud port-25 block or slow server)

export interface VerificationResult {
  shouldUse: boolean;
  status: EmailVerificationStatus;
  mxHost: string | null;
}

// ─── Syntax ───────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function validSyntax(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// ─── MX Lookup ────────────────────────────────────────────────────────────────

async function getMxHost(domain: string): Promise<string | null> {
  try {
    const records = await dns.resolveMx(domain);
    if (!records.length) return null;
    records.sort((a, b) => a.priority - b.priority);
    return records[0].exchange;
  } catch {
    return null;
  }
}

// ─── SMTP Handshake ───────────────────────────────────────────────────────────

const SMTP_TIMEOUT_MS = 8000;
const EHLO_DOMAIN = "mail.superatlas.com";
const MAIL_FROM = "noreply@superatlas.com";

type SmtpOutcome = "accepted" | "rejected" | "timeout";

function smtpHandshake(rcptTo: string, mxHost: string): Promise<SmtpOutcome> {
  return new Promise((resolve) => {
    let settled = false;

    function settle(outcome: SmtpOutcome) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(outcome);
    }

    const timer = setTimeout(() => settle("timeout"), SMTP_TIMEOUT_MS);

    const socket = net.createConnection({ host: mxHost, port: 25 });
    socket.setTimeout(SMTP_TIMEOUT_MS);

    let step = 0;
    let buf = "";

    // Parse SMTP response — multi-line ends when a line has CODE<space> (not CODE<dash>)
    function tryConsume() {
      const lines = buf.split("\r\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.length < 4) continue;
        const code = parseInt(line.slice(0, 3), 10);
        const separator = line[3];
        if (isNaN(code)) continue;
        if (separator === "-") continue; // multi-line continuation

        // Complete response received
        buf = lines.slice(i + 1).join("\r\n");

        if (step === 0) {
          // Banner (220)
          if (code === 220) {
            socket.write(`EHLO ${EHLO_DOMAIN}\r\n`);
            step = 1;
          } else {
            settle("timeout");
          }
        } else if (step === 1) {
          // EHLO response (250)
          if (code === 250) {
            socket.write(`MAIL FROM:<${MAIL_FROM}>\r\n`);
            step = 2;
          } else {
            settle("timeout");
          }
        } else if (step === 2) {
          // MAIL FROM response
          if (code === 250) {
            socket.write(`RCPT TO:<${rcptTo}>\r\n`);
            step = 3;
          } else {
            settle("timeout");
          }
        } else if (step === 3) {
          // RCPT TO response — the result we care about
          socket.write("QUIT\r\n");
          if (code >= 200 && code < 300) {
            settle("accepted");
          } else if (code === 550 || code === 551 || code === 552 || code === 553 || code === 554) {
            settle("rejected");
          } else {
            settle("timeout");
          }
        }
        break;
      }
    }

    socket.on("data", (chunk) => {
      buf += chunk.toString("ascii");
      tryConsume();
    });

    socket.on("error", () => settle("timeout"));
    socket.on("timeout", () => settle("timeout"));
    socket.on("close", () => { if (!settled) settle("timeout"); });
  });
}

// ─── Catch-All Probe ──────────────────────────────────────────────────────────

function randomAddress(domain: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `xvz-probe-${rand}@${domain}`;
}

async function isCatchAll(domain: string, mxHost: string): Promise<boolean> {
  const probe = randomAddress(domain);
  const result = await smtpHandshake(probe, mxHost);
  return result === "accepted";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function verifyEmail(
  email: string,
  foundVia: EmailFoundVia
): Promise<VerificationResult> {
  const trimmed = email.trim().toLowerCase();

  if (!validSyntax(trimmed)) {
    return { shouldUse: false, status: "syntax_error", mxHost: null };
  }

  const domain = trimmed.split("@")[1];
  const mxHost = await getMxHost(domain);

  if (!mxHost) {
    logger.log(`[verify] No MX for ${domain} — invalid`);
    return { shouldUse: false, status: "invalid", mxHost: null };
  }

  // Catch-all probe first — saves a handshake on pattern emails against catch-all servers
  const catchAll = await isCatchAll(domain, mxHost);

  if (catchAll) {
    logger.log(`[verify] ${domain} is catch-all — foundVia=${foundVia}`);
    // Website/exa emails are real finds even on catch-all domains; patterns are guesses
    const shouldUse = foundVia === "website" || foundVia === "exa";
    return { shouldUse, status: "catch_all", mxHost };
  }

  // Real SMTP check
  const outcome = await smtpHandshake(trimmed, mxHost);
  logger.log(`[verify] ${trimmed} → ${outcome} (via ${foundVia})`);

  if (outcome === "accepted") {
    return { shouldUse: true, status: "verified", mxHost };
  }

  if (outcome === "rejected") {
    return { shouldUse: false, status: "rejected", mxHost };
  }

  // Timeout — trust website/exa finds, reject pattern guesses
  const shouldUse = foundVia === "website" || foundVia === "exa";
  return { shouldUse, status: "timeout", mxHost };
}

/**
 * Verify a list of candidate emails (patterns) in order.
 * Returns the first one that passes, or null if all fail.
 * Stops as soon as a candidate is accepted — no wasted calls.
 */
export async function verifyFirstOf(
  candidates: string[],
  foundVia: EmailFoundVia
): Promise<{ email: string; result: VerificationResult } | null> {
  for (const email of candidates) {
    const result = await verifyEmail(email, foundVia);
    if (result.shouldUse) return { email, result };
  }
  return null;
}
