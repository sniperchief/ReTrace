import { describe, expect, it } from "vitest";
import { sniffAudio } from "@/lib/audio";
import {
  buildExtractionInstructions,
  extractionJsonSchema,
  hasAnyField,
  isSupportedText,
  numbersInText,
  processModelOutput,
} from "@/lib/extraction";

const TODAY = "2026-10-16";
const NOTES =
  "Customer said the gen no gree start since Monday. I found the plug was dead and the carburettor was dirty. " +
  "Changed the spark plug, 1,500 naira, and two fuel filters at 2k each. Cleaned the carburettor. " +
  "Charged her 12,500 total. Told her to stop using adulterated fuel. Did the job today.";

const full = {
  repairDate: TODAY,
  reportedSymptoms: "Gen no gree start",
  diagnosis: "Plug was dead and the carburettor was dirty",
  workPerformed: "Changed the spark plug and cleaned the carburettor",
  partsReplaced: [
    { name: "Spark plug", quantity: 1, costNaira: 1500 },
    { name: "Fuel filter", quantity: 2, costNaira: 2000 },
  ],
  totalCostNaira: 12500,
  technicianNotes: "Told her to stop using adulterated fuel",
};

const run = (output: unknown, notes = NOTES) =>
  processModelOutput(typeof output === "string" ? output : JSON.stringify(output), notes, TODAY);

describe("processModelOutput: valid output", () => {
  it("keeps every field the notes support", () => {
    const result = run(full);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.flags).toEqual([]);
    expect(result.fields).toEqual({
      repairDate: new Date(`${TODAY}T00:00:00Z`),
      reportedSymptoms: "Gen no gree start",
      diagnosis: "Plug was dead and the carburettor was dirty",
      workPerformed: "Changed the spark plug and cleaned the carburettor",
      partsReplaced: [
        { name: "Spark plug", quantity: 1, costKobo: 150_000 },
        { name: "Fuel filter", quantity: 2, costKobo: 200_000 },
      ],
      totalCostKobo: 1_250_000,
      technicianNotes: "Told her to stop using adulterated fuel",
    });
  });
});

describe("processModelOutput: missing fields", () => {
  it("leaves unstated fields empty", () => {
    const result = run({ workPerformed: "Changed the spark plug" }, "Changed the spark plug.");
    expect(result.ok && result.fields).toEqual({
      repairDate: null,
      reportedSymptoms: null,
      diagnosis: null,
      workPerformed: "Changed the spark plug",
      partsReplaced: [],
      totalCostKobo: null,
      technicianNotes: null,
    });
    expect(result.ok && result.flags).toEqual([]);
  });

  it("treats placeholders like 'N/A' or 'unknown' as empty", () => {
    const result = run({ ...full, diagnosis: "N/A", technicianNotes: "unknown" });
    expect(result.ok && result.fields.diagnosis).toBeNull();
    expect(result.ok && result.fields.technicianNotes).toBeNull();
  });

  it("reports an all-empty suggestion as having no fields", () => {
    const result = run({});
    expect(result.ok && hasAnyField(result.fields)).toBe(false);
  });
});

describe("processModelOutput: never keeps invented details", () => {
  it("removes a total cost that isn't in the notes", () => {
    const result = run({ ...full, totalCostNaira: 15000 });
    expect(result.ok && result.fields.totalCostKobo).toBeNull();
    expect(result.ok && result.flags).toContainEqual({ field: "totalCost", reason: "not_in_notes" });
  });

  it("removes parts the notes don't mention, and unsupported part costs/quantities", () => {
    const result = run({
      ...full,
      partsReplaced: [
        { name: "AVR", quantity: 1, costNaira: 18000 },
        { name: "Spark plug", quantity: 3, costNaira: 4000 },
      ],
    });
    expect(result.ok && result.fields.partsReplaced).toEqual([{ name: "Spark plug", quantity: null, costKobo: null }]);
    expect(result.ok && result.flags).toEqual(
      expect.arrayContaining([
        { field: "partsReplaced.0", reason: "not_in_notes" },
        { field: "partsReplaced.1.quantity", reason: "not_in_notes" },
        { field: "partsReplaced.1.costKobo", reason: "not_in_notes" },
      ]),
    );
  });

  it("removes a date the notes don't state", () => {
    const result = run({ ...full, repairDate: "2026-10-10" });
    expect(result.ok && result.fields.repairDate).toBeNull();
    expect(result.ok && result.flags).toContainEqual({ field: "repairDate", reason: "not_in_notes" });
  });

  it("accepts dates stated as 'yesterday' or as day and month", () => {
    expect(run({ repairDate: "2026-10-15" }, "Did it yesterday").ok).toBe(true);
    const yesterday = run({ repairDate: "2026-10-15" }, "Fixed it yesterday.");
    expect(yesterday.ok && yesterday.fields.repairDate).toEqual(new Date("2026-10-15T00:00:00Z"));
    const stated = run({ repairDate: "2026-09-03" }, "Visited on 3rd September, changed the AVR");
    expect(stated.ok && stated.fields.repairDate).toEqual(new Date("2026-09-03T00:00:00Z"));
  });

  it("rejects future and impossible dates", () => {
    const future = run({ repairDate: "2026-12-01" }, "1st December");
    expect(future.ok && future.flags).toContainEqual({ field: "repairDate", reason: "invalid" });
    const impossible = run({ repairDate: "2026-02-30" }, "30 February");
    expect(impossible.ok && impossible.fields.repairDate).toBeNull();
  });

  it("removes text that isn't supported by the notes", () => {
    const result = run({ ...full, diagnosis: "Faulty automatic voltage regulator and burnt stator winding" });
    expect(result.ok && result.fields.diagnosis).toBeNull();
    expect(result.ok && result.flags).toContainEqual({ field: "diagnosis", reason: "not_in_notes" });
  });
});

