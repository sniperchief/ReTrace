import { beforeAll, describe, expect, it } from "vitest";
import { createCustomer } from "@/server/data/customers";
import { createGenerator } from "@/server/data/generators";
import { resetEnvCache } from "@/server/env";
import { handleVoiceNoteUpload } from "@/server/voice-notes";
import { fakeWebm, useFakeInference } from "../fake-inference";
import { createTechnician, type TestTechnician } from "../helpers";

let fake: ReturnType<typeof useFakeInference>;
let tech: TestTechnician;
let generatorId: string;

const upload = (cookie: string, body = fakeWebm()) =>
  handleVoiceNoteUpload(
    new Request(`http://localhost/api/generators/${generatorId}/voice-notes`, {
      method: "POST",
      headers: { "content-type": "audio/webm", cookie },
      body: body as BodyInit,
    }),
    generatorId,
  );

beforeAll(async () => {
  fake = useFakeInference();
  process.env.VOICE_NOTES_PER_HOUR = "2";
  resetEnvCache();
  tech = await createTechnician("Talker");
  const customer = await createCustomer(tech.id, { name: "Shop", phone: null, location: null, notes: null });
  generatorId = (
    await createGenerator(tech.id, {
      customerId: customer.id,
      label: "Shop gen",
      brand: null,
      model: null,
      serialNumber: null,
      capacityKva: null,
      fuelType: null,
      location: null,
    })
  ).id;
});

describe("voice note rate limit", () => {
  it("allows the hourly quota, then answers 429 without calling the AI server", async () => {
    // A rejected file doesn't use up the quota.
    expect((await upload(tech.cookie, new TextEncoder().encode("%PDF-1.7 not audio......................"))).status).toBe(415);
    expect((await upload(tech.cookie)).status).toBe(201);
    expect((await upload(tech.cookie)).status).toBe(201);
    const calls = fake.calls.length;

    const limited = await upload(tech.cookie);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("900");
    expect(await limited.json()).toEqual({ error: "rate_limited" });
    expect(fake.calls.length).toBe(calls);
  });

  it("counts each technician separately", async () => {
    const other = await createTechnician("Quiet");
    const res = await upload(other.cookie);
    // Not this technician's generator, so it's refused for that reason, not the quota.
    expect(res.status).toBe(404);
  });
});
