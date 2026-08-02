import {z} from "zod";


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

export type Finding = z.infer<typeof Finding>;
export type RoastResult = z.infer<typeof RoastResult>;

