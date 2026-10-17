import { describe, expect, it } from "vitest";
import { processModelOutput } from "@/lib/extraction";
import { mergeSuggestions, type Validated } from "@/lib/extraction-merge";
import { extractWithRules } from "@/lib/rule-extraction";

const TODAY = "2026-10-17";
const rules = (notes: string) => extractWithRules(notes, TODAY);
const validated = (raw: object, notes: string): Validated => {
  const p = processModelOutput(JSON.stringify(raw), notes, TODAY);
  if (!p.ok) throw new Error("invalid");
  return p;
};

// Real Whisper output from the benchmark recordings (docs/inference-benchmark.md).
const SHORT =
  "Mama Bezzie Sumec Generator. The customer said it would not start. I found the spark plug was dead. I changed the spark plug for 1500 naira. I charged her 5000 naira in total.";
const MEDIUM =
  "Today I worked on the Ellipaq 3.5 kVA for Baba Tundin Aikja. He complained that the generator goes off after about 10 minutes and the light was fluctuating. I checked it and found the AVR was faulty and the air filter was blocked. I replaced the AVR for 18,000 naira and cleaned the air filter. I also changed the engine oil, 1 liter, 4500 naira. The total charge was 30,000 naira. I advised him not to overload it with the pumping machine.";
const LONG =
  "She brought it on 3 October because it was hard to start and it was smoking a lot when running. When I opened it, the carburettor was very dirty, the fuel had water inside, and the piston rings were worn. I drained the fuel tank and flushed the fuel line. I cleaned the carburettor completely. I replaced the piston rings, that was 6000 Nira for the rings, and the gasket kit was 2500 Nira. I also put a new spark plug, 1500 Nira. Labor was 10,000 Nira. So the total was 20,000 Nira. I told her to buy fuel only from a good filling station.";
const SPARSE =
  "Went to check the firman generator for Mr. Aukifer. It was making a loud rattling noise. The exhaust bolts were loose. I tightened the exhaust and the noise stopped. No parts were used.";

describe("rule-based extraction on real transcripts", () => {
  it("short note", () => {
    expect(rules(SHORT)).toEqual({
      repairDate: null,
      reportedSymptoms: "It would not start",
      diagnosis: "I found the spark plug was dead",
      workPerformed: "I changed the spark plug",
      partsReplaced: [{ name: "Spark plug", quantity: null, costNaira: 1500 }],
      totalCostNaira: 5000,
      technicianNotes: null,
    });
  });

  it("medium note: replaced vs cleaned, costs in later clauses, 'today'", () => {
    const r = rules(MEDIUM);
    expect(r.repairDate).toBe(TODAY);
    expect(r.reportedSymptoms).toMatch(/goes off after about 10 minutes/);
    expect(r.diagnosis).toMatch(/AVR was faulty/);
    expect(r.partsReplaced).toEqual([
      { name: "AVR", quantity: null, costNaira: 18000 },
      { name: "Engine oil", quantity: null, costNaira: 4500 },
    ]); // the air filter was cleaned, not replaced
    expect(r.totalCostNaira).toBe(30000);
    expect(r.technicianNotes).toMatch(/not to overload/);
  });

  it("long note: stated date, several parts with their own costs, labour not a part", () => {
    const r = rules(LONG);
    expect(r.repairDate).toBe("2026-10-03");
    expect(r.reportedSymptoms).toBe("It was hard to start and it was smoking a lot when running");
    expect(r.partsReplaced).toEqual([
      { name: "Piston rings", quantity: null, costNaira: 6000 },
      { name: "Gasket kit", quantity: null, costNaira: 2500 },
      { name: "Spark plug", quantity: 1, costNaira: 1500 },
    ]);
    expect(r.totalCostNaira).toBe(20000);
    expect(r.workPerformed).not.toMatch(/\d/); // money removed from the work text
  });

  it("sparse note: no parts or costs invented", () => {
    const r = rules(SPARSE);
    expect(r).toMatchObject({
      reportedSymptoms: "It was making a loud rattling noise",
      diagnosis: "The exhaust bolts were loose",
      workPerformed: "I tightened the exhaust and the noise stopped",
      partsReplaced: [],
      totalCostNaira: null,
      repairDate: null,
    });
  });

  it("understands common Pidgin phrasing", () => {
    expect(rules("Gen no gree start. Plug don die. I change the plug 2k. Collect 5k total.")).toMatchObject({
      reportedSymptoms: "Gen no gree start",
      diagnosis: "Plug don die",
      partsReplaced: [{ name: "Spark plug", costNaira: 2000 }],
      totalCostNaira: 5000,
    });
  });

  it("doesn't treat numbers without a currency as money", () => {
    const r = rules("Changed the 3.5 kVA AVR after 10 minutes of testing. Total was 2 hours of work.");
    expect(r.partsReplaced).toEqual([{ name: "AVR", quantity: null, costNaira: null }]);
    expect(r.totalCostNaira).toBeNull();
  });

  it("finds nothing in notes that contain nothing", () => {
    expect(rules("Okay. Thank you.")).toEqual({
      repairDate: null,
      reportedSymptoms: null,
      diagnosis: null,
      workPerformed: null,
      partsReplaced: [],
      totalCostNaira: null,
      technicianNotes: null,
    });
  });

  it("only uses past dates when the year isn't said", () => {
    expect(rules("Fixed it on 20 December.").repairDate).toBe("2025-12-20");
    expect(rules("Fixed it on 3rd of October.").repairDate).toBe("2026-10-03");
  });

  it("always passes the same grounding checks as the AI", () => {
    for (const notes of [SHORT, MEDIUM, LONG, SPARSE]) {
      const p = processModelOutput(JSON.stringify(rules(notes)), notes, TODAY);
      expect(p.ok && p.flags).toEqual([]);
    }
  });
});

