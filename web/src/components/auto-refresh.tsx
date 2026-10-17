"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the page periodically while background work (e.g. extraction in another tab) finishes. */
export function AutoRefresh({ everyMs = 4000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(timer);
  }, [router, everyMs]);
  return null;
}
