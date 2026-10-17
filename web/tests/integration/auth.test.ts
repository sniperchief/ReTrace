import { describe, expect, it } from "vitest";
import { getAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import { cookieHeader, createTechnician } from "../helpers";

const sessionFor = (cookie: string) =>
  getAuth().api.getSession({ headers: new Headers(cookie ? { cookie } : {}) });

describe("authentication", () => {
  it("signs up a technician, stores them in `technicians` and hashes the password", async () => {
    const tech = await createTechnician("Ade");
    const stored = await getDb().collection("technicians").findOne({ email: tech.email });
    expect(stored?.name).toBe("Ade");

    const account = await getDb().collection("account").findOne({ providerId: "credential" });
    expect(account?.password).toBeTypeOf("string");
    expect(account?.password).not.toContain(tech.password);
  });

  it("issues a session cookie that resolves to the technician", async () => {
    const tech = await createTechnician("Bola");
    const session = await sessionFor(tech.cookie);
    expect(session?.user.id).toBe(tech.id);
    expect(session?.user.email).toBe(tech.email);
  });

  it("has no session without a cookie or with a forged one", async () => {
    expect(await sessionFor("")).toBeNull();
    expect(await sessionFor("better-auth.session_token=forged.value")).toBeNull();
  });

  it("signs in with the right password only", async () => {
    const tech = await createTechnician("Chidi");

    const bad = await getAuth().api.signInEmail({
      body: { email: tech.email, password: "wrong-password" },
      asResponse: true,
    });
    expect(bad.status).toBe(401);

    const good = await getAuth().api.signInEmail({
      body: { email: tech.email, password: tech.password },
      asResponse: true,
    });
    expect(good.status).toBe(200);
    expect((await sessionFor(cookieHeader(good)))?.user.id).toBe(tech.id);
  });

  it("rejects duplicate emails and short passwords", async () => {
    const tech = await createTechnician("Dayo");
    const duplicate = await getAuth().api.signUpEmail({
      body: { name: "Other", email: tech.email, password: "another-password" },
      asResponse: true,
    });
    expect(duplicate.ok).toBe(false);

    const short = await getAuth().api.signUpEmail({
      body: { name: "Eke", email: "eke@example.com", password: "short" },
      asResponse: true,
    });
    expect(short.status).toBe(400);
  });

  it("ends the session on sign-out", async () => {
    const tech = await createTechnician("Femi");
    await getAuth().api.signOut({ headers: new Headers({ cookie: tech.cookie }) });
    expect(await sessionFor(tech.cookie)).toBeNull();
  });
});
