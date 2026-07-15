import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import { CHARGING_SESSIONS_CANONICAL_VIEW } from "../db/schemaEvolution";

const uri =
  process.env.MONGODB_URI ??
  "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true";
const databaseName =
  process.env.MONGODB_DATABASE ?? (new URL(uri).pathname.slice(1) || "charging_demo");

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(databaseName);

  try {
    const rawInfo = await db
      .listCollections({ name: "chargingSessions" }, { nameOnly: false })
      .next();
    const viewInfo = await db
      .listCollections({ name: CHARGING_SESSIONS_CANONICAL_VIEW }, { nameOnly: false })
      .next();
    assert.ok(rawInfo?.options?.validator, "chargingSessions validator is not installed");
    assert.equal(
      viewInfo?.type,
      "view",
      `${CHARGING_SESSIONS_CANONICAL_VIEW} is not installed`
    );

    const distribution = await db
      .collection("chargingSessions")
      .aggregate<{ _id: number; count: number }>([
        { $group: { _id: { $ifNull: ["$schemaVersion", 6] }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
      .toArray();
    assert.ok(distribution.some((entry) => entry._id === 6), "no effective v6 documents");
    assert.ok(distribution.some((entry) => entry._id === 7), "no v7 fixture documents");

    const rawV6 = await db.collection("chargingSessions").findOne({
      $and: [
        { $or: [{ schemaVersion: { $exists: false } }, { schemaVersion: 6 }] },
        { "charging.meterStartKwh": { $type: "number" } }
      ]
    });
    assert.ok(rawV6, "no numeric v6 meter fixture found");

    const canonical = await db
      .collection(CHARGING_SESSIONS_CANONICAL_VIEW)
      .findOne({ _id: rawV6._id });
    assert.equal(
      canonical?.charging.meterStart,
      rawV6.charging.meterStartKwh * 1000,
      "v6 meterStart was not renamed and scaled to Wh"
    );
    assert.equal(canonical?.schemaVersion, 7);

    const unchanged = await db
      .collection("chargingSessions")
      .findOne({ _id: rawV6._id });
    assert.equal(unchanged?.charging.meterStartKwh, rawV6.charging.meterStartKwh);
    assert.equal(unchanged?.charging.meterStart, undefined);

    const rawV7 = await db.collection("chargingSessions").findOne({ schemaVersion: 7 });
    assert.ok(rawV7, "no v7 identity fixture found");
    const canonicalV7 = await db
      .collection(CHARGING_SESSIONS_CANONICAL_VIEW)
      .findOne({ _id: rawV7._id });
    assert.equal(canonicalV7?.charging.meterStart, rawV7.charging.meterStart);
    assert.equal(canonicalV7?.charging.meterStop, rawV7.charging.meterStop);

    const [rawEnergy, canonicalEnergy] = await Promise.all([
      db
        .collection("chargingSessions")
        .aggregate([{ $group: { _id: null, total: { $sum: "$charging.energyDeliveredKwh" } } }])
        .next(),
      db
        .collection(CHARGING_SESSIONS_CANONICAL_VIEW)
        .aggregate([{ $group: { _id: null, total: { $sum: "$charging.energyDeliveredKwh" } } }])
        .next()
    ]);
    assert.equal(rawEnergy?.total, canonicalEnergy?.total, "mixed-version energy total changed");

    console.log("Schema evolution validation passed.");
    console.log("Effective version distribution:", distribution);
    console.log("Checked source document:", String(rawV6._id));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
