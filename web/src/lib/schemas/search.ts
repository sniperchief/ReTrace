import { z } from "zod";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const dateOnly = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate")
    .refine((v) => new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v, "invalidDate")
    .optional(),
);

/** Repair search parameters from the URL. Unknown or malformed values are rejected, not guessed. */
export const repairSearchSchema = z
  .object({
    q: z.preprocess(blankToUndefined, z.string().trim().max(100, "tooLong").optional()),
    part: z.preprocess(blankToUndefined, z.string().trim().max(60, "tooLong").optional()),
    from: dateOnly,
    to: dateOnly,
    generator: z.preprocess(blankToUndefined, z.string().regex(/^[a-f\d]{24}$/i, "invalid").optional()),
  })
  .refine((s) => !s.from || !s.to || s.from <= s.to, { message: "dateRangeOrder", path: ["to"] });

export type RepairSearch = z.output<typeof repairSearchSchema>;

/** Reads one value from Next.js searchParams (arrays use the first value). */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isActiveSearch(s: RepairSearch): boolean {
  return Boolean(s.q || s.part || s.from || s.to || s.generator);
}
