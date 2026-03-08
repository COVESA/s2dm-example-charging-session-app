import type { Db } from "mongodb";
import { ObjectId } from "mongodb";

import {
  findChargingSessionsByUser,
  countActiveOrBookedSessionsByUser,
  hasConflictOnChargingPoint,
  insertChargingSession,
  getVehicleSnapshotFromSession,
  findChargingSessionById,
  markSessionActive,
  markSessionCanceled,
  markSessionCompleted,
  addSessionFeedback as addSessionFeedbackToSession,
  type ChargingSessionDoc
} from "../../db/repositories/chargingSessions";
import {
  findChargingStationById,
  markChargingPointReserved,
  markChargingPointAvailable
} from "../../db/repositories/chargingStations";

export class UserAlreadyHasActiveBookingError extends Error {
  constructor() {
    super("User already has an active or booked session");
    this.name = "UserAlreadyHasActiveBooking";
  }
}

export class ChargingPointUnavailableError extends Error {
  constructor() {
    super("Charging point is not available");
    this.name = "ChargingPointUnavailable";
  }
}

export class StationOrPointNotFoundError extends Error {
  constructor() {
    super("Station or charging point not found");
    this.name = "StationOrPointNotFound";
  }
}

export class ChargingSessionNotFoundError extends Error {
  constructor() {
    super("Charging session not found");
    this.name = "ChargingSessionNotFound";
  }
}

export class InvalidSessionTransitionError extends Error {
  constructor() {
    super("Session cannot be transitioned from current status");
    this.name = "InvalidSessionTransition";
  }
}

export class BookingExpiredError extends Error {
  constructor() {
    super("Booked session has expired");
    this.name = "BookingExpired";
  }
}

export class InvalidSessionFeedbackError extends Error {
  constructor() {
    super("Session feedback rating must be between 1 and 5");
    this.name = "InvalidSessionFeedback";
  }
}

export class SessionFeedbackAlreadyExistsError extends Error {
  constructor() {
    super("Session feedback already exists");
    this.name = "SessionFeedbackAlreadyExists";
  }
}

type GetChargingSessionsInput = {
  userId: string;
  fromDate?: string;
  limit?: number;
  cursor?: string;
};

export async function getChargingSessionsByUser(db: Db, input: GetChargingSessionsInput) {
  const result = await findChargingSessionsByUser(db, input);

  return {
    edges: result.docs.map((doc) => {
      const [lng, lat] = doc.stationSnapshot.location.coordinates;
      return {
        id: String(doc._id),
        userId: String(doc.userId),
        vehicleId: String(doc.vehicleId),
        stationId: String(doc.stationId),
        chargingPointId: String(doc.chargingPointId),
        stationSnapshot: {
          name: doc.stationSnapshot.name,
          location: { lat, lng },
          addressShort: doc.stationSnapshot.addressShort,
          chargingPointLabel: doc.stationSnapshot.chargingPointLabel
        },
        vehicleSnapshot: {
          vinLast6: doc.vehicleSnapshot.vinLast6,
          make: doc.vehicleSnapshot.make,
          model: doc.vehicleSnapshot.model
        },
        status: doc.status,
        booking: {
          bookedAt: doc.booking.bookedAt.toISOString(),
          expiresAt: doc.booking.expiresAt.toISOString(),
          canceledAt: doc.booking.canceledAt?.toISOString(),
          cancelReason: doc.booking.cancelReason ?? null
        },
        charging: {
          startedAt: doc.charging.startedAt?.toISOString(),
          endedAt: doc.charging.endedAt?.toISOString(),
          connectorUsed: doc.charging.connectorUsed
            ? {
                type: doc.charging.connectorUsed.type ?? null,
                power: doc.charging.connectorUsed.power ?? null,
                tethered: doc.charging.connectorUsed.tethered ?? null
              }
            : null,
          meterStartKwh: doc.charging.meterStartKwh ?? null,
          meterStopKwh: doc.charging.meterStopKwh ?? null,
          energyDeliveredKwh: doc.charging.energyDeliveredKwh ?? null,
          socStartPercent: doc.charging.socStartPercent ?? null,
          socStopPercent: doc.charging.socStopPercent ?? null
        },
        feedback: mapSessionFeedback(doc),
        pricingSnapshot: {
          currency: doc.pricingSnapshot.currency,
          priceCentsPerKwh: doc.pricingSnapshot.priceCentsPerKwh,
          idleFee: doc.pricingSnapshot.idleFee
            ? {
                priceCentsPerMinute: doc.pricingSnapshot.idleFee.priceCentsPerMinute,
                afterMinutes: doc.pricingSnapshot.idleFee.afterMinutes
              }
            : null
        },
        cost: {
          totalCents: doc.cost.totalCents ?? null,
          energyCents: doc.cost.energyCents ?? null,
          idleCents: doc.cost.idleCents ?? null
        },
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString()
      };
    }),
    hasNextPage: result.hasNextPage,
    endCursor: result.endCursor
  };
}

