import { MongoClient, type Db } from "mongodb";
import { initializeMongoSchema } from "./mongodb-schema";

type MongoCache = { uri: string; client: MongoClient; promise: Promise<MongoClient> };
const globalForMongo = globalThis as typeof globalThis & { __backtestgoldMongo?: MongoCache };

export function getMongoUri() { return process.env.MONGODB_URI?.trim() || ""; }
export function getMongoDatabaseName() { return process.env.MONGODB_DATABASE?.trim() || "backtestgold"; }
export function isMongoConfigured() { return Boolean(getMongoUri()); }
export type MongoErrorCode = "MONGODB_URI_NOT_CONFIGURED" | "MONGODB_URI_INVALID" | "MONGODB_DNS_SRV_FAILED" | "MONGODB_AUTHENTICATION_FAILED" | "MONGODB_NETWORK_ACCESS_FAILED" | "MONGODB_CONNECTION_FAILED";
export function isMongoUriValid(value = getMongoUri()) {
  return value.startsWith("mongodb+srv://") || value.startsWith("mongodb://");
}
export function isMongoSrvUri(value = getMongoUri()) { return value.startsWith("mongodb+srv://"); }
export function classifyMongoError(error: unknown): MongoErrorCode {
  if (!getMongoUri()) return "MONGODB_URI_NOT_CONFIGURED";
  if (!isMongoUriValid()) return "MONGODB_URI_INVALID";
  const message = error instanceof Error ? error.message : String(error);
  if (/querySrv|query srv|_mongodb\._tcp|SRV/i.test(message)) return "MONGODB_DNS_SRV_FAILED";
  if (/authentication|auth failed|bad auth|code\s*:?\s*(18|8000)/i.test(message)) return "MONGODB_AUTHENTICATION_FAILED";
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|timeout|network|querySrv|DNS|TLS/i.test(message)) return "MONGODB_NETWORK_ACCESS_FAILED";
  return "MONGODB_CONNECTION_FAILED";
}
export async function getMongoClient(): Promise<MongoClient> {
  const uri = getMongoUri();
  if (!uri) throw new Error("MONGODB_URI_NOT_CONFIGURED");
  if (!isMongoUriValid(uri)) throw new Error("MONGODB_URI_INVALID");
  if (!globalForMongo.__backtestgoldMongo || globalForMongo.__backtestgoldMongo.uri !== uri) {
    const client = new MongoClient(uri);
    globalForMongo.__backtestgoldMongo = { uri, client, promise: client.connect() };
  }
  return globalForMongo.__backtestgoldMongo.promise;
}
export async function getMongoDb(): Promise<Db> { return (await getMongoClient()).db(getMongoDatabaseName()); }
export async function ensureMongoIndexes() {
  await initializeMongoSchema(await getMongoDb());
}
