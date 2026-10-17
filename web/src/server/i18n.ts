import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { defaultLocale, getMessages, isLocale, LOCALE_COOKIE, type Locale, type Messages } from "@/i18n";

/** The technician's chosen language for this request (a cookie set by the language switch). */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
});

/** UI strings in the request's language. Server Components only; client components use `useMessages()`. */
export async function getT(): Promise<Messages> {
  return getMessages(await getLocale());
}
