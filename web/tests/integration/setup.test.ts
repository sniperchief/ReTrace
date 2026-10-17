import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

const { createCustomerAction } = await import("@/server/actions/customers");
const { createGeneratorAction, updateGeneratorAction } = await import("@/server/actions/generators");
const { createCustomer, listCustomers } = await import("@/server/data/customers");
const { createGenerator, listGenerators } = await import("@/server/data/generators");
const { createTextDraft } = await import("@/server/data/drafts");
const { createRepair } = await import("@/server/data/repairs");
const { getSetupProgress } = await import("@/server/data/setup");

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

const generatorBase = { brand: null, model: null, serialNumber: null, capacityKva: null, fuelType: null, location: null };
const repairFields = {
  repairDate: null,
  reportedSymptoms: null,
  diagnosis: null,
  workPerformed: "Changed plug",
  partsReplaced: [],
  totalCostKobo: null,
  technicianNotes: null,
};

describe("first-run setup progress", () => {
  it("walks customer → generator → first repair, resuming from the technician's records", async () => {
    const tech = await createTechnician("Newcomer");
    await expect(getSetupProgress(tech.id)).resolves.toMatchObject({ done: false, step: 1, customerId: null });

    const customer = await createCustomer(tech.id, { name: "Mama Bisi", phone: null, location: null, notes: null });
    await expect(getSetupProgress(tech.id)).resolves.toMatchObject({ step: 2, customerId: customer.id, generator: null });

    const generator = await createGenerator(tech.id, { ...generatorBase, customerId: customer.id, label: "Big Sumec" });
    await expect(getSetupProgress(tech.id)).resolves.toMatchObject({
      step: 3,
      generator: { id: generator.id, label: "Big Sumec" },
      draftId: null,
    });

    // Leaving mid-review keeps them on step 3, pointing at the waiting draft.
    const draftId = await createTextDraft(tech.id, generator.id, "Changed the plug");
    await expect(getSetupProgress(tech.id)).resolves.toMatchObject({ step: 3, draftId });

    await createRepair(tech.id, generator.id, repairFields);
    await expect(getSetupProgress(tech.id)).resolves.toEqual({ done: true });
  });

  it("only looks at the technician's own records", async () => {
    const owner = await createTechnician("Owner");
    const other = await createTechnician("Other");
    const customer = await createCustomer(owner.id, { name: "Shop", phone: null, location: null, notes: null });
    const generator = await createGenerator(owner.id, { ...generatorBase, customerId: customer.id, label: "Shop gen" });
    await createRepair(owner.id, generator.id, repairFields);

    await expect(getSetupProgress(owner.id)).resolves.toEqual({ done: true });
    await expect(getSetupProgress(other.id)).resolves.toMatchObject({ done: false, step: 1 });
  });
});

describe("setup-flow Server Actions", () => {
  let tech: TestTechnician;

  beforeAll(async () => {
    tech = await createTechnician("Flow");
  });

  beforeEach(() => {
    currentCookie = tech.cookie;
  });

  it("returns to /welcome after creating a customer and a generator from the setup flow", async () => {
    await expect(createCustomerAction({}, form({ name: "Alhaji Musa", flow: "setup" }))).rejects.toThrow(
      "REDIRECT:/welcome",
    );
    const [customer] = await listCustomers(tech.id);
    await expect(
      createGeneratorAction({}, form({ customerId: customer.id, label: "Shop generator", flow: "setup" })),
    ).rejects.toThrow("REDIRECT:/welcome");
  });

  it("keeps the usual redirects outside the setup flow", async () => {
    await expect(createCustomerAction({}, form({ name: "Iya Tunde" }))).rejects.toThrow(/REDIRECT:\/customers\/[0-9a-f]{24}$/);
    const [customer] = await listCustomers(tech.id, { query: "Tunde" });
    await expect(createGeneratorAction({}, form({ customerId: customer.id, label: "Tunde gen" }))).rejects.toThrow(
      /REDIRECT:\/generators\/[0-9a-f]{24}$/,
    );
    // Editing never returns to the setup flow, even if the field is present.
    const [generator] = await listGenerators(tech.id, { query: "Tunde" });
    await expect(
      updateGeneratorAction(generator.id, {}, form({ customerId: customer.id, label: "Tunde gen 2", flow: "setup" })),
    ).rejects.toThrow(`REDIRECT:/generators/${generator.id}`);
  });

  it("still validates and saves nothing when setup-flow input is bad", async () => {
    const before = (await listCustomers(tech.id)).length;
    const state = await createCustomerAction({}, form({ name: "", flow: "setup" }));
    expect(state.errors?.name).toBeDefined();
    expect(await listCustomers(tech.id)).toHaveLength(before);
  });
});
