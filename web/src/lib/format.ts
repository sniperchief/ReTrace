import type { Locale } from "@/i18n";

const intlLocale: Record<Locale, string> = { en: "en-NG" };

/** Date-only values (repair dates) are stored at UTC midnight. */
export function formatDate(date: Date, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function toDateInput(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function todayDateInput(): string {
  // Technicians are in Nigeria (WAT, UTC+1).
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
}
