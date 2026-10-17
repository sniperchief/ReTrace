import { z } from "zod";
import { parseNairaToKobo } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";

// Error messages are codes; the UI translates them via `messages.errors`.

const blankToNull = (value: unknown) =>
  value === undefined || (typeof value === "string" && value.trim() === "") ? null : value;

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "invalid");

export const requiredText = (max: number) =>
  z
    .string({ error: "required" })
    .trim()
    .min(1, "required")
    .max(max, "tooLong");

/** Optional free text: blank becomes null. */
export const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max, "tooLong").nullable());

export const optionalPhone = z.preprocess(
  blankToNull,
  z
    .string()
    .nullable()
    .transform((value, ctx) => {
      if (value === null) return null;
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "invalidPhone" });
        return z.NEVER;
      }
      return phone;
    }),
);

/** Naira amount typed by the user → integer kobo (or null when blank). */
export const optionalNairaAmount = z.preprocess(
  blankToNull,
  z
    .string()
    .nullable()
    .transform((value, ctx) => {
      if (value === null) return null;
      const kobo = parseNairaToKobo(value);
      if (kobo === null) {
        ctx.addIssue({ code: "custom", message: "invalidAmount" });
        return z.NEVER;
      }
      return kobo;
    }),
);

export const optionalNumber = (min: number, max: number, message = "invalidNumber") =>
  z.preprocess(
    (value) => {
      const v = blankToNull(value);
      return typeof v === "string" ? Number(v.replace(/,/g, "")) : v;
    },
    z.number(message).min(min, message).max(max, message).nullable(),
  );

/** "YYYY-MM-DD" from a date input → UTC midnight Date (or null when blank). */
export const optionalDateOnly = z.preprocess(
  blankToNull,
  z
    .string()
    .nullable()
    .transform((value, ctx) => {
      if (value === null) return null;
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      const date = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
      if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        ctx.addIssue({ code: "custom", message: "invalidDate" });
        return z.NEVER;
      }
      // Allow one day of slack for time zones.
      if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        ctx.addIssue({ code: "custom", message: "futureDate" });
        return z.NEVER;
      }
      return date;
    }),
);

export type FieldErrors = Record<string, string[] | undefined>;

/** Field → error codes, using dotted paths for nested fields ("parts.0.name"). */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
