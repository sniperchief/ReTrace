import { describe, expect, it } from "vitest";
import { getMessages } from "@/i18n";
import { repairMessage, serviceReminderMessage } from "@/lib/customer-messages";
import { isFlashKey } from "@/lib/flash";
import { telHref, whatsappHref } from "@/lib/phone";
import { generatorInputSchema } from "@/lib/schemas/generator";
import { daysUntil, nextServiceDue } from "@/lib/service";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const t = getMessages();

describe("service due dates", () => {
  it("adds calendar months, clamping to the end of shorter months", () => {
    expect(nextServiceDue(day("2026-01-15"), 3)).toEqual(day("2026-04-15"));
    expect(nextServiceDue(day("2026-01-31"), 1)).toEqual(day("2026-02-28"));
    expect(nextServiceDue(day("2027-12-31"), 2)).toEqual(day("2028-02-29"));
    expect(nextServiceDue(day("2026-11-10"), 12)).toEqual(day("2027-11-10"));
  });

  it("needs both a dated repair and an interval", () => {
    expect(nextServiceDue(null, 3)).toBeNull();
    expect(nextServiceDue(day("2026-01-15"), null)).toBeNull();
  });

  it("counts whole days, negative when overdue", () => {
    const now = new Date("2026-05-10T15:30:00Z");
    expect(daysUntil(day("2026-05-10"), now)).toBe(0);
    expect(daysUntil(day("2026-05-12"), now)).toBe(2);
    expect(daysUntil(day("2026-05-07"), now)).toBe(-3);
  });

  it("accepts a blank or whole-month interval only", () => {
    const base = { customerId: "a".repeat(24), label: "Gen" };
    expect(generatorInputSchema.parse({ ...base, serviceIntervalMonths: "" }).serviceIntervalMonths).toBeNull();
    expect(generatorInputSchema.parse({ ...base, serviceIntervalMonths: "6" }).serviceIntervalMonths).toBe(6);
    expect(generatorInputSchema.safeParse({ ...base, serviceIntervalMonths: "1.5" }).success).toBe(false);
    expect(generatorInputSchema.safeParse({ ...base, serviceIntervalMonths: "0" }).success).toBe(false);
    expect(generatorInputSchema.safeParse({ ...base, serviceIntervalMonths: "99" }).success).toBe(false);
  });
});

describe("customer messages", () => {
  it("includes only what was recorded", () => {
    const text = repairMessage(t, {
      customerName: "Mama Bisi",
      generatorLabel: "Big Sumec",
      date: "3 Aug 2026",
      reportedSymptoms: null,
      workPerformed: "Replaced AVR",
      parts: [{ name: "AVR", quantity: 1, costKobo: 1_500_000 }, { name: "Plug", quantity: 2, costKobo: null }],
      totalKobo: 2_000_000,
      technicianName: "Chidi",
    });
    expect(text).toContain("Hello Mama Bisi,");
    expect(text).toContain('"Big Sumec" (3 Aug 2026)');
    expect(text).toContain("Work done: Replaced AVR");
    expect(text).toContain("- AVR (₦15,000)");
    expect(text).toContain("- Plug ×2");
    expect(text).toContain("Total: ₦20,000");
    expect(text).not.toContain("Problem:");
    expect(text.endsWith("Thank you. Chidi")).toBe(true);
    expect(text).not.toMatch(/\n{3,}/);
  });

  it("builds a service reminder", () => {
    expect(serviceReminderMessage(t, { customerName: "Iya Tunde", generatorLabel: "Shop gen", technicianName: "Ada" }))
      .toBe('Hello Iya Tunde, this is Ada. Your generator "Shop gen" is due for its service. Reply to book a visit.');
  });

  it("links to the phone and to WhatsApp with the text encoded", () => {
    expect(telHref("+2348031234567")).toBe("tel:+2348031234567");
    expect(whatsappHref("+2348031234567")).toBe("https://wa.me/2348031234567");
    expect(whatsappHref("+2348031234567", "Hi & bye")).toBe("https://wa.me/2348031234567?text=Hi%20%26%20bye");
  });

  it("only shows known confirmation keys", () => {
    expect(isFlashKey("repairSaved")).toBe(true);
    expect(isFlashKey("<script>")).toBe(false);
    expect(isFlashKey(undefined)).toBe(false);
  });
});
