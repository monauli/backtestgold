import { config } from "dotenv";
config({ path: ".env.local" });
import { classifyMongoError, getMongoClient, getMongoDatabaseName, getMongoDb } from "../src/lib/mongodb";
import { CLOUD_COLLECTIONS, initializeMongoSchema } from "../src/lib/mongodb-schema";

async function main() {
  let client;
  try {
    client = await getMongoClient();
    const db = await getMongoDb();
    await db.command({ ping: 1 });
    await initializeMongoSchema(db);
    console.log(`MongoDB PASS database=${getMongoDatabaseName()}`);
    for (const name of CLOUD_COLLECTIONS) console.log(`PASS collection=${name}`);
    console.log("PASS schema/indexes and initial metadata are ready (existing data preserved)");
  } catch (error) {
    console.error(`MongoDB FAIL errorCode=${classifyMongoError(error)}`);
    process.exitCode = 1;
  } finally { await client?.close(); }
}
main();
