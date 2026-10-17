"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { locales } from "@/i18n";
import { useLocale, useMessages } from "@/i18n/client";
import { setLocaleAction } from "@/server/actions/locale";

/** Switches between English and Pidgin. Shows the language you'd switch to. */
export function LanguageSwitch({ tone = "stage" }: { tone?: "stage" | "light" }) {
  const t = useMessages();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = locales.find((l) => l !== locale) ?? locale;

  return (
    <button
      type="button"
      disabled={pending}
      lang={next}
      aria-label={`${t.nav.language}: ${t.nav.languageNames[next]}`}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium disabled:opacity-60 ${
        tone === "stage"
          ? "text-on-stage-muted hover:text-on-stage focus-visible:outline-2 focus-visible:outline-on-stage"
          : "text-muted underline underline-offset-2 hover:text-foreground"
      }`}
      onClick={() =>
        startTransition(async () => {
          await setLocaleAction(next);
          router.refresh();
        })
      }
    >
      {t.nav.languageNames[next]}
    </button>
  );
}
