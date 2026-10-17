import { en, type Messages } from "./messages/en";
import { pcm } from "./messages/pcm";

export type { Messages };

// "pcm" is the ISO 639-3 code for Nigerian Pidgin.
export const locales = ["en", "pcm"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/** Cookie holding the language a technician picked on this device. */
export const LOCALE_COOKIE = "rt_locale";

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

const dictionaries: Record<Locale, Messages> = { en, pcm };

/**
 * UI strings for a locale. Server Components get the request's language from
 * `getT()` (server/i18n.ts); client components from `useMessages()`.
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
