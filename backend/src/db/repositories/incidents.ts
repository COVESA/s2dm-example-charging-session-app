import type { Db } from "mongodb";
import { ObjectId } from "mongodb";

export type IncidentSeverityDoc = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type IncidentDoc = {
  _id: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  type: "USER_REPORT";
  severity: IncidentSeverityDoc;
  status: "OPEN";
  stationId: ObjectId;
  chargingPointId?: ObjectId | null;
  sessionId?: ObjectId | null;
  detection: {
    source: "USER";
  };
  description: string;
  resolution: {
    resolvedAt: Date | null;
    resolvedByUserId: ObjectId | null;
    notes: string | null;
  };
};

type InsertIncidentInput = {
  stationId: ObjectId;
  chargingPointId?: ObjectId | null;
  sessionId?: ObjectId | null;
  severity: IncidentSeverityDoc;
  description: string;
};

export async function insertUserReportedIncident(
  database: Db,
  input: InsertIncidentInput
): Promise<IncidentDoc> {
  const nowDate = new Date();

  const doc: Omit<IncidentDoc, "_id"> = {
    createdAt: nowDate,
    updatedAt: nowDate,
    type: "USER_REPORT",
    severity: input.severity,
    status: "OPEN",
    stationId: input.stationId,
    chargingPointId: input.chargingPointId ?? null,
    sessionId: input.sessionId ?? null,
    detection: {
      source: "USER"
    },
    description: input.description,
    resolution: {
      resolvedAt: null,
      resolvedByUserId: null,
      notes: null
    }
  };

  const result = await database.collection<IncidentDoc>("incidents").insertOne(doc as IncidentDoc);

  return {
    _id: result.insertedId,
    ...doc
  };
}