describe("processModelOutput: malformed output", () => {
  it.each([
    ["not JSON", "The customer said..."],
    ["truncated JSON", '{"diagnosis": "Dirty carb'],
    ["an array", "[]"],
    ["a string", '"hello"'],
    ["null", "null"],
  ])("fails on %s", (_label, raw) => {
    expect(run(raw)).toEqual({ ok: false, error: "malformed_output" });
  });

  it("drops wrongly typed fields instead of trusting them", () => {
    const result = run({
      ...full,
      diagnosis: 42,
      totalCostNaira: "12500",
      partsReplaced: [{ name: "Spark plug", quantity: 1.5, costNaira: -100 }, "bad"],
      repairDate: "16/10/2026",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.diagnosis).toBeNull();
    expect(result.fields.totalCostKobo).toBeNull();
    expect(result.fields.repairDate).toBeNull();
    expect(result.fields.partsReplaced).toEqual([{ name: "Spark plug", quantity: null, costKobo: null }]);
    expect(result.flags).toEqual(
      expect.arrayContaining([
        { field: "diagnosis", reason: "invalid" },
        { field: "totalCost", reason: "invalid" },
        { field: "repairDate", reason: "invalid" },
        { field: "partsReplaced.0.quantity", reason: "invalid" },
        { field: "partsReplaced.0.costKobo", reason: "invalid" },
        { field: "partsReplaced.1", reason: "invalid" },
      ]),
    );
  });

  it("ignores unexpected extra keys and caps text length", () => {
    const result = run({ ...full, customerName: "Mama Bisi", workPerformed: "x".repeat(5000) });
    expect(result.ok && "customerName" in result.fields).toBe(false);
    expect(result.ok && result.fields.workPerformed).toBeNull();
  });
});

describe("grounding helpers", () => {
  it("finds amounts in common formats", () => {
    const numbers = numbersInText("₦15,000 for labour, plug 1.5k, oil 2 thousand, and two filters");
    expect([...numbers]).toEqual(expect.arrayContaining([15000, 1500, 2000, 2]));
  });

  it("accepts the technician's own wording with different endings", () => {
    expect(isSupportedText("Cleaned carburettor", "I clean the carburettor")).toBe(true);
    expect(isSupportedText("Replaced rotor bearings", "I clean the carburettor")).toBe(false);
  });
});

describe("prompt and schema", () => {
  it("tells the model not to guess and allows every field to be null", () => {
    expect(buildExtractionInstructions(TODAY)).toMatch(/Never guess/);
    expect(buildExtractionInstructions(TODAY)).toContain(TODAY);
    for (const [key, prop] of Object.entries(extractionJsonSchema.properties)) {
      if (key === "partsReplaced") continue;
      expect((prop as { type: string[] }).type).toContain("null");
    }
  });
});

describe("audio sniffing", () => {
  const bytes = (...values: (number | string)[]) => {
    const out: number[] = [];
    for (const v of values) {
      if (typeof v === "string") out.push(...[...v].map((c) => c.charCodeAt(0)));
      else out.push(v);
    }
    while (out.length < 16) out.push(0);
    return new Uint8Array(out);
  };
  it.each([
    ["webm", bytes(0x1a, 0x45, 0xdf, 0xa3)],
    ["ogg", bytes("OggS")],
    ["mp4", bytes(0, 0, 0, 0x20, "ftypM4A ")],
    ["wav", bytes("RIFF", 0, 0, 0, 0, "WAVE")],
    ["mp3", bytes("ID3")],
  ])("detects %s", (kind, data) => {
    expect(sniffAudio(data)).toBe(kind);
  });

  it("rejects non-audio", () => {
    expect(sniffAudio(bytes("%PDF-1.7"))).toBeNull();
    expect(sniffAudio(bytes("<html>"))).toBeNull();
    expect(sniffAudio(new Uint8Array(4))).toBeNull();
  });
});
