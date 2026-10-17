import { Suspense, type ReactNode } from "react";
import { BottomNav, TopNav } from "@/components/app-nav";
import { LanguageSwitch } from "@/components/language-switch";
import { SignOutButton } from "@/components/sign-out-button";
import { Wordmark } from "@/components/ui";
import { UploadQueue } from "@/components/upload-queue";
import { interpolate } from "@/i18n";
import { getT } from "@/server/i18n";
import { requireTechnician } from "@/server/session";

// The shell renders statically; anything reading the session sits behind a
// Suspense boundary (this file's TechnicianMenu, and pages via loading.tsx).
export default async function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 bg-stage text-on-stage print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 md:h-16">
          <div className="flex min-w-0 items-center gap-6">
            <Wordmark href="/home" />
            <TopNav />
          </div>
          <Suspense fallback={null}>
            <TechnicianMenu />
          </Suspense>
        </div>
      </header>
      <main className="pb-bottom-nav mx-auto w-full max-w-3xl flex-1 px-4 pt-6 print:max-w-none print:p-0">
        <UploadQueue />
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

async function TechnicianMenu() {
  const technician = await requireTechnician();
  const t = await getT();
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="hidden truncate text-sm text-on-stage-muted lg:inline"
        title={interpolate(t.nav.signedInAs, { name: technician.name })}>
        {technician.name}
      </span>
      <LanguageSwitch />
      <SignOutButton />
    </div>
  );
}
