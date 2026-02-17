import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/charging_demo";
const dbName = new URL(uri).pathname.slice(1) || "charging_demo";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) {
    return db;
  }
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export function getDb(): Db | null {
  return db;
}
