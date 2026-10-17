import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createCustomer } from "@/server/data/customers";
import { getDraft } from "@/server/data/drafts";
import { createGenerator } from "@/server/data/generators";
import { getRepairHistory } from "@/server/data/repairs";
import { handleVoiceNoteUpload } from "@/server/voice-notes";
import { fakeWebm, INFERENCE_KEY, useFakeInference } from "../fake-inference";
import { createTechnician, type TestTechnician } from "../helpers";

let fake: ReturnType<typeof useFakeInference>;
let a: TestTechnician;
let b: TestTechnician;
let generatorId: string;

function upload(cookie: string | null, body: Uint8Array, id = generatorId, type = "audio/webm") {
  const headers: Record<string, string> = { "content-type": type };
  if (cookie) headers.cookie = cookie;
  return handleVoiceNoteUpload(
    new Request(`http://localhost/api/generators/${id}/voice-notes`, { method: "POST", headers, body: body as BodyInit }),
    id,
  );
}

beforeAll(async () => {
  fake = useFakeInference();
  a = await createTechnician("Alpha");
  b = await createTechnician("Bravo");
  const customer = await createCustomer(a.id, { name: "Mama Bisi", phone: null, location: null, notes: null });
  generatorId = (
    await createGenerator(a.id, {
      customerId: customer.id,
      label: "Big Sumec",
      brand: null,
      model: null,
      serialNumber: null,
      capacityKva: null,
      fuelType: null,
      location: null,
    })
  ).id;
});

beforeEach(() => {
  fake.calls.length = 0;
});

describe("voice note upload", () => {
  it("requires a signed-in technician", async () => {
    const res = await upload(null, fakeWebm());
    expect(res.status).toBe(401);
    expect(fake.calls).toHaveLength(0);
  });

  it("refuses another technician's generator without calling the model", async () => {
    const res = await upload(b.cookie, fakeWebm());
    expect(res.status).toBe(404);
    expect(fake.calls).toHaveLength(0);
  });

  it("rejects oversized audio and non-audio files before transcription", async () => {
    expect((await upload(a.cookie, fakeWebm(60_000))).status).toBe(413);
    const pdf = new TextEncoder().encode("%PDF-1.7 not audio at all, just padding......");
    expect((await upload(a.cookie, pdf)).status).toBe(415);
    expect(fake.calls).toHaveLength(0);
  });

  it("transcribes, stores the transcript on a draft, and sends the API key server-side", async () => {
    const res = await upload(a.cookie, fakeWebm());
    expect(res.status).toBe(201);
    const body = (await res.json()) as { draftId: string; transcriptStatus: string };
    expect(body.transcriptStatus).toBe("done");
    expect(fake.calls[0]).toMatchObject({ path: "/v1/transcribe", auth: `Bearer ${INFERENCE_KEY}` });

    const draft = await getDraft(a.id, body.draftId);
    expect(draft?.source).toMatchObject({
      kind: "voice",
      transcriptStatus: "done",
      transcript: "Changed the spark plug, 1500 naira.",
      transcriptionModel: "whisper-small",
    });
    // The audio itself is not stored anywhere on the draft.
    expect(JSON.stringify(draft)).not.toContain("audio\":");
    // A draft is not a repair yet.
    expect(await getRepairHistory(a.id, generatorId)).toEqual([]);
  });

  it("records a failed transcription honestly and keeps the draft for manual entry", async () => {
    fake.transcribe = () => new Response("Service Unavailable", { status: 503 });
    const res = await upload(a.cookie, fakeWebm());
    const body = (await res.json()) as { draftId: string; transcriptStatus: string; error: string };
    expect(res.status).toBe(201);
    expect(body).toMatchObject({ transcriptStatus: "failed", error: "ai_unavailable" });

    const draft = await getDraft(a.id, body.draftId);
    expect(draft?.source).toMatchObject({ transcriptStatus: "failed", transcript: null, transcriptionError: "ai_unavailable" });
    expect(draft?.notesForExtraction).toBeNull();
  });

  it("treats an unreachable server, a timeout-like error and a malformed response as failures", async () => {
    fake.transcribe = () => {
      throw new TypeError("fetch failed");
    };
    let body = (await (await upload(a.cookie, fakeWebm())).json()) as { error: string };
    expect(body.error).toBe("ai_unavailable");

    fake.transcribe = () => Response.json({ unexpected: true });
    body = (await (await upload(a.cookie, fakeWebm())).json()) as { error: string };
    expect(body.error).toBe("ai_bad_response");

    fake.transcribe = () => Response.json({ text: "   ", durationSec: 3, model: "whisper-small", processingMs: 1 });
    body = (await (await upload(a.cookie, fakeWebm())).json()) as { error: string };
    expect(body.error).toBe("empty_transcript");
  });
});
