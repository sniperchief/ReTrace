import { randomBytes } from "node:crypto";
import { getAuth } from "@/server/auth";

export type TestTechnician = { id: string; email: string; password: string; cookie: string };

/** Signs up a technician through the real auth library and returns their session cookie. */
export async function createTechnician(name = "Tech"): Promise<TestTechnician> {
  const email = `${name.toLowerCase().replace(/\W/g, "")}-${randomBytes(3).toString("hex")}@example.com`;
  const password = "correct-horse-battery";
  const response = await getAuth().api.signUpEmail({
    body: { name, email, password },
    asResponse: true,
  });
  if (!response.ok) throw new Error(`sign-up failed: ${response.status} ${await response.text()}`);
  const body = (await response.json()) as { user: { id: string } };
  return { id: body.user.id, email, password, cookie: cookieHeader(response) };
}

/** Converts Set-Cookie response headers into a Cookie request header. */
export function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
