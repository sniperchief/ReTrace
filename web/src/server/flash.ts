import "server-only";
import { cookies } from "next/headers";
import { FLASH_COOKIE, type FlashKey } from "@/lib/flash";

/** Queue a confirmation for the next page. Call from a Server Action before redirecting. */
export async function setFlash(key: FlashKey): Promise<void> {
  // Readable by the page script (not httpOnly): it holds only a message key.
  (await cookies()).set(FLASH_COOKIE, key, { path: "/", maxAge: 60, sameSite: "lax" });
}
