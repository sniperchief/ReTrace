import { Suspense, type ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { getMessages } from "@/i18n";
import { requireTechnician } from "@/server/session";

// The shell renders statically; anything reading the session sits behind a
// Suspense boundary (this file's TechnicianMenu, and pages via loading.tsx).
export default function AppLayout({ children }: { children: ReactNode }) {
  const t = getMessages();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <span className="text-lg font-bold tracking-tight text-brand">{t.app.name}</span>
          <Suspense fallback={null}>
            <TechnicianMenu />
          </Suspense>
        </div>
        <AppNav />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">{children}</main>
    </div>
  );
}

async function TechnicianMenu() {
  const technician = await requireTechnician();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate text-sm text-muted">{technician.name}</span>
      <SignOutButton />
    </div>
  );
}
