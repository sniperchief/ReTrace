import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui";
import { getMessages } from "@/i18n";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = getMessages();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-stage">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4 md:h-16">
          <Wordmark href="/" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        {children}
        <p className="mt-10 text-center text-xs text-muted">{t.app.tagline}</p>
      </main>
    </div>
  );
}
