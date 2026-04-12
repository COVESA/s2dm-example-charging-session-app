import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/?directConnection=true";
const dbName = process.env.MONGODB_DATABASE ?? (new URL(uri).pathname.slice(1) || "charging_demo");

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) {
    return db;
  }
  console.log("Connecting to MongoDB with URI:", uri);
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export function getDb(): Db | null {
  return db;
}
