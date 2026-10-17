import "server-only";
import { MongoClient, type Db } from "mongodb";
import { getEnv } from "./env";

// Reuse one client per process (and across hot reloads in development).
const globalForMongo = globalThis as unknown as { _retraceMongo?: MongoClient };

export function getMongoClient(): MongoClient {
  if (!globalForMongo._retraceMongo) {
    globalForMongo._retraceMongo = new MongoClient(getEnv().MONGODB_URI, {
      appName: "retrace-web",
      maxPoolSize: 10,
    });
  }
  return globalForMongo._retraceMongo;
}

export function getDb(): Db {
  return getMongoClient().db(getEnv().MONGODB_DB_NAME);
}
