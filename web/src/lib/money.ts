const MAX_KOBO = 99_999_999_999; // ₦999,999,999.99

/** Parses a naira amount typed by a technician ("15,000", "₦2500.50") into kobo. */
export function parseNairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "").replace(/^NGN/i, "");
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const kobo = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return kobo <= MAX_KOBO ? kobo : null;
}

/** Plain decimal string for pre-filling form inputs ("15000", "2500.5"). */
export function koboToInput(kobo: number | null | undefined): string {
  if (kobo == null) return "";
  const naira = Math.floor(kobo / 100);
  const rest = kobo % 100;
  return rest === 0 ? String(naira) : `${naira}.${String(rest).padStart(2, "0")}`;
}

export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: kobo % 100 === 0 ? 0 : 2,
  }).format(kobo / 100);
}
