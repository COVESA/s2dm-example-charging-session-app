import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../../server/context";
import { findVehiclesByUserId } from "../../db/repositories/vehicles";
import {
  getChargingStationFacets,
  getMapItemsInBounds
} from "../../modules/chargingStations/service";
import {
  getChargingSessionsByUser,
  createBooking,
  createBookingResponse,
  startChargingSession,
  createStartChargingSessionResponse,
  cancelChargingSession,
  createCancelChargingSessionResponse,
  completeChargingSession,
  createCompleteChargingSessionResponse,
  addSessionFeedback,
  createAddSessionFeedbackResponse,
  UserAlreadyHasActiveBookingError,
  ChargingPointUnavailableError,
  StationOrPointNotFoundError,
  ChargingSessionNotFoundError,
  InvalidSessionTransitionError,
  BookingExpiredError,
  InvalidSessionFeedbackError,
  SessionFeedbackAlreadyExistsError
} from "../../modules/chargingSessions/service";
import {
  reportSessionIncident,
  createReportSessionIncidentResponse,
  IncidentSessionNotFoundError,
  InvalidIncidentDescriptionError
} from "../../modules/incidents/service";
import { getAdminDashboard } from "../../modules/adminDashboard/service";


export const resolvers = {
  Query: {
// Users are now handled client-side via guest identity.
    // The users query is deprecated and will return an empty list.
    users: async () => {
      return [];
    },
    adminDashboard: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      return getAdminDashboard(context.db);
    },
    chargingStationsInBounds: async (
      _parent: unknown,
      args: {
        bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number };
        zoom: number;
        filters?: {
          connectorTypes?: string[];
          minPowerKw?: number;
          maxPowerKw?: number;
          minPriceCentsPerKwh?: number;
          maxPriceCentsPerKwh?: number;
          availableNow?: boolean;
          fastCharging?: boolean;
          tethered?: boolean;
        };
      },
      context: GraphQLContext
    ) => {
      const { bounds, zoom, filters } = args;
      return getMapItemsInBounds(context.db, bounds, zoom, filters ?? {});
    },
    chargingStationFacets: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      return getChargingStationFacets(context.db);
    },
    chargingSessions: async (
      _parent: unknown,
      args: { userId: string; limit?: number; cursor?: string; fromDate?: string },
      context: GraphQLContext
    ) => {
      return getChargingSessionsByUser(context.db, args);
    },
    vehicles: async (
      _parent: unknown,
      args: { userId: string },
      context: GraphQLContext
    ) => {
      const vehicles = await findVehiclesByUserId(context.db, args.userId);
      return vehicles.map((vehicle) => ({
        id: String(vehicle._id),
        userId: String(vehicle.userId),
        vin: vehicle.vin,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        batteryCapacityKwh: vehicle.batteryCapacityKwh,
        maxChargePowerKw: vehicle.maxChargePowerKw,
        connectorTypes: vehicle.connectorTypes,
        createdAt: vehicle.createdAt.toISOString()
      }));
    }
  },
  Mutation: {
    reserveChargingPoint: async (
      _parent: unknown,
      args: { input: { userId: string; vehicleId: string; stationId: string; chargingPointId: string } },
      context: GraphQLContext
    ) => {
      try {
        const doc = await createBooking(context.db, args.input);
        return createBookingResponse(doc);
      } catch (err) {
        if (err instanceof UserAlreadyHasActiveBookingError) {
          throw new GraphQLError("User already has an active or booked session", {
            extensions: { code: "USER_ALREADY_HAS_ACTIVE_BOOKING" }
          });
        }
        if (err instanceof ChargingPointUnavailableError) {
          throw new GraphQLError("Charging point is not available", {
            extensions: { code: "CHARGING_POINT_UNAVAILABLE" }
          });
        }
        if (err instanceof StationOrPointNotFoundError) {
          throw new GraphQLError("Station or charging point not found", {
            extensions: { code: "NOT_FOUND" }
          });
        }
        throw err;
      }
    },
    startChargingSession: async (
      _parent: unknown,
      args: { input: { sessionId: string } },
      context: GraphQLContext
    ) => {
      try {
        const doc = await startChargingSession(context.db, args.input);
        return createStartChargingSessionResponse(doc);
      } catch (err) {
        if (err instanceof ChargingSessionNotFoundError) {
          throw new GraphQLError("Charging session not found", {
            extensions: { code: "NOT_FOUND" }
          });
        }
        if (err instanceof BookingExpiredError) {
          throw new GraphQLError("Booked session has expired", {
            extensions: { code: "BOOKING_EXPIRED" }
          });
        }
        if (err instanceof InvalidSessionTransitionError) {
          throw new GraphQLError("Session cannot be started from current status", {
            extensions: { code: "INVALID_SESSION_STATE" }
          });
        }
        throw err;
      }
    },
    cancelChargingSession: async (
      _parent: unknown,
      args: { input: { sessionId: string; reason?: string | null } },
      context: GraphQLContext
    ) => {
      try {
        const doc = await cancelChargingSession(context.db, args.input);
        return createCancelChargingSessionResponse(doc);
      } catch (err) {
        if (err instanceof ChargingSessionNotFoundError) {
          throw new GraphQLError("Charging session not found", {
            extensions: { code: "NOT_FOUND" }
          });
        }
        if (err instanceof InvalidSessionTransitionError) {
          throw new GraphQLError("Session cannot be canceled from current status", {
            extensions: { code: "INVALID_SESSION_STATE" }
          });
        }
        throw err;
      }
    },
    completeChargingSession: async (
      _parent: unknown,
      args: { input: { sessionId: string } },
      context: GraphQLContext
    ) => {
      try {
        const doc = await completeChargingSession(context.db, args.input);
        return createCompleteChargingSessionResponse(doc);
      } catch (err) {
        if (err instanceof ChargingSessionNotFoundError) {
          throw new GraphQLError("Charging session not found", {
            extensions: { code: "NOT_FOUND" }
          });
        }
        if (err instanceof InvalidSessionTransitionError) {
          throw new GraphQLError("Session cannot be completed from current status", {
            extensions: { code: "INVALID_SESSION_STATE" }
          });
        }
        throw err;
      }
    },
    addSessionFeedback: async (
      _parent: unknown,
      args: { input: { sessionId: string; rating: number; comment?: string | null } },
      context: GraphQLContext
    ) => {
      try {
        const doc = await addSessionFeedback(context.db, args.input);
        return createAddSessionFeedbackResponse(doc);
      } catch (err) {
        if (err instanceof ChargingSessionNotFoundError) {
          throw new GraphQLError("Charging session not found", {
            extensions: { code: "NOT_FOUND" }
          });
        }
        if (err instanceof InvalidSessionFeedbackError) {
          throw new GraphQLError("Rating must be between 1 and 5", {
            extensions: { code: "INVALID_INPUT" }
          });
        }
        if (err instanceof SessionFeedbackAlreadyExistsError) {
          throw new GraphQLError("Session feedback has already been submitted", {
            extensions: { code: "FEEDBACK_ALREADY_EXISTS" }
          });
        }
        if (err instanceof InvalidSessionTransitionError) {
          throw new GraphQLError("Session feedback can only be added to completed sessions", {
            extensions: { code: "INVALID_SESSION_STATE" }
          });
        }
        throw err;
      }
    },
    reportSessionIncident: async (
      _parent: unknown,
      args: {
        input: {
          sessionId: string;
          severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
          description: string;
        };
      },
      context: GraphQLContext
    ) => {
      try {
        const doc = await reportSessionIncident(context.db, args.input);
        return createReportSessionIncidentResponse(doc);
      } catch (err) {
        if (err instanceof IncidentSessionNotFoundError) {
          throw new GraphQLError("Charging session not found", {
            extensions: { code: "NOT_FOUND" }
          });
        }
        if (err instanceof InvalidIncidentDescriptionError) {
          throw new GraphQLError("Incident description is required", {
            extensions: { code: "INVALID_INPUT" }
          });
        }
        throw err;
      }
    }
  },
  MapItem: {
    __resolveType(obj: { __typename: string }) {
      return obj.__typename;
    }
  }
};
