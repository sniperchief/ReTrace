import type { TestProject } from "vitest/node";
import { MongoMemoryReplSet } from "mongodb-memory-server";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
    mongoSource: "memory" | "external";
  }
}

/**
 * Integration tests run against an in-memory MongoDB (downloaded once, free).
 * Set TEST_MONGODB_URI to run them against a real server or Atlas instead;
 * each test file uses its own throwaway database.
 */
export default async function setup(project: TestProject) {
  const external = process.env.TEST_MONGODB_URI;
  if (external) {
    project.provide("mongoUri", external);
    project.provide("mongoSource", "external");
    return;
  }
  // A single-node replica set, like Atlas, so auth transactions work.
  const server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  project.provide("mongoUri", server.getUri());
  project.provide("mongoSource", "memory");
  return async () => {
    await server.stop();
  };
}
