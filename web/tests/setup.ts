import { randomBytes } from "node:crypto";
import type { MongoClient } from "mongodb";
import { afterAll, inject, vi } from "vitest";

// `connection()` only works inside a real Next.js request; tests call server code directly.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

// Each test file gets its own database so files can run in parallel.
const dbName = `retrace_test_${randomBytes(4).toString("hex")}`;
process.env.MONGODB_URI = inject("mongoUri");
process.env.MONGODB_DB_NAME = dbName;
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-0123";
process.env.AUTH_URL = "http://localhost:3000";

afterAll(async () => {
  // Only clean up if the file actually used the database (see src/server/db.ts).
  const holder = globalThis as unknown as { _retraceMongo?: MongoClient };
  const client = holder._retraceMongo;
  if (!client) return;
  await client.db(dbName).dropDatabase().catch(() => {});
  await client.close();
  holder._retraceMongo = undefined;
});
