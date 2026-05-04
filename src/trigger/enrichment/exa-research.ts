/**
 * Exa Research + Icebreaker Generation
 * Runs on top-scored leads (value_add_score >= 3) after scoring.
 * Uses Exa to research the company, then Claude to write a
 * personalised icebreaker referencing a specific detected pain.
 * This is what makes the outreach NOT look like bulk cold email.
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../../lib/supabase-server.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ExaResult {
  title?: string;
  url?: string;
  text?: string;
  author?: string;
  publishedDate?: string;
}

async function researchCompanyWithExa(
  companyName: string,
  website?: string
): Promise<string> {
  const exaApiKey = process.env.EXA_API_KEY;
  if (!exaApiKey) return "";

  const query = website
    ? `site:${website} OR "${companyName}" reviews OR projects OR news OR facebook OR instagram`
    : `"${companyName}" reviews OR news OR recent projects OR instagram`;

  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": exaApiKey,
      },
      body: JSON.stringify({
        query,
        num_results: 5,
        text: true,
        highlights: true,
        summary: true,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return "";

    const data = (await res.json()) as { results: ExaResult[] };
    const snippets = (data.results ?? [])
      .map((r) => r.text ?? "")
      .filter(Boolean)
      .slice(0, 3)
      .join("\n\n");

    return snippets.slice(0, 3000); // Cap context length
  } catch (err) {
    logger.warn("Exa research failed", { company: companyName, error: String(err) });
    return "";
  }
}

interface ChannelCopy {
  email_subject: string;
  email_body: string;
  linkedin_msg: string;
  whatsapp_msg: string;
  facebook_msg: string;
}

async function generateChannelCopy(
  companyName: string,
  dmName: string | null,
  niche: string,
  signals: string[],
  icebreaker: string,
  demoType: string
): Promise<ChannelCopy> {
  const name = dmName ?? "there";
  const signalList = signals.slice(0, 3).join(", ") || "missing key digital systems";
  const hasDemo = ["WIDGET", "REDESIGN", "NEW_SITE", "COMPOUND"].includes(demoType);

  const prompt = `You write multi-channel outreach copy for a cold outreach campaign. Write all 5 pieces below. Be concise, human, no fluff.

Context:
- Company: ${companyName}
- Niche: ${niche}
- Decision maker: ${name}
- Pain signals: ${signalList}
- Icebreaker (use this to open email): "${icebreaker}"
- Demo available: ${hasDemo ? "yes" : "no"}

Write exactly this JSON (no markdown, no extra text):
{
  "email_subject": "<10 words max, curiosity not clickbait>",
  "email_body": "<3-4 sentences. Start with icebreaker. Explain 1 specific gap. Soft ask for 10 min call. 80 words max.>",
  "linkedin_msg": "<connection request note, 280 chars max. Reference one specific signal. No pitch. End with question.>",
  "whatsapp_msg": "<casual 2-sentence intro. State you noticed something specific about their business. Ask if ok to share. 60 words max.>",
  "facebook_msg": "<friendly 2-sentence message. Reference their business by name. Ask one soft question. 50 words max.>"
}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    const parsed = JSON.parse(text) as ChannelCopy;
    return parsed;
  } catch (err) {
    logger.warn("Channel copy generation failed", { company: companyName, error: String(err) });
    return {
      email_subject: `Quick question about ${companyName}`,
      email_body: `${icebreaker}\n\nI work with ${niche} businesses on AI-powered systems that help capture and convert more leads. Worth a 10-minute chat?`,
      linkedin_msg: `Hi ${name}, I noticed ${signalList.split(",")[0]} at ${companyName}. Would love to connect and share something relevant.`,
      whatsapp_msg: `Hi ${name}, spotted something interesting about ${companyName}. Mind if I share a quick thought?`,
      facebook_msg: `Hi ${name}! I came across ${companyName} and noticed something worth mentioning. Happy to connect?`,
    };
  }
}

async function generateIcebreaker(
  companyName: string,
  dmName: string | null,
  niche: string,
  exaResearch: string
): Promise<string> {
  if (!exaResearch) return "";

  const prompt = `You write personalised cold email openers for a sales agency. Your only job is to write an icebreaker that sounds like the sender spent 5 minutes genuinely looking at this business before emailing. It must earn the next sentence — nothing more.

Company: ${companyName}
Niche: ${niche}
Decision maker: ${dmName ?? "the owner"}

Research found about this company:
${exaResearch}

Write 1–2 sentences. Rules:
- Reference ONE specific, real, observable thing from the research — an ad they're running, a project they completed, a review they received, something from their social media or website that genuinely stood out
- Sound like a human observation, not a system scan
- No emojis, no exclamation marks, no "I hope this finds you well"
- Do NOT mention AI, automation, or your company at all
- Do NOT reference technical gaps or problems — that is not your job here
- The icebreaker is purely about THEM — a genuine noticing

Good examples:
"Noticed you recently wrapped the Smith & Co office fitout — the exposed concrete finish on the reception looks sharp."
"Came across a review from a client who said you were the only plumber who actually showed up on time in three tries — that kind of rep is rare."
"Spotted your Meta ads for the summer campaign — the before and after creative is doing its job."
"Saw you just picked up the Henderson build — congrats, that one's been in the pipeline for a while from what I could tell."

Bad examples:
"I noticed your business could benefit from AI automation."
"Your website has some technical issues I could help with."
"Noticed calls going to voicemail after hours — wondered if that's something you've been looking at fixing."
"I saw your business and thought you might be interested in our services."

If the research contains nothing specific enough to reference, respond with exactly: NO_RESEARCH

Write only the icebreaker or NO_RESEARCH. Nothing else.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  return text === "NO_RESEARCH" ? "" : text;
}

export const exaResearch = schemaTask({
  id: "exa-research",
  schema: z.object({
    leadId: z.string(),
    userId: z.string(),
  }),
  machine: "small-1x",
  maxDuration: 120,
  run: async (payload) => {
    const { leadId, userId } = payload;

    // Fetch lead + score to confirm it's worth researching
    const [leadResult, scoreResult, signalsResult] = await Promise.all([
      supabase.from("leads").select("*").eq("id", leadId).eq("user_id", userId).single(),
      supabase.from("lead_scores").select("value_add_score, composite_score").eq("lead_id", leadId).single(),
      supabase.from("lead_signals").select("signal_type").eq("lead_id", leadId),
    ]);

    if (leadResult.error || !leadResult.data) return { success: false };

    const lead = leadResult.data;

    // Respect manual edits — never overwrite locked copy
    if ((lead as Record<string, unknown>).copy_locked) {
      logger.log(`Skipping Exa research for ${lead.company_name} — copy is locked`);
      return { success: false, reason: "copy_locked" };
    }

    const score = scoreResult.data;
    const signals = (signalsResult.data ?? []).map((s) => s.signal_type);

    // Only research leads with value_add_score >= 2 (worth personalising)
    if (!score || score.value_add_score < 2) {
      logger.log(`Skipping Exa research for ${lead.company_name} — score too low (${score?.value_add_score ?? 0})`);
      return { success: false, reason: "score_too_low" };
    }

    logger.log(`Researching ${lead.company_name} with Exa`);

    const exaResearchText = await researchCompanyWithExa(lead.company_name, lead.website);

    const icebreaker = await generateIcebreaker(
      lead.company_name,
      lead.dm_name,
      lead.niche ?? "business",
      exaResearchText,
    );

    if (icebreaker) {
      // Fetch demo_type to inform channel copy
      const demoType = (lead as Record<string, unknown>).demo_type as string ?? "EMAIL_ONLY";

      const channelCopy = await generateChannelCopy(
        lead.company_name,
        lead.dm_name,
        lead.niche ?? "business",
        signals,
        icebreaker,
        demoType,
      );

      await supabase
        .from("leads")
        .update({
          exa_research: exaResearchText || null,
          icebreaker,
          email_subject: channelCopy.email_subject,
          email_body: channelCopy.email_body,
          linkedin_msg: channelCopy.linkedin_msg,
          whatsapp_msg: channelCopy.whatsapp_msg,
          facebook_msg: channelCopy.facebook_msg,
        })
        .eq("id", leadId);

      logger.log(`Icebreaker + channel copy generated for ${lead.company_name}`);
      return { success: true, icebreaker };
    }

    return { success: false, reason: "generation_failed" };
  },
});
