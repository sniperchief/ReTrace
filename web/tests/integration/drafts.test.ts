import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeWebm, useFakeInference } from "../fake-inference";
import { createTechnician, type TestTechnician } from "../helpers";

let currentCookie = "";
vi.mock("next/headers", () => ({
  headers: async () => new Headers(currentCookie ? { cookie: currentCookie } : {}),
  cookies: async () => ({ get: () => undefined, set: () => {}, getAll: () => [] }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`REDIRECT:${url}`), { digest: `NEXT_REDIRECT;${url}` });
  },
  notFound: () => {
    throw Object.assign(new Error("NOT_FOUND"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const actions = await import("@/server/actions/drafts");
const { createCustomer } = await import("@/server/data/customers");
const { createGenerator, getGenerator } = await import("@/server/data/generators");
const drafts = await import("@/server/data/drafts");
const { getRepair, getRepairHistory, listRecentRepairs, updateRepair } = await import("@/server/data/repairs");
const { handleVoiceNoteUpload } = await import("@/server/voice-notes");
const { NotFoundError } = await import("@/server/data/errors");

let fake: ReturnType<typeof useFakeInference>;
let a: TestTechnician;
let b: TestTechnician;
let generatorId: string;

function form(entries: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

async function voiceDraft(): Promise<string> {
  const res = await handleVoiceNoteUpload(
    new Request("http://localhost/x", { method: "POST", headers: { cookie: a.cookie }, body: fakeWebm() as BodyInit }),
    generatorId,
  );
  return ((await res.json()) as { draftId: string }).draftId;
}

const reviewedForm = (extra: [string, string][] = []) =>
  form([
    ["repairDate", "2026-10-01"],
    ["reportedSymptoms", ""],
    ["diagnosis", "Dead plug"],
    ["workPerformed", "Changed the spark plug"],
    ["totalCost", ""],
    ["technicianNotes", ""],
    ["partName", "Spark plug"],
    ["partQuantity", "1"],
    ["partCost", "1500"],
    ...extra,
  ]);

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
  currentCookie = a.cookie;
  fake.calls.length = 0;
});

describe("AI extraction on a draft", () => {
  it("stores a validated suggestion but does not fill or confirm the record", async () => {
    const id = await voiceDraft();
    await expect(actions.runExtractionAction(id)).resolves.toEqual({ status: "done" });

    const extractCall = fake.calls.find((c) => c.path === "/v1/extract")!;
    expect((extractCall.body as { text: string }).text).toContain("Changed the spark plug, 1500 naira.");
    expect((extractCall.body as { schema: { required: string[] } }).schema.required).toContain("totalCostNaira");

    const draft = await drafts.getDraft(a.id, id);
    expect(draft?.aiSuggestion).toMatchObject({
      status: "done",
      model: "gemma-test",
      fields: { workPerformed: "Changed the spark plug", partsReplaced: [{ name: "Spark plug", quantity: 1, costKobo: 150_000 }] },
    });
    const record = await getRepair(a.id, id);
    expect(record).toMatchObject({ status: "draft", workPerformed: null, partsReplaced: [] });
    expect(await getRepairHistory(a.id, generatorId)).toEqual([]);
    expect(await listRecentRepairs(a.id)).toEqual([]);
  });

  it("does not run twice for the same draft", async () => {
    const id = await voiceDraft();
    await actions.runExtractionAction(id);
    await expect(actions.runExtractionAction(id)).resolves.toEqual({ status: "skipped" });
    expect(fake.calls.filter((c) => c.path === "/v1/extract")).toHaveLength(1);
  });

  it("records malformed model output as a failure, with nothing filled in", async () => {
    fake.extract = () => Response.json({ content: "Sure! Here are the details: plug changed", model: "gemma-test", processingMs: 5 });
    const id = await voiceDraft();
    await expect(actions.runExtractionAction(id)).resolves.toEqual({ status: "failed", error: "malformed_output" });
    expect((await drafts.getDraft(a.id, id))?.aiSuggestion).toMatchObject({ status: "failed", error: "malformed_output" });
  });

  it("records an unavailable model as a failure and allows an explicit retry", async () => {
    fake.extract = () => Response.json({ detail: { code: "llm_unavailable" } }, { status: 503 });
    const id = await voiceDraft();
    await expect(actions.runExtractionAction(id)).resolves.toEqual({ status: "failed", error: "ai_unavailable" });
    // Not retried automatically...
    await expect(actions.runExtractionAction(id)).resolves.toEqual({ status: "skipped" });
    // ...but the technician can retry.
    fake.extract = () => Response.json({ content: "{}", model: "gemma-test", processingMs: 5 });
    await expect(actions.runExtractionAction(id, true)).resolves.toEqual({ status: "done" });
  });

  it("removes a cost the model invented", async () => {
    fake.extract = () =>
      Response.json({
        content: JSON.stringify({ workPerformed: "Changed the spark plug", totalCostNaira: 20000, partsReplaced: [] }),
        model: "gemma-test",
        processingMs: 5,
      });
    const id = await voiceDraft();
    await actions.runExtractionAction(id);
    const suggestion = (await drafts.getDraft(a.id, id))?.aiSuggestion;
    expect(suggestion).toMatchObject({ status: "done", fields: { totalCostKobo: null } });
    expect(suggestion?.status === "done" && suggestion.flags).toContainEqual({ field: "totalCost", reason: "not_in_notes" });
  });

  it("does nothing when transcription failed (no notes to read)", async () => {
    fake.transcribe = () => new Response("down", { status: 502 });
    const id = await voiceDraft();
    await expect(actions.runExtractionAction(id)).resolves.toEqual({ status: "skipped" });
    expect(fake.calls.some((c) => c.path === "/v1/extract")).toBe(false);
    fake.transcribe = () =>
      Response.json({ text: "Changed the spark plug, 1500 naira.", durationSec: 6, model: "whisper-small", processingMs: 900 });
  });
});

describe("correcting the notes", () => {
  it("keeps the original transcript and re-extracts from the corrected text", async () => {
    fake.extract = () => Response.json({ content: "{}", model: "gemma-test", processingMs: 5 });
    const id = await voiceDraft();
    await actions.runExtractionAction(id);

    await expect(
      actions.correctNotesAction(id, {}, form([["notes", "Changed the spark plug and the air filter, 1500 naira."]])),
    ).rejects.toThrow(`REDIRECT:/repairs/${id}/review`);
    const draft = await drafts.getDraft(a.id, id);
    expect(draft?.source).toMatchObject({ transcript: "Changed the spark plug, 1500 naira." });
    expect(draft?.notesForExtraction).toBe("Changed the spark plug and the air filter, 1500 naira.");
    expect(draft?.aiSuggestion).toBeNull();

    await actions.runExtractionAction(id);
    const last = fake.calls.filter((c) => c.path === "/v1/extract").at(-1)!;
    expect((last.body as { text: string }).text).toContain("air filter");
  });

  it("lets a technician type notes after a failed transcription", async () => {
    fake.transcribe = () => new Response("down", { status: 503 });
    const id = await voiceDraft();
    await expect(actions.correctNotesAction(id, {}, form([["notes", "Changed the plug"]]))).rejects.toThrow("REDIRECT");
    expect((await drafts.getDraft(a.id, id))?.notesForExtraction).toBe("Changed the plug");
    fake.transcribe = () =>
      Response.json({ text: "Changed the spark plug, 1500 naira.", durationSec: 6, model: "whisper-small", processingMs: 900 });
  });
});

describe("confirmation before save", () => {
  it("refuses to save without the explicit confirmation tick", async () => {
    const id = await voiceDraft();
    const state = await actions.confirmDraftAction(id, {}, reviewedForm());
    expect(state.errors?.confirmed).toEqual(["confirmRequired"]);
    expect((await getRepair(a.id, id))?.status).toBe("draft");
    expect(await getRepairHistory(a.id, generatorId)).toEqual([]);
  });

  it("validates the reviewed values like the manual form", async () => {
    const id = await voiceDraft();
    const state = await actions.confirmDraftAction(id, {}, form([["confirmed", "on"], ["totalCost", "lots"]]));
    expect(state.errors?.totalCost).toEqual(["invalidAmount"]);
    expect((await getRepair(a.id, id))?.status).toBe("draft");
  });

  it("saves the technician's reviewed values (not the raw suggestion) once confirmed", async () => {
    fake.extract = () =>
      Response.json({
        content: JSON.stringify({ workPerformed: "Changed the spark plug", partsReplaced: [] }),
        model: "gemma-test",
        processingMs: 5,
      });
    const id = await voiceDraft();
    await actions.runExtractionAction(id);
    await expect(actions.confirmDraftAction(id, {}, reviewedForm([["confirmed", "on"]]))).rejects.toThrow(
      `REDIRECT:/repairs/${id}`,
    );

    const repair = await getRepair(a.id, id);
    expect(repair).toMatchObject({
      status: "confirmed",
      diagnosis: "Dead plug",
      partsReplaced: [{ name: "Spark plug", quantity: 1, costKobo: 150_000 }],
      sourceKind: "voice",
      originalNotes: "Changed the spark plug, 1500 naira.",
    });
    const history = await getRepairHistory(a.id, generatorId);
    expect(history?.map((r) => r.id)).toContain(id);
    expect((await getGenerator(a.id, generatorId))?.lastRepairAt).toEqual(new Date("2026-10-01T00:00:00Z"));

    // Confirming again is not possible; it's no longer a draft.
    await expect(actions.confirmDraftAction(id, {}, reviewedForm([["confirmed", "on"]]))).rejects.toThrow("NOT_FOUND");
  });

  it("does not let drafts be edited into confirmed records through the normal edit path", async () => {
    const id = await voiceDraft();
    await expect(
      updateRepair(a.id, id, {
        repairDate: null,
        reportedSymptoms: null,
        diagnosis: null,
        workPerformed: "Sneaky",
        partsReplaced: [],
        totalCostKobo: null,
        technicianNotes: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("draft ownership", () => {
  it("hides and protects one technician's drafts from another", async () => {
    const id = await voiceDraft();
    expect(await drafts.getDraft(b.id, id)).toBeNull();
    expect(await drafts.listDrafts(b.id)).toEqual([]);

    currentCookie = b.cookie;
    await expect(actions.runExtractionAction(id)).rejects.toThrow("NOT_FOUND");
    await expect(actions.confirmDraftAction(id, {}, reviewedForm([["confirmed", "on"]]))).rejects.toThrow("NOT_FOUND");
    await expect(actions.correctNotesAction(id, {}, form([["notes", "hijack"]]))).rejects.toThrow("NOT_FOUND");
    await expect(actions.discardDraftAction(id)).rejects.toThrow("NOT_FOUND");
    await expect(actions.createTextDraftAction(generatorId, {}, form([["notes", "x"]]))).rejects.toThrow("NOT_FOUND");

    currentCookie = a.cookie;
    expect((await drafts.getDraft(a.id, id))?.source).toMatchObject({ transcriptStatus: "done" });
  });

  it("requires a session for every draft action", async () => {
    const id = await voiceDraft();
    currentCookie = "";
    await expect(actions.runExtractionAction(id)).rejects.toThrow("REDIRECT:/sign-in");
    await expect(actions.confirmDraftAction(id, {}, reviewedForm([["confirmed", "on"]]))).rejects.toThrow("REDIRECT:/sign-in");
  });
});

describe("typed notes and discarding", () => {
  it("creates a draft from typed notes and discards it", async () => {
    let draftUrl = "";
    try {
      await actions.createTextDraftAction(generatorId, {}, form([["notes", "Cleaned the carburettor"]]));
    } catch (error) {
      draftUrl = (error as Error).message;
    }
    const id = /\/repairs\/([a-f\d]{24})\/review/.exec(draftUrl)?.[1];
    expect(id).toBeDefined();
    expect((await drafts.getDraft(a.id, id!))?.source).toEqual({ kind: "text", typedText: "Cleaned the carburettor" });

    await expect(actions.discardDraftAction(id!)).rejects.toThrow(`REDIRECT:/generators/${generatorId}`);
    expect(await getRepair(a.id, id!)).toBeNull();
  });

  it("rejects empty typed notes", async () => {
    const state = await actions.createTextDraftAction(generatorId, {}, form([["notes", "  "]]));
    expect(state.errors?.notes).toEqual(["required"]);
  });
});
