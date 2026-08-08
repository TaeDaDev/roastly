import dotenv from "dotenv";
import { ChatAnthropic } from "@langchain/anthropic";
import { RoastResult } from "@roastly/shared-types";

dotenv.config();

// fail loud and immediate at startup if the key's missing instead of letting
// `undefined` sneak into ChatAnthropic and blow up later with some cryptic
// auth error - this also lets TS narrow ANTHROPIC_API_KEY to `string` below,
// since exactOptionalPropertyTypes won't accept `string | undefined` here
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing ANTHROPIC_API_KEY in environment variables");
}
export const llm = new ChatAnthropic({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-sonnet-5",
});

// this is the actual core of the whole project - binding the RoastResult zod
// schema to the model means Claude's response gets parsed/validated against
// that shape automatically, so .invoke() below returns a real typed
// RoastResult instead of me having to hand-parse a wall of text
export const roastingModel = llm.withStructuredOutput(RoastResult);

// created a fancier version that also asked for a "mentorship"
// section (root-cause themes, what you did well, next skill to practice) -
// keeping that idea for later once there's a sidebar panel to actually show
// it in. for now the schema only has roast/score/findings, so the prompt
// only asks for that  

export async function roastCode(code: string): Promise<RoastResult> {
  const roastResult = await roastingModel.invoke(
    `You are Roastly — a savage-but-brilliant senior engineer who roasts code and helps the developer behind it get better. The roast entertains; the fix and issue explanations stay clear, specific, and genuinely useful.

Analyze the code below and return:
- roast: a punchy, funny, top-level narrative roast of the code as a whole
- score: 0-100, holistic code quality (0 = worst, 100 = best)
- findings: a list of specific issues, each with:
  - severity: "critical" | "high" | "medium" | "low"
  - file and line, if applicable
  - issue: a plain, specific description of the problem (professional, no jokes here)
  - roastLine: one witty burn about this specific issue — punchy, never cruel about the person
  - fix: what to change, in words
  - codeSuggestion: a corrected snippet, minimal diff, same language

Keep the roast tone in roast and roastLine only. issue and fix stay clear and professional — the contrast is intentional. Assume an intermediate developer; skip beginner-level explanations and focus on what's non-obvious.

Code:
${code}`,
  );

  return roastResult;
}
