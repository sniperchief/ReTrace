"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useMessages } from "@/i18n/client";
import { FLASH_COOKIE, isFlashKey, type FlashKey } from "@/lib/flash";
import { CheckIcon } from "./icons";

const SHOW_MS = 5000;
const POLL_MS = 1000;

function readAndClear(): FlashKey | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${FLASH_COOKIE}=([^;]*)`));
  if (!match) return null;
  document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/`;
  const value = decodeURIComponent(match[1]);
  return isFlashKey(value) ? value : null;
}

/** Shows the confirmation a Server Action left behind, once, after the redirect. */
export function Flash() {
  return (
    <Suspense fallback={null}>
      <FlashReader />
    </Suspense>
  );
}

function FlashReader() {
  const t = useMessages();
  const pathname = usePathname();
  // `shown` increases with every message, so a repeated message restarts the timer.
  const [message, setMessage] = useState<{ key: FlashKey; shown: number } | null>(null);
  const key = message?.key ?? null;

  useEffect(() => {
    const check = () => {
      const found = readAndClear();
      if (found) setMessage((m) => ({ key: found, shown: (m?.shown ?? 0) + 1 }));
    };
    check();
    // A redirect back to the same URL (e.g. each setup step) doesn't change the
    // pathname, so also look for a new message every second while visible.
    const poll = setInterval(() => document.visibilityState === "visible" && check(), POLL_MS);
    return () => clearInterval(poll);
  }, [pathname]);

  useEffect(() => {
    if (!message) return;
    const hide = setTimeout(() => setMessage(null), SHOW_MS);
    return () => clearTimeout(hide);
  }, [message]);

  if (!key) return null;
  return (
    <div role="status"
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center gap-3 rounded-lg bg-stage px-4 py-3 text-sm text-on-stage md:bottom-6 print:hidden">
      <CheckIcon size={18} className="shrink-0" />
      <p className="min-w-0 flex-1">{t.flash[key]}</p>
      <button type="button" onClick={() => setMessage(null)} className="shrink-0 text-on-stage-muted underline underline-offset-2">
        {t.flash.dismiss}
      </button>
    </div>
  );
}
