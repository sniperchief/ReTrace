/**
 * One-shot confirmations ("Repair saved") shown after a Server Action
 * redirects. The action sets a short-lived cookie; the browser shows the
 * message once and deletes it. Only known keys are ever displayed.
 */
export const FLASH_COOKIE = "rt_flash";

export const flashKeys = [
  "customerSaved",
  "customerDeleted",
  "generatorSaved",
  "generatorDeleted",
  "repairSaved",
  "repairDeleted",
  "draftDiscarded",
] as const;

export type FlashKey = (typeof flashKeys)[number];

export function isFlashKey(value: string | undefined): value is FlashKey {
  return !!value && (flashKeys as readonly string[]).includes(value);
}
