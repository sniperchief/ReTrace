import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTechnician, type TestTechnician } from "../helpers";

// Simulate the Next.js request context: the cookie header of the "current request".
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

const { requireTechnician } = await import("@/server/session");
const { createCustomerAction, updateCustomerAction } = await import("@/server/actions/customers");
const { createRepairAction } = await import("@/server/actions/repairs");
const { getCustomer, createCustomer } = await import("@/server/data/customers");
const { createGenerator } = await import("@/server/data/generators");
const { getRepairHistory } = await import("@/server/data/repairs");

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

describe("authorization in pages and Server Actions", () => {
  let a: TestTechnician;
  let b: TestTechnician;

  beforeAll(async () => {
    a = await createTechnician("Alpha");
    b = await createTechnician("Bravo");
  });

  beforeEach(() => {
    currentCookie = "";
  });

  it("redirects signed-out visitors to sign-in", async () => {
    await expect(requireTechnician()).rejects.toThrow("REDIRECT:/sign-in");
  });

  it("returns the signed-in technician from the session", async () => {
    currentCookie = a.cookie;
    await expect(requireTechnician()).resolves.toMatchObject({ id: a.id, email: a.email });
  });

  it("blocks Server Actions without a session", async () => {
    await expect(createCustomerAction({}, form({ name: "Ghost" }))).rejects.toThrow("REDIRECT:/sign-in");
  });

  it("returns validation errors instead of saving bad input", async () => {
    currentCookie = a.cookie;
    const state = await createCustomerAction({}, form({ name: "", phone: "12" }));
    expect(state.errors).toMatchObject({ name: ["required"], phone: ["invalidPhone"] });
    expect(state.values?.phone).toBe("12");
  });

  it("creates records owned by the session's technician, ignoring any id in the form", async () => {
    currentCookie = a.cookie;
    // A forged technicianId field must have no effect.
    await expect(
      createCustomerAction({}, form({ name: "Mama Bisi", technicianId: b.id })),
    ).rejects.toThrow(/REDIRECT:\/customers\/[a-f\d]{24}/);
  });

  it("returns 404 when updating another technician's customer", async () => {
    const aCustomer = await createCustomer(a.id, { name: "Owned by A", phone: null, location: null, notes: null });
    currentCookie = b.cookie;
    await expect(updateCustomerAction(aCustomer.id, {}, form({ name: "Taken over" }))).rejects.toThrow("NOT_FOUND");
    expect((await getCustomer(a.id, aCustomer.id))?.name).toBe("Owned by A");
  });

  it("returns 404 when adding a repair to another technician's generator", async () => {
    const aCustomer = await createCustomer(a.id, { name: "C", phone: null, location: null, notes: null });
    const aGenerator = await createGenerator(a.id, {
      customerId: aCustomer.id,
      label: "A's generator",
      brand: null,
      model: null,
      serialNumber: null,
      capacityKva: null,
      fuelType: null,
      location: null,
    });
    currentCookie = b.cookie;
    await expect(
      createRepairAction(aGenerator.id, {}, form({ workPerformed: "Injected" })),
    ).rejects.toThrow("NOT_FOUND");
    expect(await getRepairHistory(a.id, aGenerator.id)).toEqual([]);
  });
});
