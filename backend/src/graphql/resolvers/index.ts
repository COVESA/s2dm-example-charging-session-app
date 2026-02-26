import type { GraphQLContext } from "../../server/context";
import { findUsers } from "../../db/repositories/users";
import {
  getChargingStationFacets,
  getMapItemsInBounds
} from "../../modules/chargingStations/service";

function mapRole(role: string): "USER" | "ADMIN" {
  return role === "ADMIN" ? "ADMIN" : "USER";
}

export const resolvers = {
  Query: {
    users: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const rows = await findUsers(context.db);
      return rows.map((row) => ({
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        roles: row.roles.map(mapRole)
      }));
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
    }
  },
  MapItem: {
    __resolveType(obj: { __typename: string }) {
      return obj.__typename;
    }
  }
};
