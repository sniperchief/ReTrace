import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui";
import { getT } from "@/server/i18n";

/** A focused shell for the first-run flow: no app navigation, one way out. */
export default async function SetupLayout({ children }: { children: ReactNode }) {
  const t = await getT();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-stage">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 md:h-16">
          <Wordmark href="/home" />
          <Link href="/home"
            className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-on-stage-muted hover:text-on-stage">
            {t.setup.skip}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-8 pb-16">{children}</main>
    </div>
  );
}
