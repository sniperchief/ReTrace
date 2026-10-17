import "server-only";
import { z } from "zod";

const envSchema = z
  .object({
    MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, "must be a mongodb:// or mongodb+srv:// URI"),
    MONGODB_DB_NAME: z.string().min(1).default("retrace"),
    AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
    AUTH_URL: z.url().optional(),

    // AI-assisted entry: "off" (default) keeps the app fully manual; "remote" uses the
    // real self-hosted Whisper + Gemma service. There is deliberately no fake/mock mode.
    INFERENCE_MODE: z.enum(["off", "remote"]).default("off"),
    INFERENCE_BASE_URL: z.url().optional(),
    INFERENCE_API_KEY: z.string().min(32, "must be at least 32 characters").optional(),
    INFERENCE_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(290_000).default(270_000),
    MAX_AUDIO_BYTES: z.coerce.number().int().min(10_000).max(4_400_000).default(4_000_000),
    MAX_AUDIO_SECONDS: z.coerce.number().int().min(10).max(600).default(180),
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

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Validated server environment. Read lazily so `next build` doesn't need
 * secrets; the first request fails loudly if configuration is missing.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid server environment. See web/.env.example.\n${problems.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: forget the cached environment after changing process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}
