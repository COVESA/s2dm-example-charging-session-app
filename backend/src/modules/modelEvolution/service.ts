import type { Db, Document } from "mongodb";
import { CHARGING_SESSIONS_CANONICAL_VIEW } from "../../db/schemaEvolution";

const serialize = (value: Document | null): string | null =>
  value ? JSON.stringify(value, null, 2) : null;

export async function getModelEvolutionValidation(db: Db) {
  const raw = db.collection("chargingSessions");
  const versionCounts = await raw
    .aggregate<{ _id: number; count: number }>([
      { $group: { _id: { $ifNull: ["$schemaVersion", 6] }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
    .toArray();

  const rawV6 = await raw.findOne({
    $or: [{ schemaVersion: { $exists: false } }, { schemaVersion: 6 }]
  });
  const rawV7 = await raw.findOne({ schemaVersion: 7 });
  const sourceId = rawV6?._id ?? rawV7?._id;
  const projectedV7 = sourceId
    ? await db.collection(CHARGING_SESSIONS_CANONICAL_VIEW).findOne({ _id: sourceId })
    : null;

  return {
    versionCounts: versionCounts.map(({ _id, count }) => ({ version: _id, count })),
    rawV6Json: serialize(rawV6),
    rawV7Json: serialize(rawV7),
    projectedV7Json: serialize(projectedV7)
  };
}
