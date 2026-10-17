import { describe, expect, it } from "vitest";
import { koboToInput, parseNairaToKobo } from "@/lib/money";
import { normalizePhone, phoneSearchKeys } from "@/lib/phone";
import { readRepairForm } from "@/lib/repair-form";
import { signUpSchema } from "@/lib/schemas/auth";
import { toFieldErrors } from "@/lib/schemas/common";
import { customerInputSchema } from "@/lib/schemas/customer";
import { generatorInputSchema } from "@/lib/schemas/generator";
import { searchKeysFilter } from "@/lib/search";

function formData(entries: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("phone numbers", () => {
  it.each([
    ["0803 123 4567", "+2348031234567"],
    ["2348031234567", "+2348031234567"],
    ["+234 (803) 123-4567", "+2348031234567"],
    ["+447700900123", "+447700900123"],
  ])("normalises %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["12345", "0803123456", "phone", "+0123"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("produces local search variants", () => {
    expect(phoneSearchKeys("+2348031234567")).toEqual(["2348031234567", "08031234567", "8031234567"]);
  });
});

describe("money", () => {
  it.each([
    ["15000", 1_500_000],
    ["15,000", 1_500_000],
    ["₦2,500.5", 250_050],
    ["0.05", 5],
  ])("parses %s to kobo", (input, kobo) => {
    expect(parseNairaToKobo(input)).toBe(kobo);
  });

  it.each(["-5", "1.234", "abc", "1e5", ""])("rejects %s", (input) => {
    expect(parseNairaToKobo(input)).toBeNull();
  });

  it("round-trips to form input", () => {
    expect(koboToInput(250_050)).toBe("2500.50");
    expect(koboToInput(1_500_000)).toBe("15000");
    expect(koboToInput(null)).toBe("");
  });
});

describe("customer input", () => {
  it("turns blanks into null and normalises phone", () => {
    const parsed = customerInputSchema.parse({ name: "  Mama Bisi ", phone: "08031234567", location: " ", notes: "" });
    expect(parsed).toEqual({ name: "Mama Bisi", phone: "+2348031234567", location: null, notes: null });
  });

  it("requires a name and rejects bad phones", () => {
    const result = customerInputSchema.safeParse({ name: "", phone: "123" });
    expect(result.success).toBe(false);
    const errors = toFieldErrors(result.error!);
    expect(errors.name).toEqual(["required"]);
    expect(errors.phone).toEqual(["invalidPhone"]);
  });

  it("enforces length limits", () => {
    const result = customerInputSchema.safeParse({ name: "x".repeat(101) });
    expect(toFieldErrors(result.error!).name).toEqual(["tooLong"]);
  });
});

describe("generator input", () => {
  it("validates ids, numbers and fuel types", () => {
    const result = generatorInputSchema.safeParse({
      customerId: "not-an-id",
      label: "Big Sumec",
      capacityKva: "abc",
      fuelType: "coal",
    });
    const errors = toFieldErrors(result.error!);
    expect(errors.customerId).toEqual(["invalid"]);
    expect(errors.capacityKva).toEqual(["invalidNumber"]);
    expect(errors.fuelType).toBeDefined();
  });

  it("accepts minimal input", () => {
    const parsed = generatorInputSchema.parse({
      customerId: "0123456789abcdef01234567",
      label: "Big Sumec",
      capacityKva: "7.5",
      fuelType: "",
    });
    expect(parsed).toMatchObject({ label: "Big Sumec", capacityKva: 7.5, fuelType: null, brand: null });
  });
});

describe("repair form", () => {
  it("parses a full record, dropping blank part rows", () => {
    const result = readRepairForm(
      formData([
        ["repairDate", "2026-03-04"],
        ["reportedSymptoms", "Won't start"],
        ["diagnosis", ""],
        ["workPerformed", "Replaced plug"],
        ["totalCost", "12,500"],
        ["technicianNotes", ""],
        ["partName", "Spark plug"],
        ["partQuantity", "2"],
        ["partCost", "1500"],
        ["partName", ""],
        ["partQuantity", ""],
        ["partCost", ""],
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      repairDate: new Date("2026-03-04T00:00:00Z"),
      reportedSymptoms: "Won't start",
      diagnosis: null,
      workPerformed: "Replaced plug",
      partsReplaced: [{ name: "Spark plug", quantity: 2, costKobo: 150_000 }],
      totalCostKobo: 1_250_000,
      technicianNotes: null,
    });
  });

  it("keeps unknown details as null rather than guessing", () => {
    const result = readRepairForm(formData([["workPerformed", "Serviced"]]));
    expect(result.ok && result.data).toMatchObject({
      repairDate: null,
      diagnosis: null,
      totalCostKobo: null,
      partsReplaced: [],
    });
  });

  it("rejects an empty record", () => {
    const result = readRepairForm(formData([["repairDate", "2026-03-04"]]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors._form).toEqual(["emptyRecord"]);
  });

  it("reports per-field errors and echoes values", () => {
    const result = readRepairForm(
      formData([
        ["repairDate", "2026-02-30"],
        ["workPerformed", "x"],
        ["totalCost", "lots"],
        ["partName", ""],
        ["partQuantity", "1.5"],
        ["partCost", ""],
      ]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.repairDate).toEqual(["invalidDate"]);
    expect(result.errors.totalCost).toEqual(["invalidAmount"]);
    expect(result.errors["partsReplaced.0.name"]).toEqual(["required"]);
    expect(result.errors["partsReplaced.0.quantity"]).toEqual(["invalidQuantity"]);
    expect(result.values.totalCost).toBe("lots");
  });

  it("rejects future dates", () => {
    const result = readRepairForm(formData([["repairDate", "2999-01-01"], ["workPerformed", "x"]]));
    expect(!result.ok && result.errors.repairDate).toEqual(["futureDate"]);
  });
});

describe("auth input", () => {
  it("normalises email and enforces password length", () => {
    expect(signUpSchema.parse({ name: "Ade", email: " Ade@Example.COM ", password: "12345678" }).email).toBe(
      "ade@example.com",
    );
    const result = signUpSchema.safeParse({ name: "Ade", email: "nope", password: "short" });
    const errors = toFieldErrors(result.error!);
    expect(errors.email).toEqual(["invalidEmail"]);
    expect(errors.password).toEqual(["passwordTooShort"]);
  });
});

describe("search filter", () => {
  it("prefix-matches every word and escapes regex characters", () => {
    const filter = searchKeysFilter("Bisi (sumec") as { searchKeys: { $all: RegExp[] } };
    expect(filter.searchKeys.$all.map(String)).toEqual(["/^bisi/", "/^sumec/"]);
  });

  it("treats a spaced phone number as one term", () => {
    const filter = searchKeysFilter("0803 123 4567") as { searchKeys: { $all: RegExp[] } };
    expect(filter.searchKeys.$all.map(String)).toEqual(["/^08031234567/"]);
  });

  it("is empty for a blank query", () => {
    expect(searchKeysFilter("  ")).toEqual({});
  });
});
