import "server-only";
import { z } from "zod";
import { getEnv } from "./env";

/**
 * Client for the self-hosted inference service (Whisper + Gemma). Server-only:
 * the API key never reaches the browser. Every call has a timeout and every
 * response is validated; failures are reported, never papered over.
 */

export type InferenceErrorCode =
  | "ai_disabled"
  | "ai_unavailable"
  | "ai_timeout"
  | "audio_rejected"
  | "audio_too_long"
  | "ai_bad_response";

export class InferenceError extends Error {
  constructor(
    readonly code: InferenceErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "InferenceError";
  }
}

export function inferenceMode(): "off" | "remote" {
  return getEnv().INFERENCE_MODE;
}

const transcriptionSchema = z.object({
  text: z.string().max(20_000),
  durationSec: z.number().nonnegative(),
  model: z.string().max(100),
  processingMs: z.number().int().nonnegative(),
});
export type Transcription = z.infer<typeof transcriptionSchema>;

const generationSchema = z.object({
  content: z.string().max(50_000),
  model: z.string().max(100),
  processingMs: z.number().int().nonnegative(),
});
export type Generation = z.infer<typeof generationSchema>;

async function call(path: string, init: RequestInit): Promise<unknown> {
  const env = getEnv();
  if (env.INFERENCE_MODE !== "remote" || !env.INFERENCE_BASE_URL || !env.INFERENCE_API_KEY) {
    throw new InferenceError("ai_disabled");
  }
  let response: Response;
  try {
    response = await fetch(new URL(path, env.INFERENCE_BASE_URL), {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${env.INFERENCE_API_KEY}` },
      signal: AbortSignal.timeout(env.INFERENCE_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new InferenceError("ai_timeout");
    }
    throw new InferenceError("ai_unavailable");
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error pages (e.g. a sleeping host) are handled by status below.
  }
  if (response.ok) return body;

  const code = (body as { detail?: { code?: string } } | null)?.detail?.code;
  if (code === "audio_too_long") throw new InferenceError("audio_too_long");
  if (code === "invalid_audio" || code === "audio_too_large") throw new InferenceError("audio_rejected");
  if (response.status === 504 || code === "llm_timeout") throw new InferenceError("ai_timeout");
  if (response.status === 401) throw new InferenceError("ai_unavailable", "inference rejected the API key");
  throw new InferenceError("ai_unavailable", `inference returned ${response.status}`);
}

export async function transcribeAudio(audio: Uint8Array, contentType: string): Promise<Transcription> {
  const body = await call("/v1/transcribe", {
    method: "POST",
    headers: { "content-type": contentType || "application/octet-stream" },
    body: audio as BodyInit,
  });
  const parsed = transcriptionSchema.safeParse(body);
  if (!parsed.success) throw new InferenceError("ai_bad_response");
  return parsed.data;
}

export async function generateJson(instructions: string, text: string, schema: object): Promise<Generation> {
  const body = await call("/v1/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ instructions, text, schema }),
  });
  const parsed = generationSchema.safeParse(body);
  if (!parsed.success) throw new InferenceError("ai_bad_response");
  return parsed.data;
}

/** Fire-and-forget wake-up for a sleeping free host. */
export async function wakeInference(): Promise<void> {
  const env = getEnv();
  if (env.INFERENCE_MODE !== "remote" || !env.INFERENCE_BASE_URL) return;
  await fetch(new URL("/healthz", env.INFERENCE_BASE_URL), { signal: AbortSignal.timeout(5_000) }).catch(() => {});
}
