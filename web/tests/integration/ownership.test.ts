import { beforeAll, describe, expect, it } from "vitest";
import { createCustomer, getCustomer, listCustomers, updateCustomer } from "@/server/data/customers";
import { NotFoundError } from "@/server/data/errors";
import { ensureIndexes } from "@/server/data/indexes";
import { getDb } from "@/server/db";
import { createGenerator, getGenerator, listGenerators, updateGenerator } from "@/server/data/generators";
import { createRepair, getRepair, getRepairHistory, listRecentRepairs, updateRepair } from "@/server/data/repairs";
import { createTechnician, type TestTechnician } from "../helpers";

const customerInput = (name: string) => ({ name, phone: null, location: null, notes: null });
const generatorInput = (customerId: string, label: string, serialNumber: string | null = null) => ({
  customerId,
  label,
  brand: "Sumec",
  model: null,
  serialNumber,
  capacityKva: null,
  fuelType: null,
  location: null,
});
const repairFields = (work: string) => ({
  repairDate: new Date("2026-01-10T00:00:00Z"),
  reportedSymptoms: null,
  diagnosis: null,
  workPerformed: work,
  partsReplaced: [],
  totalCostKobo: null,
  technicianNotes: null,
});

describe("record ownership and isolation", () => {
  let a: TestTechnician;
  let b: TestTechnician;
  let aCustomerId: string;
  let aGeneratorId: string;
  let aRepairId: string;

  beforeAll(async () => {
    await ensureIndexes(getDb()); // the unique serial index is under test
    a = await createTechnician("Alpha");
    b = await createTechnician("Bravo");
    aCustomerId = (await createCustomer(a.id, customerInput("Mama Bisi"))).id;
    aGeneratorId = (await createGenerator(a.id, generatorInput(aCustomerId, "Big Sumec", "SN-1"))).id;
    aRepairId = (await createRepair(a.id, aGeneratorId, repairFields("Changed oil"))).id;
  });

  it("lets the owner read their records", async () => {
    expect((await getCustomer(a.id, aCustomerId))?.name).toBe("Mama Bisi");
    expect((await getGenerator(a.id, aGeneratorId))?.customer.name).toBe("Mama Bisi");
    expect((await getRepair(a.id, aRepairId))?.workPerformed).toBe("Changed oil");
  });

  it("hides another technician's records from direct reads", async () => {
    expect(await getCustomer(b.id, aCustomerId)).toBeNull();
    expect(await getGenerator(b.id, aGeneratorId)).toBeNull();
    expect(await getRepair(b.id, aRepairId)).toBeNull();
    expect(await getRepairHistory(b.id, aGeneratorId)).toBeNull();
  });

  it("hides another technician's records from lists and search", async () => {
    expect(await listCustomers(b.id)).toEqual([]);
    expect(await listCustomers(b.id, { query: "bisi" })).toEqual([]);
    expect(await listGenerators(b.id, { query: "sumec" })).toEqual([]);
    expect(await listGenerators(b.id, { customerId: aCustomerId })).toEqual([]);
    expect(await listRecentRepairs(b.id)).toEqual([]);
  });

  it("refuses updates to another technician's records", async () => {
    await expect(updateCustomer(b.id, aCustomerId, customerInput("Hijacked"))).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      updateGenerator(b.id, aGeneratorId, generatorInput(aCustomerId, "Hijacked")),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateRepair(b.id, aRepairId, repairFields("Hijacked"))).rejects.toBeInstanceOf(NotFoundError);

    expect((await getCustomer(a.id, aCustomerId))?.name).toBe("Mama Bisi");
    expect((await getGenerator(a.id, aGeneratorId))?.label).toBe("Big Sumec");
    expect((await getRepair(a.id, aRepairId))?.workPerformed).toBe("Changed oil");
  });

  it("refuses to attach records to another technician's customer or generator", async () => {
    await expect(createGenerator(b.id, generatorInput(aCustomerId, "Sneaky"))).rejects.toMatchObject({
      entity: "customer",
    });
    await expect(createRepair(b.id, aGeneratorId, repairFields("Sneaky"))).rejects.toMatchObject({
      entity: "generator",
    });

    // Moving your own generator onto someone else's customer is also refused.
    const bCustomer = await createCustomer(b.id, customerInput("Baba Tunde"));
    const bGenerator = await createGenerator(b.id, generatorInput(bCustomer.id, "Small Elepaq"));
    await expect(
      updateGenerator(b.id, bGenerator.id, generatorInput(aCustomerId, "Small Elepaq")),
    ).rejects.toMatchObject({ entity: "customer" });
  });

  it("scopes duplicate serial numbers to each technician", async () => {
    await expect(createGenerator(a.id, generatorInput(aCustomerId, "Twin", "SN-1"))).rejects.toMatchObject({
      field: "serialNumber",
      code: "duplicateSerial",
    });
    const bCustomer = await createCustomer(b.id, customerInput("Iya Sade"));
    await expect(createGenerator(b.id, generatorInput(bCustomer.id, "Same serial", "SN-1"))).resolves.toBeDefined();
  });

  it("treats malformed ids as not found", async () => {
    expect(await getCustomer(a.id, "not-an-id")).toBeNull();
    expect(await getGenerator(a.id, "{ $ne: null }")).toBeNull();
    await expect(updateRepair(a.id, "123", repairFields("x"))).rejects.toBeInstanceOf(NotFoundError);
  });
});
