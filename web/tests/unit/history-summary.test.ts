import { describe, expect, it } from "vitest";
import { summariseHistory, type SummarySource } from "@/lib/history-summary";
import { repairSearchSchema } from "@/lib/schemas/search";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
let n = 0;
const record = (over: Partial<SummarySource>): SummarySource => ({
  id: `r${++n}`,
  repairDate: null,
  reportedSymptoms: null,
  diagnosis: null,
  workPerformed: null,
  partsReplaced: [],
  totalCostKobo: null,
  status: "confirmed",
  ...over,
});

describe("previous-repair summary", () => {
  const jan = record({
    repairDate: day("2026-01-15"),
    reportedSymptoms: "Won't start",
    diagnosis: "Dead plug",
    workPerformed: "Changed the spark plug",
    partsReplaced: [{ name: "Spark plug", quantity: 1 }],
    totalCostKobo: 500_000,
  });
  const sep = record({
    repairDate: day("2026-09-02"),
    reportedSymptoms: "No output voltage",
    workPerformed: "Replaced AVR",
    partsReplaced: [{ name: "AVR", quantity: 1 }, { name: "spark  PLUG", quantity: 2 }],
    totalCostKobo: 2_500_000,
  });
  const undated = record({ workPerformed: "Tightened exhaust" });
  const draft = record({
    status: "draft",
    repairDate: day("2026-10-01"),
    workPerformed: "Unconfirmed AI suggestion",
    partsReplaced: [{ name: "Carburettor", quantity: 1 }],
    totalCostKobo: 9_900_000,
  });

  const summary = summariseHistory([undated, jan, draft, sep])!;

  it("uses confirmed records only", () => {
    expect(summary.recordCount).toBe(3);
    expect(JSON.stringify(summary)).not.toContain("Unconfirmed");
    expect(summary.parts.map((p) => p.name)).not.toContain("Carburettor");
    expect(summary.charges.totalKobo).toBe(3_000_000);
  });

  it("reports the date span and the most recent dated record, with its source", () => {
    expect(summary.firstDate).toEqual(day("2026-01-15"));
    expect(summary.lastDate).toEqual(day("2026-09-02"));
    expect(summary.latest).toEqual({
      ref: { id: sep.id, date: day("2026-09-02") },
      reportedSymptoms: "No output voltage",
      diagnosis: null, // not recorded → stays null, never filled in from another record
      workPerformed: "Replaced AVR",
    });
  });

  it("lists parts as recorded, grouping only identical names, each with its source records", () => {
    expect(summary.parts).toEqual([
      { name: "AVR", totalQuantity: 1, refs: [{ id: sep.id, date: day("2026-09-02") }] },
      {
        name: "spark PLUG", // most recent record's spelling, spacing tidied
        totalQuantity: 3,
        refs: [
          { id: sep.id, date: day("2026-09-02") },
          { id: jan.id, date: day("2026-01-15") },
        ],
      },
    ]);
  });

  it("every source reference points at a record that was given to it", () => {
    const ids = new Set([jan.id, sep.id, undated.id]);
    const refs = [summary.latest!.ref, ...summary.parts.flatMap((p) => p.refs)];
    for (const ref of refs) expect(ids.has(ref.id)).toBe(true);
  });

  it("counts missing fields instead of inventing them", () => {
    expect(summary.notRecorded).toEqual({ date: 1, reportedSymptoms: 1, diagnosis: 2, workPerformed: 0, totalCost: 1 });
    expect(summary.charges.recordedCount).toBe(2);
  });

  it("doesn't group different part names or claim a quantity it doesn't know", () => {
    const s = summariseHistory([
      record({ partsReplaced: [{ name: "Fuel filter", quantity: null }] }),
      record({ partsReplaced: [{ name: "Fuel filter", quantity: 2 }, { name: "Air filter", quantity: 1 }] }),
    ])!;
    expect(s.parts.find((p) => p.name === "Fuel filter")?.totalQuantity).toBeNull();
    expect(s.parts.map((p) => p.name).sort()).toEqual(["Air filter", "Fuel filter"]);
  });

  it("handles all-undated history and empty history", () => {
    const s = summariseHistory([undated])!;
    expect(s.firstDate).toBeNull();
    expect(s.latest?.ref).toEqual({ id: undated.id, date: null });
    expect(summariseHistory([])).toBeNull();
    expect(summariseHistory([draft])).toBeNull();
  });
});

describe("search parameters", () => {
  it("accepts a normal search and treats blanks as absent", () => {
    expect(repairSearchSchema.parse({ q: " avr ", part: "", from: "2026-01-01", to: "" })).toEqual({
      q: "avr",
      part: undefined,
      from: "2026-01-01",
      to: undefined,
      generator: undefined,
    });
  });

  it("rejects malformed dates, reversed ranges and bad generator ids", () => {
    expect(repairSearchSchema.safeParse({ from: "2026-02-30" }).success).toBe(false);
    const reversed = repairSearchSchema.safeParse({ from: "2026-05-01", to: "2026-01-01" });
    expect(reversed.success).toBe(false);
    expect(reversed.error?.issues[0].message).toBe("dateRangeOrder");
    expect(repairSearchSchema.safeParse({ generator: "{$ne:null}" }).success).toBe(false);
    expect(repairSearchSchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
  });
});