type ReserveChargingPointInput = {
  userId: string;
  vehicleId: string;
  stationId: string;
  chargingPointId: string;
};

function formatAddressShort(address: { street?: string; city?: string; postalCode?: string; country?: string } | undefined): string {
  if (!address) return "";
  const parts = [address.street, address.city].filter(Boolean);
  return parts.join(", ") || "Unknown";
}

function isValidObjectId(value: string): boolean {
  return ObjectId.isValid(value);
}

export async function createBooking(db: Db, input: ReserveChargingPointInput) {
  const userObjectId = new ObjectId(input.userId);
  const stationObjectId = new ObjectId(input.stationId);
  const chargingPointObjectId = new ObjectId(input.chargingPointId);

  const activeCount = await countActiveOrBookedSessionsByUser(db, input.userId);
  if (activeCount > 0) {
    throw new UserAlreadyHasActiveBookingError();
  }

  const hasConflict = await hasConflictOnChargingPoint(db, input.chargingPointId);
  if (hasConflict) {
    throw new ChargingPointUnavailableError();
  }

  const station = await findChargingStationById(db, stationObjectId);
  if (!station) {
    throw new StationOrPointNotFoundError();
  }

  const pointIndex = station.chargingPoints.findIndex(
    (cp) => cp.chargingPointId.equals(chargingPointObjectId)
  );
  if (pointIndex < 0) {
    throw new StationOrPointNotFoundError();
  }

  const point = station.chargingPoints[pointIndex];
  if (point.outOfService || !(point.availableNow ?? true)) {
    throw new ChargingPointUnavailableError();
  }

  const vehicleSnapshot = await getVehicleSnapshotFromSession(db, input.vehicleId);
  const snapshot = vehicleSnapshot ?? {
    vinLast6: "------",
    make: "BMW",
    model: "i4"
  };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

  const [lng, lat] = station.location.coordinates;
  const chargingPointLabel = `Bay ${pointIndex + 1}`;

  const sessionDoc = {
    userId: userObjectId,
    vehicleId: new ObjectId(input.vehicleId),
    stationId: stationObjectId,
    chargingPointId: chargingPointObjectId,
    stationSnapshot: {
      name: station.name,
      location: station.location,
      addressShort: formatAddressShort(station.address),
      chargingPointLabel
    },
    vehicleSnapshot: snapshot,
    status: "BOOKED" as const,
    booking: {
      bookedAt: now,
      expiresAt,
      canceledAt: null,
      cancelReason: null
    },
    charging: {
      startedAt: null,
      endedAt: null,
      connectorUsed: null,
      meterStartKwh: null,
      meterStopKwh: null,
      energyDeliveredKwh: null,
      socStartPercent: null,
      socStopPercent: null
    },
    pricingSnapshot: {
      currency: station.pricing?.currency ?? "EUR",
      priceCentsPerKwh: station.pricing?.defaultTariff?.priceCentsPerKwh ?? 0,
      idleFee: {
        priceCentsPerMinute: 20,
        afterMinutes: 5
      }
    },
    cost: { totalCents: null, energyCents: null, idleCents: null },
    createdAt: now,
    updatedAt: now
  };

  const inserted = await insertChargingSession(db, sessionDoc);
  const marked = await markChargingPointReserved(db, stationObjectId, chargingPointObjectId);
  if (!marked) {
    await db.collection("chargingSessions").deleteOne({ _id: inserted._id });
    throw new ChargingPointUnavailableError();
  }

  return inserted;
}

