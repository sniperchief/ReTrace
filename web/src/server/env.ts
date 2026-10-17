import "server-only";
import { z } from "zod";

// Values pasted into hosting dashboards often carry stray spaces or quotes.
const cleaned = (v: unknown) => (typeof v === "string" ? v.trim().replace(/^["']|["']$/g, "") || undefined : v);
const text = <T extends z.ZodType>(schema: T) => z.preprocess(cleaned, schema);

/** Required for the app to run at all. Missing or invalid values stop the server with a clear error. */
const coreSchema = z.object({
  MONGODB_URI: text(z.string().regex(/^mongodb(\+srv)?:\/\//, "must be a mongodb:// or mongodb+srv:// URI")),
  MONGODB_DB_NAME: text(z.string().min(1).default("retrace")),
  AUTH_SECRET: text(z.string().min(32, "must be at least 32 characters")),
  AUTH_URL: text(z.url().optional()),
  MAX_AUDIO_BYTES: z.coerce.number().int().min(10_000).max(4_400_000).default(4_000_000),
  MAX_AUDIO_SECONDS: z.coerce.number().int().min(10).max(600).default(180),
});

/**
 * AI-assisted entry: "off" (default) keeps the app fully manual; "remote" uses the
 * real self-hosted Whisper + Gemma service. There is deliberately no fake/mock mode.
 * A mistake here must not take the whole site down, so an invalid AI setup is
 * logged and the AI is switched off instead (sign-in, records and rule-based
 * quick notes keep working).
 */
const inferenceSchema = z
  .object({
    INFERENCE_MODE: text(z.enum(["off", "remote"]).default("off")),
    INFERENCE_BASE_URL: text(z.url().optional()),
    INFERENCE_API_KEY: text(z.string().min(32, "must be at least 32 characters").optional()),
    INFERENCE_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(290_000).default(270_000),
  })
  .superRefine((env, ctx) => {
    if (env.INFERENCE_MODE !== "remote") return;
    if (!env.INFERENCE_BASE_URL) {
      ctx.addIssue({ code: "custom", path: ["INFERENCE_BASE_URL"], message: "required when INFERENCE_MODE=remote" });
    }
    if (!env.INFERENCE_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["INFERENCE_API_KEY"], message: "required when INFERENCE_MODE=remote" });
    }
  });

export type Env = z.infer<typeof coreSchema> &
  z.infer<typeof inferenceSchema> & {
    /** Set when the AI settings were invalid and the AI was turned off because of it. */
    INFERENCE_CONFIG_ERRORS?: string[];
  };

let cached: Env | undefined;

const describe = (error: z.ZodError) => error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);

/**
 * Validated server environment. Read lazily so `next build` doesn't need
 * secrets; the first request fails loudly if core configuration is missing.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const core = coreSchema.safeParse(process.env);
  if (!core.success) {
    throw new Error(`Invalid server environment. See web/.env.example.\n${describe(core.error).join("\n")}`);
  }
  const inference = inferenceSchema.safeParse(process.env);
  if (inference.success) {
    cached = { ...core.data, ...inference.data };
  } else {
    const problems = describe(inference.error);
    console.error(`AI settings are invalid, so AI-assisted entry is OFF. See web/.env.example.\n${problems.join("\n")}`);
    cached = {
      ...core.data,
      INFERENCE_MODE: "off",
      INFERENCE_TIMEOUT_MS: 270_000,
      INFERENCE_CONFIG_ERRORS: problems,
    };
  }
  return cached;
}

/** Test helper: forget the cached environment after changing process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}
