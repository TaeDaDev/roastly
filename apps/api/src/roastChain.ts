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

export async function roastCode(code: string): Promise<RoastResult> {
  const roastResult = await roastingModel.invoke(
    `Roast the following code and provide a score from 0 to 100, where 0 is the worst and 100 is the best. Also provide a list of findings with severity, file, line, issue, roastLine, fix, and codeSuggestion. Code: ${code}`,
  );

  return roastResult;
}
