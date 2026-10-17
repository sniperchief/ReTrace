import { beforeAll, describe, expect, it } from "vitest";
import { createCustomer, updateCustomer } from "@/server/data/customers";
import { createGenerator, getGenerator, listGenerators } from "@/server/data/generators";
import { createRepair, getRepairHistory, updateRepair } from "@/server/data/repairs";
import { createTechnician, type TestTechnician } from "../helpers";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fields = (repairDate: Date | null, work: string) => ({
  repairDate,
  reportedSymptoms: null,
  diagnosis: null,
  workPerformed: work,
  partsReplaced: [],
  totalCostKobo: null,
  technicianNotes: null,
});

describe("repair history", () => {
  let tech: TestTechnician;
  let generatorId: string;
  let otherGeneratorId: string;

  beforeAll(async () => {
    tech = await createTechnician("Historian");
    const customer = await createCustomer(tech.id, {
      name: "Mama Bisi",
      phone: "+2348031234567",
      location: null,
      notes: null,
    });
    const base = { brand: "Sumec", model: null, serialNumber: null, capacityKva: null, fuelType: null, location: null };
    generatorId = (await createGenerator(tech.id, { ...base, customerId: customer.id, label: "Big Sumec" })).id;
    otherGeneratorId = (await createGenerator(tech.id, { ...base, customerId: customer.id, label: "Small one" })).id;

    // Entered out of order on purpose.
    await createRepair(tech.id, generatorId, fields(day("2026-02-01"), "February service"));
    await createRepair(tech.id, generatorId, fields(null, "Undated job"));
    await createRepair(tech.id, generatorId, fields(day("2026-05-20"), "May: replaced AVR"));
    await createRepair(tech.id, generatorId, fields(day("2025-11-03"), "November: carburettor"));
    await createRepair(tech.id, otherGeneratorId, fields(day("2026-06-01"), "Other generator"));
  });

  it("returns only this generator's repairs, newest first, undated last", async () => {
    const history = await getRepairHistory(tech.id, generatorId);
    expect(history?.map((r) => r.workPerformed)).toEqual([
      "May: replaced AVR",
      "February service",
      "November: carburettor",
      "Undated job",
    ]);
    expect(history?.every((r) => r.generatorId === generatorId)).toBe(true);
  });

  it("re-orders when a repair's date is corrected", async () => {
    const history = (await getRepairHistory(tech.id, generatorId))!;
    const november = history.find((r) => r.workPerformed?.startsWith("November"))!;
    await updateRepair(tech.id, november.id, fields(day("2026-07-01"), "July: carburettor"));

    const updated = await getRepairHistory(tech.id, generatorId);
    expect(updated?.[0].workPerformed).toBe("July: carburettor");
  });

  it("keeps the generator's last-repair date in sync", async () => {
    expect((await getGenerator(tech.id, generatorId))?.lastRepairAt).toEqual(day("2026-07-01"));
    const [first] = await listGenerators(tech.id);
    expect(first.id).toBe(generatorId); // most recently repaired first
  });

  it("returns an empty history for a generator with no repairs", async () => {
    const customer = await createCustomer(tech.id, { name: "New", phone: null, location: null, notes: null });
    const fresh = await createGenerator(tech.id, {
      customerId: customer.id,
      label: "Fresh",
      brand: null,
      model: null,
      serialNumber: null,
      capacityKva: null,
      fuelType: null,
      location: null,
    });
    expect(await getRepairHistory(tech.id, fresh.id)).toEqual([]);
  });

  it("finds generators by owner name, phone and brand", async () => {
    const labels = async (query: string) => (await listGenerators(tech.id, { query })).map((g) => g.label).sort();
    expect(await labels("bisi")).toEqual(["Big Sumec", "Small one"]);
    expect(await labels("0803 123 4567")).toEqual(["Big Sumec", "Small one"]);
    expect(await labels("big sum")).toEqual(["Big Sumec"]);

    // Renaming the customer updates generator search.
    const generator = await getGenerator(tech.id, generatorId);
    await updateCustomer(tech.id, generator!.customerId, {
      name: "Iya Bisi",
      phone: "+2348031234567",
      location: null,
      notes: null,
    });
    expect(await labels("iya")).toEqual(["Big Sumec", "Small one"]);
  });
});
