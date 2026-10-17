import { en, type Messages } from "./messages/en";

export type { Messages };

export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

const dictionaries: Record<Locale, Messages> = { en };

/**
 * Returns the UI strings for a locale. Only English exists today; when more
 * locales are added, resolve the locale from the technician's profile or a
 * cookie and pass it here.
 */
export function getMessages(locale: Locale = defaultLocale): Messages {
  return dictionaries[locale];
}

/** Fills `{name}` placeholders, e.g. interpolate("Up to {minutes} minutes.", { minutes: 3 }). */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** Translate a validation error code (see `messages.errors`) into text. */
export function errorMessage(messages: Messages, code: string | undefined): string {
  if (!code) return messages.errors.invalid;
  return (messages.errors as Record<string, string>)[code] ?? messages.errors.invalid;
}
