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
