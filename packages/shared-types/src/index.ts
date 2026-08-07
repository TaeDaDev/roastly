import {z} from "zod";

// these are zod schemas, not just TS interfaces - the whole point is they're
// real runtime values I can call .parse() on to validate stuff coming back
// from Claude (or over the network from the extension), not just compile-time
// types that vanish once this gets built.

// file/line/codeSuggestion are optional because Claude doesn't always have
// something to say for every field - not every finding maps to an exact line
export const Finding = z.object({
  id: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  file: z.string().optional(),
  line: z.number().optional(),
  issue: z.string(),
  roastLine: z.string(),
  fix: z.string(),
  codeSuggestion: z.string().optional()
});

export const RoastResult = z.object({
  roast: z.string(),
  score: z.number(),
  findings: z.array(Finding)
});

// the schema (const) and the type (below) share the same name on purpose -
// they live in separate namespaces in TS so this doesn't collide, and it means
// every consumer just imports "Finding"/"RoastResult" without having to think
// about whether they want the value or the type
export type Finding = z.infer<typeof Finding>;
export type RoastResult = z.infer<typeof RoastResult>;

