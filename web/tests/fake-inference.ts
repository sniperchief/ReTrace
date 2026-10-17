import { vi } from "vitest";
import { resetEnvCache } from "@/server/env";

export const INFERENCE_URL = "http://inference.test";
export const INFERENCE_KEY = "inference-test-key-inference-test-key-0";

/** Points the app at a fake inference service and returns a controllable fetch mock. */
export function useFakeInference() {
  process.env.INFERENCE_MODE = "remote";
  process.env.INFERENCE_BASE_URL = INFERENCE_URL;
  process.env.INFERENCE_API_KEY = INFERENCE_KEY;
  process.env.INFERENCE_TIMEOUT_MS = "5000";
  process.env.MAX_AUDIO_BYTES = "50000";
  resetEnvCache();

  const state = {
    transcribe: (): Response =>
      Response.json({ text: "Changed the spark plug, 1500 naira.", durationSec: 6, model: "whisper-small", processingMs: 900 }),
    extract: (): Response =>
      Response.json({
        content: JSON.stringify({
          repairDate: null,
          reportedSymptoms: null,
          diagnosis: null,
          workPerformed: "Changed the spark plug",
          partsReplaced: [{ name: "Spark plug", quantity: 1, costNaira: 1500 }],
          totalCostNaira: null,
          technicianNotes: null,
        }),
        model: "gemma-test",
        processingMs: 1200,
      }),
    calls: [] as { path: string; auth: string | null; body: unknown }[],
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.origin !== INFERENCE_URL) throw new Error(`unexpected fetch to ${url}`);
    const auth = new Headers(init?.headers).get("authorization");
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    state.calls.push({ path: url.pathname, auth, body });
    if (url.pathname === "/v1/transcribe") return state.transcribe();
    if (url.pathname === "/v1/extract") return state.extract();
    if (url.pathname === "/healthz") return Response.json({ status: "ok" });
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return state;
}

/** Minimal valid WebM header followed by padding. */
export function fakeWebm(size = 2000): Uint8Array {
  const data = new Uint8Array(size);
  data.set([0x1a, 0x45, 0xdf, 0xa3]);
  return data;
}
