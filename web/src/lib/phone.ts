/**
 * Normalises a phone number to E.164. Nigerian local formats
 * ("0803 123 4567", "234803…", "+234 803…") become "+234XXXXXXXXXX".
 * Other international numbers must start with "+". Returns null if invalid.
 */
export function normalizePhone(input: string): string | null {
  const compact = input.replace(/[\s\-().]/g, "");
  if (/^0\d{10}$/.test(compact)) return `+234${compact.slice(1)}`;
  if (/^234\d{10}$/.test(compact)) return `+${compact}`;
  if (/^\+234\d{10}$/.test(compact)) return compact;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  return null;
}

/** Variants a technician might type when searching for a stored number. */
export function phoneSearchKeys(e164: string): string[] {
  const digits = e164.replace(/^\+/, "");
  const keys = [digits];
  if (digits.startsWith("234")) {
    const national = digits.slice(3);
    keys.push(`0${national}`, national);
  }
  return keys;
}
