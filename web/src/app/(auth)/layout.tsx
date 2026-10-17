import type { ReactNode } from "react";
import { getMessages } from "@/i18n";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = getMessages();
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-3xl font-bold tracking-tight text-brand">{t.app.name}</p>
        <p className="mt-1 text-sm text-muted">{t.app.tagline}</p>
      </div>
      {children}
    </main>
  );
}
