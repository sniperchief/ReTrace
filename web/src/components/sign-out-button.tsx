"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMessages } from "@/i18n/client";
import { authClient } from "@/lib/auth-client";

/** Sits on the dark top bar. */
export function SignOutButton() {
  const t = useMessages();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-on-stage-muted hover:text-on-stage focus-visible:outline-2 focus-visible:outline-on-stage disabled:opacity-60"
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.replace("/");
        router.refresh();
      }}
    >
      {t.nav.signOut}
    </button>
  );
}
