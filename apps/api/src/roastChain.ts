import dotenv from "dotenv";
import { ChatAnthropic } from "@langchain/anthropic";
import { RoastResult } from "@roastly/shared-types";

dotenv.config();

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing ANTHROPIC_API_KEY in environment variables");
}
export const llm = new ChatAnthropic({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-sonnet-5",
});

export const roastingModel = llm.withStructuredOutput(RoastResult);

export async function roastCode(code: string): Promise<RoastResult> {
  const roastResult = await roastingModel.invoke(
    `Roast the following code and provide a score from 0 to 100, where 0 is the worst and 100 is the best. Also provide a list of findings with severity, file, line, issue, roastLine, fix, and codeSuggestion. Code: ${code}`,
  );

  return roastResult;
}
