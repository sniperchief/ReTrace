import { beforeAll, describe, expect, it } from "vitest";
import { createCustomer } from "@/server/data/customers";
import { confirmDraft, createTextDraft } from "@/server/data/drafts";
import { createGenerator } from "@/server/data/generators";
import { ensureIndexes } from "@/server/data/indexes";
import { createRepair, getRepairHistory } from "@/server/data/repairs";
import { searchRepairs } from "@/server/data/search";
import { getDb } from "@/server/db";
import { createTechnician, type TestTechnician } from "../helpers";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fields = (over: Partial<Parameters<typeof createRepair>[2]>) => ({
  repairDate: null,
  reportedSymptoms: null,
  diagnosis: null,
  workPerformed: null,
  partsReplaced: [],
  totalCostKobo: null,
  technicianNotes: null,
  ...over,
});
const gen = (customerId: string, label: string, over: Record<string, unknown> = {}) => ({
  customerId,
  label,
  brand: null,
  model: null,
  serialNumber: null,
  capacityKva: null,
  fuelType: null,
  location: null,
  ...over,
});

let a: TestTechnician;
let b: TestTechnician;
let sumec: string;
let elepaq: string;
const ids: Record<string, string> = {};

beforeAll(async () => {
  await ensureIndexes(getDb());
  a = await createTechnician("Alpha");
  b = await createTechnician("Bravo");
  const bisi = await createCustomer(a.id, { name: "Mama Bisi", phone: "+2348031234567", location: null, notes: null });
  const tunde = await createCustomer(a.id, { name: "Baba Tunde", phone: null, location: null, notes: null });
  sumec = (await createGenerator(a.id, gen(bisi.id, "Big Sumec", { brand: "Sumec", serialNumber: "SN-777" }))).id;
  elepaq = (await createGenerator(a.id, gen(tunde.id, "Shop Elepaq", { brand: "Elepaq" }))).id;

  ids.avrDiag = (
    await createRepair(a.id, sumec, fields({
      repairDate: day("2026-09-02"),
      reportedSymptoms: "Light fluctuating",
      diagnosis: "Faulty AVR",
      workPerformed: "Replaced AVR",
      partsReplaced: [{ name: "AVR", quantity: 1, costKobo: 1_800_000 }],
    }))
  ).id;
  ids.avrNoteOnly = (
    await createRepair(a.id, elepaq, fields({
      repairDate: day("2026-05-10"),
      workPerformed: "Cleaned carburettor",
      technicianNotes: "Check the avr next time",
    }))
  ).id;
  ids.plug = (
    await createRepair(a.id, sumec, fields({
      repairDate: day("2026-01-15"),
      reportedSymptoms: "Won't start",
      diagnosis: "Dead spark plug",
      workPerformed: "Changed the spark plug",
      partsReplaced: [{ name: "Spark plug", quantity: 1, costKobo: 150_000 }],
    }))
  ).id;
  ids.undated = (
    await createRepair(a.id, elepaq, fields({ workPerformed: "Changed spark plugs", partsReplaced: [{ name: "Spark plug", quantity: 2, costKobo: null }] }))
  ).id;
  ids.unplugged = (await createRepair(a.id, elepaq, fields({ repairDate: day("2026-03-01"), workPerformed: "Unplugged the faulty extension" }))).id;

  // Voice/typed notes that were confirmed: their original text is searchable.
  const draftId = await createTextDraft(a.id, elepaq, "Customer said exhaust was rattling. Tightened the bolts.");
  await confirmDraft(a.id, draftId, fields({ repairDate: day("2026-04-04"), workPerformed: "Tightened exhaust" }));
  ids.fromNotes = draftId;

  // An unconfirmed draft must never be searched.
  await createTextDraft(a.id, sumec, "Replaced the AVR again, unconfirmed");

  // Another technician's records.
  const bCustomer = await createCustomer(b.id, { name: "Mama Bisi", phone: null, location: null, notes: null });
  const bGen = await createGenerator(b.id, gen(bCustomer.id, "Big Sumec", { brand: "Sumec" }));
  ids.bAvr = (await createRepair(b.id, bGen.id, fields({ repairDate: day("2026-09-03"), diagnosis: "Faulty AVR" }))).id;
  ids.bGen = bGen.id;
});

const hitIds = async (tech: TestTechnician, search: Parameters<typeof searchRepairs>[1]) =>
  (await searchRepairs(tech.id, search)).hits.map((h) => h.id);

