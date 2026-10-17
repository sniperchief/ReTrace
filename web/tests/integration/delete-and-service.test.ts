import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTechnician } from "../helpers";

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

const { deleteCustomerAction } = await import("@/server/actions/customers");
const { deleteGeneratorAction } = await import("@/server/actions/generators");
const { deleteRepairAction } = await import("@/server/actions/repairs");
const { createCustomer, getCustomer } = await import("@/server/data/customers");
const { createGenerator, getGenerator, listServiceDue, updateGenerator } = await import("@/server/data/generators");
const { createTextDraft } = await import("@/server/data/drafts");
const { countGeneratorRecords, createRepair, getRepair } = await import("@/server/data/repairs");

const base = { brand: null, model: null, serialNumber: null, capacityKva: null, fuelType: null, location: null };
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fields = (repairDate: Date | null) => ({
  repairDate,
  reportedSymptoms: null,
  diagnosis: null,
  workPerformed: "Service",
  partsReplaced: [],
  totalCostKobo: null,
  technicianNotes: null,
});

async function setup(name: string) {
  const tech = await createTechnician(name);
  const customer = await createCustomer(tech.id, { name: `${name} customer`, phone: null, location: null, notes: null });
  const generator = await createGenerator(tech.id, { ...base, customerId: customer.id, label: `${name} gen` });
  return { tech, customer, generator };
}

beforeEach(() => {
  currentCookie = "";
});

describe("deleting records", () => {
  it("deletes a repair and recomputes the generator's last repair date", async () => {
    const { tech, generator } = await setup("Del1");
    const older = await createRepair(tech.id, generator.id, fields(day("2026-01-10")));
    const newer = await createRepair(tech.id, generator.id, fields(day("2026-03-01")));
    currentCookie = tech.cookie;
    await expect(deleteRepairAction(newer.id)).rejects.toThrow(`REDIRECT:/generators/${generator.id}`);
    expect(await getRepair(tech.id, newer.id)).toBeNull();
    expect(await getRepair(tech.id, older.id)).not.toBeNull();
    expect((await getGenerator(tech.id, generator.id))?.lastRepairAt).toEqual(day("2026-01-10"));
  });

  it("deletes a generator with its whole history, drafts included", async () => {
    const { tech, customer, generator } = await setup("Del2");
    const repair = await createRepair(tech.id, generator.id, fields(null));
    await createTextDraft(tech.id, generator.id, "Changed the plug");
    expect(await countGeneratorRecords(tech.id, generator.id)).toBe(2);
    currentCookie = tech.cookie;
    await expect(deleteGeneratorAction(generator.id)).rejects.toThrow(`REDIRECT:/customers/${customer.id}`);
    expect(await getGenerator(tech.id, generator.id)).toBeNull();
    expect(await getRepair(tech.id, repair.id)).toBeNull();
    expect(await countGeneratorRecords(tech.id, generator.id)).toBe(0);
  });

  it("refuses to delete a customer who still has generators, then allows it", async () => {
    const { tech, customer, generator } = await setup("Del3");
    currentCookie = tech.cookie;
    await expect(deleteCustomerAction(customer.id)).rejects.toThrow(`REDIRECT:/customers/${customer.id}`);
    expect(await getCustomer(tech.id, customer.id)).not.toBeNull();
    await expect(deleteGeneratorAction(generator.id)).rejects.toThrow("REDIRECT");
    await expect(deleteCustomerAction(customer.id)).rejects.toThrow("REDIRECT:/customers");
    expect(await getCustomer(tech.id, customer.id)).toBeNull();
  });

  it("never deletes another technician's records", async () => {
    const owner = await setup("Owner");
    const repair = await createRepair(owner.tech.id, owner.generator.id, fields(null));
    const intruder = await createTechnician("Intruder");
    currentCookie = intruder.cookie;
    await expect(deleteRepairAction(repair.id)).rejects.toThrow("NOT_FOUND");
    await expect(deleteGeneratorAction(owner.generator.id)).rejects.toThrow("NOT_FOUND");
    await expect(deleteCustomerAction(owner.customer.id)).rejects.toThrow("NOT_FOUND");
    expect(await getRepair(owner.tech.id, repair.id)).not.toBeNull();
    expect(await getGenerator(owner.tech.id, owner.generator.id)).not.toBeNull();
  });

  it("requires a session", async () => {
    await expect(deleteRepairAction("a".repeat(24))).rejects.toThrow("REDIRECT:/sign-in");
  });
});

describe("due for service", () => {
  it("lists generators whose next service falls before the cut-off, soonest first", async () => {
    const { tech, customer, generator: soon } = await setup("Svc");
    const input = (label: string, serviceIntervalMonths: number | null) => ({
      ...base,
      customerId: customer.id,
      label,
      serviceIntervalMonths,
    });
    await updateGenerator(tech.id, soon.id, input("Soon", 3));
    await createRepair(tech.id, soon.id, fields(day("2026-02-20"))); // due 20 May
    const overdue = await createGenerator(tech.id, input("Overdue", 1));
    await createRepair(tech.id, overdue.id, fields(day("2026-03-01"))); // due 1 Apr
    const later = await createGenerator(tech.id, input("Later", 12));
    await createRepair(tech.id, later.id, fields(day("2026-04-01"))); // due 2027
    const noInterval = await createGenerator(tech.id, input("No interval", null));
    await createRepair(tech.id, noInterval.id, fields(day("2025-01-01")));
    await createGenerator(tech.id, input("Never repaired", 1));

    const due = await listServiceDue(tech.id, day("2026-05-24"));
    expect(due.map((g) => g.label)).toEqual(["Overdue", "Soon"]);
    expect(due[0].dueAt).toEqual(day("2026-04-01"));
    expect(due[0].customer.name).toBe("Svc customer");

    const stranger = await createTechnician("SvcOther");
    expect(await listServiceDue(stranger.id, day("2030-01-01"))).toEqual([]);
  });
});
