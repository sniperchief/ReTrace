import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEnv, resetEnvCache } from "@/server/env";

const saved = { ...process.env };
const AI_KEYS = ["INFERENCE_MODE", "INFERENCE_BASE_URL", "INFERENCE_API_KEY", "INFERENCE_TIMEOUT_MS"];

beforeEach(() => {
  for (const k of AI_KEYS) delete process.env[k];
  resetEnvCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  process.env = { ...saved };
  resetEnvCache();
  vi.restoreAllMocks();
});

describe("server environment", () => {
  it("turns the AI off (instead of breaking the site) when AI settings are invalid", () => {
    process.env.INFERENCE_MODE = "remote";
    process.env.INFERENCE_BASE_URL = "https://<your-inference-service>.up.railway.app";
    const env = getEnv();
    expect(env.INFERENCE_MODE).toBe("off");
    expect(env.INFERENCE_CONFIG_ERRORS).toEqual([
      "INFERENCE_BASE_URL: Invalid URL",
      "INFERENCE_API_KEY: required when INFERENCE_MODE=remote",
    ]);
    expect(env.MONGODB_URI).toBe(saved.MONGODB_URI); // the rest of the app still configured
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("uses the AI when its settings are valid, tolerating pasted spaces and quotes", () => {
    process.env.INFERENCE_MODE = " remote ";
    process.env.INFERENCE_BASE_URL = '"https://retrace-production.up.railway.app"';
    process.env.INFERENCE_API_KEY = " k".padEnd(40, "k") + " ";
    const env = getEnv();
    expect(env.INFERENCE_MODE).toBe("remote");
    expect(env.INFERENCE_BASE_URL).toBe("https://retrace-production.up.railway.app");
    expect(env.INFERENCE_API_KEY).toBe("k".repeat(39));
    expect(env.INFERENCE_CONFIG_ERRORS).toBeUndefined();
  });

  it("still refuses to start with broken core settings", () => {
    process.env.AUTH_SECRET = "short";
    expect(() => getEnv()).toThrow(/AUTH_SECRET: must be at least 32 characters/);
  });

  it("defaults to AI off when nothing is set", () => {
    expect(getEnv().INFERENCE_MODE).toBe("off");
    expect(console.error).not.toHaveBeenCalled();
  });
});
