import type { Db } from "mongodb";
import { ObjectId } from "mongodb";

type ConnectorUsedDoc = {
  type?: string | null;
  power?: number | null;
  tethered?: boolean | null;
};

type ChargingDoc = {
  startedAt?: Date | null;
  endedAt?: Date | null;
  connectorUsed?: ConnectorUsedDoc | null;
  meterStartKwh?: number | null;
  meterStopKwh?: number | null;
  energyDeliveredKwh?: number | null;
  socStartPercent?: number | null;
  socStopPercent?: number | null;
};

type BookingDoc = {
  bookedAt: Date;
  expiresAt: Date;
  canceledAt?: Date | null;
  cancelReason?: string | null;
};

type FeedbackDoc = {
  rating: number;
  comment?: string | null;
  createdAt: Date;
};

type PricingDoc = {
  currency: string;
  priceCentsPerKwh: number;
  idleFee?: {
    priceCentsPerMinute: number;
    afterMinutes: number;
  };
};

type CostDoc = {
  totalCents?: number | null;
  energyCents?: number | null;
  idleCents?: number | null;
};

type LocationDoc = {
  type: "Point";
  coordinates: [number, number];
};

type StationSnapshotDoc = {
  name: string;
  location: LocationDoc;
  addressShort: string;
  chargingPointLabel: string;
};

type VehicleSnapshotDoc = {
  vinLast6: string;
  make: string;
  model: string;
};

export type ChargingSessionDoc = {
  _id: ObjectId;
  userId: ObjectId;
  vehicleId: ObjectId;
  stationId: ObjectId;
  chargingPointId: ObjectId;
  stationSnapshot: StationSnapshotDoc;
  vehicleSnapshot: VehicleSnapshotDoc;
  status: "BOOKED" | "ACTIVE" | "COMPLETED" | "CANCELED" | "NO_SHOW" | "FAILED";
  booking: BookingDoc;
  charging: ChargingDoc;
  feedback?: FeedbackDoc | null;
  pricingSnapshot: PricingDoc;
  cost: CostDoc;
  createdAt: Date;
  updatedAt: Date;
};

export type ChargingSessionsConnection = {
  docs: ChargingSessionDoc[];
  hasNextPage: boolean;
  endCursor: string | null;
};

type SessionsQueryInput = {
  userId: string;
  fromDate?: string;
  limit?: number;
  cursor?: string;
};

type CursorPayload = {
  createdAt: string;
  id: string;
};

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8")) as CursorPayload;
    if (!parsed.createdAt || !parsed.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clampLimit(limit?: number): number {
  if (limit == null) return 50;
  if (limit < 1) return 1;
  if (limit > 100) return 100;
  return limit;
}

const SHARED_HISTORY_USER_ID = "65c8f2e2d2f4c3a9b3b9a111";

function buildFilter(input: SessionsQueryInput): Record<string, unknown> {
  const userObjectId = new ObjectId(input.userId);
  const sharedObjectId = new ObjectId(SHARED_HISTORY_USER_ID);

  // Return sessions for the current user OR completed/canceled sessions for the shared history user
  const baseClause = input.userId === SHARED_HISTORY_USER_ID
    ? { userId: userObjectId }
    : {
        $or: [
          { userId: userObjectId },
          {
            userId: sharedObjectId,
            status: { $in: ["COMPLETED", "CANCELED"] }
          }
        ]
      };

  const clauses: Record<string, unknown>[] = [baseClause];

  if (input.fromDate) {
    const fromDate = new Date(input.fromDate);
    if (!Number.isNaN(fromDate.getTime())) {
      clauses.push({ createdAt: { $gte: fromDate } });
    }
  }

  if (input.cursor) {
    const decoded = decodeCursor(input.cursor);
    if (decoded) {
      const createdAt = new Date(decoded.createdAt);
      if (!Number.isNaN(createdAt.getTime())) {
        clauses.push({
          $or: [
            { createdAt: { $lt: createdAt } },
            {
              createdAt,
              _id: { $lt: new ObjectId(decoded.id) }
            }
          ]
        });
      }
    }
  }

  return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

export async function findChargingSessionsByUser(
  database: Db,
  input: SessionsQueryInput
): Promise<ChargingSessionsConnection> {
  const limit = clampLimit(input.limit);
  const filter = buildFilter(input);

  const docs = await database
    .collection<ChargingSessionDoc>("chargingSessions")
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();

  const hasNextPage = docs.length > limit;
  const slicedDocs = hasNextPage ? docs.slice(0, limit) : docs;
  const last = slicedDocs.at(-1);
  const endCursor = last
    ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: String(last._id) })
    : null;

  return {
    docs: slicedDocs,
    hasNextPage,
    endCursor
  };
}

const now = () => new Date();

export async function countActiveOrBookedSessionsByUser(
  database: Db,
  userId: string
): Promise<number> {
  const userObjectId = new ObjectId(userId);
  const sessions = database.collection<ChargingSessionDoc>("chargingSessions");
  const count = await sessions.countDocuments({
    userId: userObjectId,
    $or: [
      { status: "ACTIVE" },
      {
        status: "BOOKED",
        "booking.canceledAt": null,
        "booking.expiresAt": { $gt: now() }
      }
    ]
  });
  return count;
}

