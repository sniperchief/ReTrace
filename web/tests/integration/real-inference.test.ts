// Opt-in: runs the real upload → Whisper → Gemma → review → confirm path against a running
// inference service. Skipped unless REAL_INFERENCE_URL, REAL_INFERENCE_KEY and
// REAL_INFERENCE_SAMPLE (path to an audio file) are set.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/server/env";
import { createTechnician } from "../helpers";

const url = process.env.REAL_INFERENCE_URL;
const key = process.env.REAL_INFERENCE_KEY;
const sample = process.env.REAL_INFERENCE_SAMPLE;

let currentCookie = "";
vi.mock("next/headers", () => ({
  headers: async () => new Headers(currentCookie ? { cookie: currentCookie } : {}),
  cookies: async () => ({ get: () => undefined, set: () => {}, getAll: () => [] }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error(`REDIRECT:${to}`), { digest: `NEXT_REDIRECT;${to}` });
  },
  notFound: () => {
    throw Object.assign(new Error("NOT_FOUND"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

describe.skipIf(!url || !key || !sample)("real inference service", () => {
  it(
    "transcribes a real recording, suggests fields, and saves only after confirmation",
    async () => {
      process.env.INFERENCE_MODE = "remote";
      process.env.INFERENCE_BASE_URL = url;
      process.env.INFERENCE_API_KEY = key;
      process.env.INFERENCE_TIMEOUT_MS = "280000";
      resetEnvCache();

      const { handleVoiceNoteUpload } = await import("@/server/voice-notes");
      const actions = await import("@/server/actions/drafts");
      const { getDraft } = await import("@/server/data/drafts");
      const { createCustomer } = await import("@/server/data/customers");
      const { createGenerator } = await import("@/server/data/generators");
      const { getRepairHistory } = await import("@/server/data/repairs");
      const { toRepairFormValues } = await import("@/lib/repair-form");

      const tech = await createTechnician("Real");
      currentCookie = tech.cookie;
      const customer = await createCustomer(tech.id, { name: "Test", phone: null, location: null, notes: null });
      const generator = await createGenerator(tech.id, {
        customerId: customer.id,
        label: "Test generator",
        brand: null,
        model: null,
        serialNumber: null,
        capacityKva: null,
        fuelType: null,
        location: null,
      });

      const audio = readFileSync(sample!);
      const started = Date.now();
      const res = await handleVoiceNoteUpload(
        new Request("http://localhost/x", {
          method: "POST",
          headers: { cookie: tech.cookie, "content-type": "audio/webm" },
          body: audio,
        }),
        generator.id,
      );
      const body = (await res.json()) as { draftId: string; transcriptStatus: string; error?: string };
      const transcribedAt = Date.now();
      expect(body.transcriptStatus, body.error).toBe("done");

      const outcome = await actions.runExtractionAction(body.draftId);
      const extractedAt = Date.now();
      expect(outcome).toEqual({ status: "done" });

      const draft = await getDraft(tech.id, body.draftId);
      expect(draft?.aiSuggestion?.status).toBe("done");
      expect(await getRepairHistory(tech.id, generator.id)).toEqual([]); // not saved yet

      // Confirm exactly what was suggested, as a technician accepting it unchanged would.
      const values = toRepairFormValues(draft!.aiSuggestion!.status === "done" ? draft!.aiSuggestion!.fields : null);
      const fd = new FormData();
      for (const [k, v] of Object.entries(values)) if (k !== "parts") fd.append(k, v as string);
      for (const p of values.parts) {
        fd.append("partName", p.name);
        fd.append("partQuantity", p.quantity);
        fd.append("partCost", p.cost);
      }
      fd.append("confirmed", "on");
      await expect(actions.confirmDraftAction(body.draftId, {}, fd)).rejects.toThrow("REDIRECT");
      const history = await getRepairHistory(tech.id, generator.id);
      expect(history).toHaveLength(1);

      console.log(
        JSON.stringify(
          {
            transcript: draft?.source.kind === "voice" ? draft.source.transcript : null,
            suggestion: draft?.aiSuggestion,
            transcribeMs: transcribedAt - started,
            extractMs: extractedAt - transcribedAt,
            saved: history?.[0],
          },
          null,
          2,
        ),
      );
    },
    600_000,
  );
});
