import { config } from "dotenv";
config({ path: ".env.local" });
import { promises as dns } from "node:dns";
import { MongoClient } from "mongodb";
import { classifyMongoError, getMongoDatabaseName, getMongoUri, isMongoSrvUri, isMongoUriValid } from "../src/lib/mongodb";

async function main() {
  const uri = getMongoUri();
  if (!uri) { console.error("FAIL errorCode=MONGODB_URI_NOT_CONFIGURED"); process.exitCode = 1; return; }
  if (!isMongoUriValid(uri)) { console.error("FAIL errorCode=MONGODB_URI_INVALID"); process.exitCode = 1; return; }
  let client: MongoClient | undefined;
  try {
    console.log("MongoDB URI: CONFIGURED");
    console.log(`Protocol: ${isMongoSrvUri(uri) ? "mongodb+srv" : "mongodb"}`);
    if (isMongoSrvUri(uri)) {
      const host = uri.slice("mongodb+srv://".length).split(/[/?]/, 1)[0].split("@").pop();
      try { await dns.resolveSrv(`_mongodb._tcp.${host}`); console.log("DNS SRV: PASS"); }
      catch (error) { throw Object.assign(new Error("MongoDB SRV DNS lookup failed"), { cause: error }); }
    } else console.log("DNS SRV: SKIPPED_LEGACY_URI");
    client = new MongoClient(uri); await client.connect(); const db = client.db(getMongoDatabaseName()); await db.command({ ping: 1 });
    console.log("Connection: PASS"); console.log("Authentication: PASS");
    const marker = `health_check_${Date.now()}`;
    await db.collection("backtest_counters").insertOne({ key: marker, createdAt: new Date() }); console.log("Write test: PASS");
    await db.collection("backtest_counters").findOne({ key: marker }); console.log("Read test: PASS");
    await db.collection("backtest_counters").deleteOne({ key: marker });
    console.log("Final status: PASS");
  } catch (error) { console.error(`FAIL errorCode=${classifyMongoError(error)}`); process.exitCode = 1; }
  finally { await client?.close(); }
}
main();