describe("merging AI and rule suggestions", () => {
  const notes = SHORT;
  const ruleSide = validated(rules(notes), notes);

  it("uses the rules alone when there is no AI answer", () => {
    const m = mergeSuggestions(null, ruleSide);
    expect(m.engine).toBe("rules");
    expect(m.fields).toEqual(ruleSide.fields);
    expect(m.sources).toEqual({
      reportedSymptoms: "rules",
      diagnosis: "rules",
      workPerformed: "rules",
      partsReplaced: "rules",
      totalCost: "rules",
    });
  });

  it("prefers the AI's answer, fills its gaps from the rules, and records where each field came from", () => {
    const ai = validated(
      { diagnosis: "Spark plug was dead", partsReplaced: [{ name: "spark plug", quantity: 1, costNaira: null }] },
      notes,
    );
    const m = mergeSuggestions(ai, ruleSide);
    expect(m.engine).toBe("ai+rules");
    expect(m.fields.diagnosis).toBe("Spark plug was dead");
    expect(m.fields.reportedSymptoms).toBe("It would not start");
    expect(m.fields.totalCostKobo).toBe(500_000);
    expect(m.fields.partsReplaced).toEqual([{ name: "spark plug", quantity: 1, costKobo: 150_000 }]);
    expect(m.sources).toMatchObject({ diagnosis: "ai", reportedSymptoms: "rules", totalCost: "rules", partsReplaced: "ai" });
  });

  it("drops an AI 'left empty' flag once the rules filled that field, and keeps it otherwise", () => {
    const ai = validated({ diagnosis: "Spark plug was dead", totalCostNaira: 9999, repairDate: "2026-10-17" }, notes);
    expect(ai.flags).toEqual(
      expect.arrayContaining([
        { field: "totalCost", reason: "not_in_notes" },
        { field: "repairDate", reason: "not_in_notes" },
      ]),
    );
    const m = mergeSuggestions(ai, ruleSide);
    expect(m.fields.totalCostKobo).toBe(500_000); // the stated total, not the invented one
    expect(m.flags).toEqual([{ field: "repairDate", reason: "not_in_notes" }]); // no date anywhere in the notes
  });

  it("adds parts the AI missed (seen with Gemma 3 1B on a noisy recording)", () => {
    const aiSide = validated(
      { workPerformed: "Replaced the AVR", partsReplaced: [{ name: "AVR", quantity: 1, costNaira: 18000 }] },
      MEDIUM,
    );
    const m = mergeSuggestions(aiSide, validated(rules(MEDIUM), MEDIUM));
    expect(m.fields.partsReplaced).toEqual([
      { name: "AVR", quantity: 1, costKobo: 1_800_000 },
      { name: "Engine oil", quantity: null, costKobo: 450_000 },
    ]);
    expect(m.sources.partsReplaced).toBe("rules");
    expect(m.engine).toBe("ai+rules");
  });

  it("reports 'ai' when the rules added nothing", () => {
    const full = validated(
      {
        reportedSymptoms: "would not start",
        diagnosis: "spark plug was dead",
        workPerformed: "changed the spark plug",
        partsReplaced: [{ name: "Spark plug", quantity: 1, costNaira: 1500 }],
        totalCostNaira: 5000,
      },
      notes,
    );
    expect(mergeSuggestions(full, ruleSide).engine).toBe("ai");
  });
});