function mapSessionDocToGraphQL(doc: ChargingSessionDoc) {
  const [lng, lat] = doc.stationSnapshot.location.coordinates;
  return {
    id: String(doc._id),
    userId: String(doc.userId),
    vehicleId: String(doc.vehicleId),
    stationId: String(doc.stationId),
    chargingPointId: String(doc.chargingPointId),
    stationSnapshot: {
      name: doc.stationSnapshot.name,
      location: { lat, lng },
      addressShort: doc.stationSnapshot.addressShort,
      chargingPointLabel: doc.stationSnapshot.chargingPointLabel
    },
    vehicleSnapshot: doc.vehicleSnapshot,
    status: doc.status,
    booking: {
      bookedAt: doc.booking.bookedAt.toISOString(),
      expiresAt: doc.booking.expiresAt.toISOString(),
      canceledAt: doc.booking.canceledAt?.toISOString() ?? null,
      cancelReason: doc.booking.cancelReason ?? null
    },
    charging: {
      startedAt: doc.charging.startedAt?.toISOString() ?? null,
      endedAt: doc.charging.endedAt?.toISOString() ?? null,
      connectorUsed: doc.charging.connectorUsed
        ? {
            type: doc.charging.connectorUsed.type ?? null,
            power: doc.charging.connectorUsed.power ?? null,
            tethered: doc.charging.connectorUsed.tethered ?? null
          }
        : null,
      meterStartKwh: doc.charging.meterStartKwh ?? null,
      meterStopKwh: doc.charging.meterStopKwh ?? null,
      energyDeliveredKwh: doc.charging.energyDeliveredKwh ?? null,
      socStartPercent: doc.charging.socStartPercent ?? null,
      socStopPercent: doc.charging.socStopPercent ?? null
    },
    feedback: mapSessionFeedback(doc),
    pricingSnapshot: doc.pricingSnapshot,
    cost: doc.cost,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}

export function createBookingResponse(doc: Awaited<ReturnType<typeof createBooking>>) {
  return {
    session: mapSessionDocToGraphQL(doc)
  };
}

type StartChargingSessionInput = {
  sessionId: string;
};

export async function startChargingSession(db: Db, input: StartChargingSessionInput) {
  if (!isValidObjectId(input.sessionId)) {
    throw new ChargingSessionNotFoundError();
  }

  const session = await findChargingSessionById(db, input.sessionId);
  if (!session) {
    throw new ChargingSessionNotFoundError();
  }
  if (session.status !== "BOOKED" || session.booking.canceledAt) {
    throw new InvalidSessionTransitionError();
  }
  if (session.booking.expiresAt.getTime() <= Date.now()) {
    throw new BookingExpiredError();
  }

  const station = await findChargingStationById(db, session.stationId);
  const point = station?.chargingPoints.find((cp) =>
    cp.chargingPointId.equals(session.chargingPointId)
  );
  const connectors = point?.connectors ?? [];
  const preferredConnector = connectors.reduce<(typeof connectors)[number] | null>(
    (best, connector) => {
      if (!best) return connector;
      return connector.power > best.power ? connector : best;
    },
    null
  );

  const updated = await markSessionActive(db, input.sessionId, {
    type: preferredConnector?.type ?? null,
    power: preferredConnector?.power ?? null,
    tethered: preferredConnector?.tethered ?? null
  });
  if (!updated) {
    throw new InvalidSessionTransitionError();
  }
  return updated;
}

type CancelChargingSessionInput = {
  sessionId: string;
  reason?: string | null;
};

export async function cancelChargingSession(db: Db, input: CancelChargingSessionInput) {
  if (!isValidObjectId(input.sessionId)) {
    throw new ChargingSessionNotFoundError();
  }

  const session = await findChargingSessionById(db, input.sessionId);
  if (!session) {
    throw new ChargingSessionNotFoundError();
  }
  if (session.status !== "BOOKED" || session.booking.canceledAt) {
    throw new InvalidSessionTransitionError();
  }

  const updated = await markSessionCanceled(db, input.sessionId, input.reason);
  if (!updated) {
    throw new InvalidSessionTransitionError();
  }

  await markChargingPointAvailable(db, updated.stationId, updated.chargingPointId);
  return updated;
}

type CompleteChargingSessionInput = {
  sessionId: string;
};

export async function completeChargingSession(db: Db, input: CompleteChargingSessionInput) {
  if (!isValidObjectId(input.sessionId)) {
    throw new ChargingSessionNotFoundError();
  }

  const session = await findChargingSessionById(db, input.sessionId);
  if (!session) {
    throw new ChargingSessionNotFoundError();
  }
  if (session.status !== "ACTIVE") {
    throw new InvalidSessionTransitionError();
  }

  const updated = await markSessionCompleted(db, input.sessionId);
  if (!updated) {
    throw new InvalidSessionTransitionError();
  }

  await markChargingPointAvailable(db, updated.stationId, updated.chargingPointId);
  return updated;
}

type AddSessionFeedbackInput = {
  sessionId: string;
  rating: number;
  comment?: string | null;
};

function mapSessionFeedback(doc: ChargingSessionDoc) {
  return doc.feedback
    ? {
        rating: doc.feedback.rating,
        comment: doc.feedback.comment ?? null,
        createdAt: doc.feedback.createdAt.toISOString()
      }
    : null;
}

function normalizeFeedbackComment(comment?: string | null): string | null {
  const trimmed = comment?.trim();
  return trimmed ? trimmed : null;
}

export async function addSessionFeedback(db: Db, input: AddSessionFeedbackInput) {
  if (!isValidObjectId(input.sessionId)) {
    throw new ChargingSessionNotFoundError();
  }

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new InvalidSessionFeedbackError();
  }

  const session = await findChargingSessionById(db, input.sessionId);
  if (!session) {
    throw new ChargingSessionNotFoundError();
  }
  if (session.status !== "COMPLETED") {
    throw new InvalidSessionTransitionError();
  }
  if (session.feedback) {
    throw new SessionFeedbackAlreadyExistsError();
  }

  const updated = await addSessionFeedbackToSession(db, input.sessionId, {
    rating: input.rating,
    comment: normalizeFeedbackComment(input.comment)
  });
  if (!updated) {
    throw new InvalidSessionTransitionError();
  }

  return updated;
}

export function createStartChargingSessionResponse(
  doc: Awaited<ReturnType<typeof startChargingSession>>
) {
  return {
    session: mapSessionDocToGraphQL(doc)
  };
}

export function createCancelChargingSessionResponse(
  doc: Awaited<ReturnType<typeof cancelChargingSession>>
) {
  return {
    session: mapSessionDocToGraphQL(doc)
  };
}

export function createCompleteChargingSessionResponse(
  doc: Awaited<ReturnType<typeof completeChargingSession>>
) {
  return {
    session: mapSessionDocToGraphQL(doc)
  };
}

export function createAddSessionFeedbackResponse(
  doc: Awaited<ReturnType<typeof addSessionFeedback>>
) {
  return {
    session: mapSessionDocToGraphQL(doc)
  };
}
