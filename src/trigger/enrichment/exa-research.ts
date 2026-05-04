/**
 * Exa Research + Icebreaker Generation + Email Assembly
 * Runs on top-scored leads (value_add_score >= 2) after scoring.
 * 1. Exa researches the company (web, reviews, social, news)
 * 2. Claude writes a personalised icebreaker — research-first, purely about them
 * 3. Email assembled from the user's outreach template via variable substitution
 *    — no Claude involved in body copy, template is source of truth
 */
import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../../lib/supabase-server.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Auto-populated into {{demo_one_liner}} in templates when a demo has been built
const DEMO_ONE_LINERS: Record<string, string> = {
  widget:     "built a live AI chat widget for your site that captures enquiries around the clock",
  redesign:   "put together a refreshed version of your site to show what it could look like",
  new_site:   "built you a starter site so you can see what an online presence looks like",
  compound:   "rebuilt your site and added a live AI chat widget capturing leads 24/7",
  email_only: "",
};

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

    return snippets.slice(0, 3000);
  } catch (err) {
    logger.warn("Exa research failed", { company: companyName, error: String(err) });
    return "";
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

function substituteVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

async function fetchOutreachTemplate(
  userId: string,
  demoType: string
): Promise<{ subject_template: string; body_prompt: string } | null> {
  const { data } = await supabase
    .from("outreach_templates")
    .select("subject_template, body_prompt")
    .eq("user_id", userId)
    .eq("demo_type", demoType)
    .eq("active", true)
    .limit(1)
    .single();
  return data ?? null;
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

    const [leadResult, scoreResult] = await Promise.all([
      supabase.from("leads").select("*").eq("id", leadId).eq("user_id", userId).single(),
      supabase.from("lead_scores").select("value_add_score, composite_score").eq("lead_id", leadId).single(),
    ]);

    if (leadResult.error || !leadResult.data) return { success: false };

    const lead = leadResult.data;

    if ((lead as Record<string, unknown>).copy_locked) {
      logger.log(`Skipping — copy locked for ${lead.company_name}`);
      return { success: false, reason: "copy_locked" };
    }

    const score = scoreResult.data;
    if (!score || score.value_add_score < 2) {
      logger.log(`Skipping — score too low for ${lead.company_name} (${score?.value_add_score ?? 0})`);
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

    // Normalise demo_type: scorer writes uppercase (WIDGET), templates store lowercase (widget)
    const rawDemoType = (lead as Record<string, unknown>).demo_type as string ?? "EMAIL_ONLY";
    const demoType = rawDemoType.toLowerCase();
    const demoUrl = (lead as Record<string, unknown>).demo_url as string | null ?? null;
    const demoOneLiner = DEMO_ONE_LINERS[demoType] ?? "";
    const needsDemo = demoType !== "email_only";

    // Demo-type leads must wait for demo_url before email can be assembled
    if (needsDemo && !demoUrl) {
      await supabase
        .from("leads")
        .update({
          exa_research: exaResearchText || null,
          icebreaker: icebreaker || null,
        })
        .eq("id", leadId);

      logger.log(`Icebreaker saved for ${lead.company_name} — awaiting demo_url (${demoType})`);
      return { success: true, reason: "awaiting_demo", icebreaker };
    }

    // Fetch the outreach template for this demo type
    const template = await fetchOutreachTemplate(userId, demoType);
    if (!template) {
      logger.warn(`No active template for demo_type=${demoType}, user=${userId}`);
      return { success: false, reason: "no_template" };
    }

    const fullName = lead.dm_name ?? "";
    const firstName = fullName.split(" ")[0] || "there";

    const vars: Record<string, string> = {
      icebreaker:     icebreaker || "",
      first_name:     firstName,
      company:        lead.company_name ?? "",
      company_name:   lead.company_name ?? "",
      dm_name:        fullName || "there",
      niche:          lead.niche ?? "business",
      demo_url:       demoUrl ?? "",
      demo_one_liner: demoOneLiner,
    };

    const emailBody    = substituteVars(template.body_prompt, vars);
    const emailSubject = substituteVars(template.subject_template, vars);

    await supabase
      .from("leads")
      .update({
        exa_research:   exaResearchText || null,
        icebreaker:     icebreaker || null,
        demo_one_liner: demoOneLiner || null,
        email_body:     emailBody,
        email_subject:  emailSubject,
      })
      .eq("id", leadId);

    logger.log(`Email assembled from template for ${lead.company_name} (${demoType})`);
    return { success: true, icebreaker, demoType };
  },
});
