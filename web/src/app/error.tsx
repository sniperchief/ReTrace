"use client";

import { useMessages } from "@/i18n/client";
import { buttonStyles, LinkButton } from "@/components/ui";

/** Shown when a page fails to render. The error itself is logged on the server (see instrumentation.ts). */
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  const t = useMessages();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">{t.errorPage.title}</h1>
      <p className="text-muted">{t.errorPage.body}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button type="button" className={buttonStyles.primary} onClick={() => retry()}>
          {t.errorPage.retry}
        </button>
        <LinkButton href="/home" variant="secondary">{t.errorPage.home}</LinkButton>
      </div>
    </main>
  );
}
