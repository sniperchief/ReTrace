"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMessages } from "@/i18n/client";
import { authClient } from "@/lib/auth-client";
import { buttonStyles } from "./ui";

export function SignOutButton() {
  const t = useMessages();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      className={buttonStyles.ghost}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.replace("/sign-in");
        router.refresh();
      }}
    >
      {t.nav.signOut}
    </button>
  );
}
