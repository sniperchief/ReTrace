"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { Locale } from "./index";
import type { Messages } from "./messages/en";

const MessagesContext = createContext<{ messages: Messages; locale: Locale } | null>(null);

export function MessagesProvider({
  messages,
  locale,
  children,
}: {
  messages: Messages;
  locale: Locale;
  children: ReactNode;
}) {
  // The root <html> is static, so its lang attribute follows the chosen language here.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <MessagesContext.Provider value={{ messages, locale }}>{children}</MessagesContext.Provider>;
}

function useI18n() {
  const value = useContext(MessagesContext);
  if (!value) throw new Error("useMessages must be used inside <MessagesProvider>");
  return value;
}

/** UI strings in the technician's language, for client components. */
export function useMessages(): Messages {
  return useI18n().messages;
}

export function useLocale(): Locale {
  return useI18n().locale;
}