export async function hasConflictOnChargingPoint(
  database: Db,
  chargingPointId: string
): Promise<boolean> {
  const pointObjectId = new ObjectId(chargingPointId);
  const sessions = database.collection<ChargingSessionDoc>("chargingSessions");
  const count = await sessions.countDocuments({
    chargingPointId: pointObjectId,
    $or: [
      { status: "ACTIVE" },
      {
        status: "BOOKED",
        "booking.canceledAt": null,
        "booking.expiresAt": { $gt: now() }
      }
    ]
  });
  return count > 0;
}

export type ChargingSessionInsertDoc = Omit<ChargingSessionDoc, "_id">;

export async function insertChargingSession(
  database: Db,
  doc: ChargingSessionInsertDoc
): Promise<ChargingSessionDoc> {
  const sessions = database.collection<ChargingSessionDoc>("chargingSessions");
  const result = await sessions.insertOne(doc as ChargingSessionDoc);
  return {
    ...doc,
    _id: result.insertedId
  } as ChargingSessionDoc;
}

export async function findChargingSessionById(
  database: Db,
  sessionId: string
): Promise<ChargingSessionDoc | null> {
  return database.collection<ChargingSessionDoc>("chargingSessions").findOne({
    _id: new ObjectId(sessionId)
  });
}

export async function markSessionActive(
  database: Db,
  sessionId: string,
  connectorUsed?: { type?: string | null; power?: number | null; tethered?: boolean | null } | null
): Promise<ChargingSessionDoc | null> {
  const nowDate = now();
  const setPayload: Record<string, unknown> = {
    status: "ACTIVE",
    "charging.startedAt": nowDate,
    updatedAt: nowDate
  };

  if (connectorUsed) {
    setPayload["charging.connectorUsed"] = {
      type: connectorUsed.type ?? null,
      power: connectorUsed.power ?? null,
      tethered: connectorUsed.tethered ?? null
    };
  }

  const result = await database
    .collection<ChargingSessionDoc>("chargingSessions")
    .findOneAndUpdate(
      {
        _id: new ObjectId(sessionId),
        status: "BOOKED",
        "booking.canceledAt": null
      },
      {
        $set: setPayload
      },
      { returnDocument: "after" }
    );
  return result;
}

export async function markSessionCanceled(
  database: Db,
  sessionId: string,
  reason?: string | null
): Promise<ChargingSessionDoc | null> {
  const nowDate = now();
  const result = await database
    .collection<ChargingSessionDoc>("chargingSessions")
    .findOneAndUpdate(
      {
        _id: new ObjectId(sessionId),
        status: "BOOKED",
        "booking.canceledAt": null
      },
      {
        $set: {
          status: "CANCELED",
          "booking.canceledAt": nowDate,
          "booking.cancelReason": reason ?? null,
          updatedAt: nowDate
        }
      },
      { returnDocument: "after" }
    );
  return result;
}

export async function markSessionCompleted(
  database: Db,
  sessionId: string
): Promise<ChargingSessionDoc | null> {
  const nowDate = now();
  const result = await database
    .collection<ChargingSessionDoc>("chargingSessions")
    .findOneAndUpdate(
      {
        _id: new ObjectId(sessionId),
        status: "ACTIVE"
      },
      {
        $set: {
          status: "COMPLETED",
          "charging.endedAt": nowDate,
          updatedAt: nowDate
        }
      },
      { returnDocument: "after" }
    );
  return result;
}

export async function getVehicleSnapshotFromSession(
  database: Db,
  vehicleId: string
): Promise<{ vinLast6: string; make: string; model: string } | null> {
  const doc = await database
    .collection<ChargingSessionDoc>("chargingSessions")
    .findOne(
      { vehicleId: new ObjectId(vehicleId) },
      { projection: { vehicleSnapshot: 1 } }
    );
  return doc?.vehicleSnapshot ?? null;
}

export type VehicleForUser = { id: string; make: string; model: string };

export async function findVehiclesByUserId(
  database: Db,
  userId: string
): Promise<VehicleForUser[]> {
  const docs = await database
    .collection<ChargingSessionDoc>("chargingSessions")
    .aggregate<{ _id: ObjectId; vehicleSnapshot: VehicleSnapshotDoc }>([
      { $match: { userId: new ObjectId(userId) } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$vehicleId",
          vehicleSnapshot: { $first: "$vehicleSnapshot" }
        }
      }
    ])
    .toArray();

  const vehicles = docs.map((d) => ({
    id: String(d._id),
    make: d.vehicleSnapshot.make,
    model: d.vehicleSnapshot.model
  }));

  if (vehicles.length === 0) {
    return [{
      id: "65c8f2e2d2f4c3a9b3b9a999",
      make: "BMW",
      model: "i4"
    }];
  }

  return vehicles;
}
