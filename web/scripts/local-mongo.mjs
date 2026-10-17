// Runs a local single-node MongoDB replica set for development, using the MongoDB
// binary that mongodb-memory-server already downloaded. Data is kept in web/.data/db.
// Usage: npm run db:local   (leave it running; Ctrl+C to stop)
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

const root = path.resolve(import.meta.dirname, "..");
const cacheDir = path.join(root, "node_modules", ".cache", "mongodb-memory-server");
const binary = existsSync(cacheDir) && readdirSync(cacheDir).find((f) => /^mongod.*(\.exe)?$/.test(f) && !f.endsWith(".lock"));
if (!binary) {
  console.error("MongoDB binary not found. Run `npm test` once (it downloads MongoDB), or install MongoDB yourself.");
  process.exit(1);
}

const dbPath = path.join(root, ".data", "db");
mkdirSync(dbPath, { recursive: true });
const port = Number(process.env.LOCAL_MONGO_PORT ?? 27017);

const mongod = spawn(path.join(cacheDir, binary), ["--dbpath", dbPath, "--port", String(port), "--replSet", "rs0", "--bind_ip", "127.0.0.1"], {
  stdio: ["ignore", "ignore", "inherit"],
});
mongod.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => mongod.kill());

// Initiate the replica set once (sign-up uses transactions, which need one).
const client = new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`);
for (let attempt = 0; ; attempt++) {
  try {
    await client.connect();
    break;
  } catch (error) {
    if (attempt > 30) throw error;
    await new Promise((r) => setTimeout(r, 500));
  }
}
const admin = client.db("admin");
try {
  await admin.command({ replSetGetStatus: 1 });
} catch {
  await admin.command({ replSetInitiate: { _id: "rs0", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
}
await client.close();
console.log(`MongoDB ready: mongodb://127.0.0.1:${port}/?directConnection=true  (data in ${dbPath}; Ctrl+C to stop)`);
