// Serves the production build against a throwaway in-memory MongoDB for the
// end-to-end tests (see playwright.config.ts). Run `npm run build` first.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const port = process.env.E2E_PORT ?? "3200";
// A replica set, like Atlas, because sign-up uses transactions.
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

const next = spawn(process.execPath, [path.join("node_modules", "next", "dist", "bin", "next"), "start", "-p", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    MONGODB_URI: mongo.getUri(),
    MONGODB_DB_NAME: "retrace_e2e",
    AUTH_SECRET: randomBytes(32).toString("base64"),
    AUTH_URL: `http://localhost:${port}`,
    // AI "on" but pointed at a closed port: uploads are accepted and transcription
    // fails fast, so the voice and offline-queue paths run without a model.
    INFERENCE_MODE: "remote",
    INFERENCE_BASE_URL: "http://127.0.0.1:9",
    INFERENCE_API_KEY: randomBytes(24).toString("hex"),
    INFERENCE_TIMEOUT_MS: "5000",
  },
});

const stop = async () => {
  next.kill();
  await mongo.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
next.on("exit", async (code) => {
  await mongo.stop();
  process.exit(code ?? 0);
});