describe("repair search: relevance", () => {
  it("ranks a match in the diagnosis/work/parts above a match only in side notes", async () => {
    const hits = await hitIds(a, { q: "avr" });
    expect(hits).toEqual([ids.avrDiag, ids.avrNoteOnly]);
  });

  it("requires every word to match somewhere", async () => {
    expect(await hitIds(a, { q: "spark plug" })).toEqual([ids.plug, ids.undated]);
    expect(await hitIds(a, { q: "spark avr" })).toEqual([]);
  });

  it("matches word starts, not arbitrary substrings", async () => {
    const plug = await hitIds(a, { q: "plug" });
    expect(plug).toContain(ids.plug);
    expect(plug).not.toContain(ids.unplugged);
  });

  it("finds repairs by generator details and the customer's name or phone", async () => {
    expect((await hitIds(a, { q: "SN-777" })).sort()).toEqual([ids.avrDiag, ids.plug].sort());
    expect((await hitIds(a, { q: "bisi" })).sort()).toEqual([ids.avrDiag, ids.plug].sort());
    expect((await hitIds(a, { q: "08031234567" })).sort()).toEqual([ids.avrDiag, ids.plug].sort());
  });

  it("searches the original notes of AI-assisted records", async () => {
    expect(await hitIds(a, { q: "rattling" })).toEqual([ids.fromNotes]);
  });

  it("reports where each result matched", async () => {
    const { hits } = await searchRepairs(a.id, { q: "avr" });
    expect(hits[0].matchedIn).toEqual(expect.arrayContaining(["diagnosis", "workPerformed", "parts"]));
    expect(hits[1].matchedIn).toEqual(["technicianNotes"]);
  });

  it("never returns drafts", async () => {
    const hits = await hitIds(a, { q: "unconfirmed" });
    expect(hits).toEqual([]);
  });

  it("treats regex characters literally", async () => {
    await expect(searchRepairs(a.id, { q: ".* (avr [" })).resolves.toBeDefined();
    expect(await hitIds(a, { q: "(" })).toEqual([]);
  });
});

describe("repair search: filters", () => {
  it("filters by part replaced", async () => {
    expect(await hitIds(a, { part: "spark plug" })).toEqual([ids.plug, ids.undated]);
    expect(await hitIds(a, { part: "avr" })).toEqual([ids.avrDiag]);
  });

  it("filters by date range (inclusive) and leaves undated records out", async () => {
    expect(await hitIds(a, { from: "2026-03-01", to: "2026-05-10" })).toEqual([ids.avrNoteOnly, ids.fromNotes, ids.unplugged]);
    expect(await hitIds(a, { part: "spark", from: "2025-01-01" })).toEqual([ids.plug]);
  });

  it("limits to one generator and lists newest first, undated last, when there are no words", async () => {
    expect(await hitIds(a, { generator: elepaq })).toEqual([ids.avrNoteOnly, ids.fromNotes, ids.unplugged, ids.undated]);
  });

  it("combines words and filters", async () => {
    expect(await hitIds(a, { q: "plug", generator: sumec })).toEqual([ids.plug]);
  });
});

describe("repair search: isolation between technicians", () => {
  it("only ever returns the signed-in technician's records", async () => {
    const aHits = await hitIds(a, { q: "faulty avr" });
    expect(aHits).not.toContain(ids.bAvr);
    expect(await hitIds(b, { q: "avr" })).toEqual([ids.bAvr]);
    expect(await hitIds(b, { q: "SN-777" })).toEqual([]);
    expect(await hitIds(b, { q: "rattling" })).toEqual([]);
  });

  it("returns nothing for another technician's generator, without saying whether it exists", async () => {
    expect(await searchRepairs(b.id, { generator: sumec })).toEqual({ hits: [], truncated: false });
    expect(await searchRepairs(a.id, { generator: ids.bGen })).toEqual({ hits: [], truncated: false });
    expect(await searchRepairs(a.id, { generator: "0123456789abcdef01234567" })).toEqual({ hits: [], truncated: false });
  });

  it("result generator labels come only from the technician's own generators", async () => {
    const { hits } = await searchRepairs(b.id, { q: "avr" });
    expect(hits.map((h) => h.generator.id)).toEqual([ids.bGen]);
  });
});

describe("generator timeline", () => {
  it("is confirmed records only, newest first, undated last", async () => {
    const history = await getRepairHistory(a.id, elepaq);
    expect(history?.map((r) => r.id)).toEqual([ids.avrNoteOnly, ids.fromNotes, ids.unplugged, ids.undated]);
  });

  it("is empty for a generator with no confirmed repairs", async () => {
    const customer = await createCustomer(a.id, { name: "New", phone: null, location: null, notes: null });
    const fresh = await createGenerator(a.id, gen(customer.id, "Fresh"));
    await createTextDraft(a.id, fresh.id, "draft only");
    expect(await getRepairHistory(a.id, fresh.id)).toEqual([]);
    expect(await getRepairHistory(b.id, fresh.id)).toBeNull();
  });
});
