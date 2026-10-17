// Creates the MongoDB indexes. Usage: npm run db:indexes
// Reads MONGODB_URI / MONGODB_DB_NAME from the environment (.env.local is loaded by the npm script).
import { MongoClient } from "mongodb";
import { ensureIndexes } from "../src/server/data/indexes";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.");
  const client = new MongoClient(uri);
  try {
    const db = client.db(process.env.MONGODB_DB_NAME || "retrace");
    await ensureIndexes(db);
    console.log(`Indexes ensured on database "${db.databaseName}".`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
