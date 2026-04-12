import type { Db } from "mongodb";

import {
  findChargingStationsInBounds,
  findChargingStationFacets,
  findStationClustersInBounds,
  type Bounds,
  type ChargingStationDoc,
  type ChargingStationFilters
} from "../../db/repositories/chargingStations";
import type { ConnectorType } from "../../types/connectorType";

const CLUSTER_ZOOM_THRESHOLD = 14;

export type ChargingStationForMap = {
  id: string;
  name: string;
  operator: string;
  stationCode: string;
  location: { lat: number; lng: number };
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  availability: { totalPoints: number; availableNowPoints: number; operationalPoints: number };
  priceCentsPerKwh: number;
  hasFastCharging: boolean;
  connectorTypes: ConnectorType[];
  maxPowerKw: number;
  chargingPoints: {
    id: string;
    availableNow: boolean;
    outOfService: boolean;
    connectors: {
      type: ConnectorType;
      powerKw: number;
      tethered?: boolean;
    }[];
  }[];
};

function mapDocToGraphQL(doc: ChargingStationDoc): ChargingStationForMap {
  const [lng, lat] = doc.location.coordinates;

  const connectorTypesSet = new Set<ConnectorType>();
  let maxPowerKw = 0;
  let hasFastCharging = false;

  for (const cp of doc.chargingPoints ?? []) {
    for (const conn of cp.connectors ?? []) {
      connectorTypesSet.add(conn.type);
      if (conn.power > maxPowerKw) {
        maxPowerKw = conn.power;
      }
      if (conn.power >= 50) {
        hasFastCharging = true;
      }
    }
  }

  const priceCentsPerKwh =
    doc.pricing?.defaultTariff?.priceCentsPerKwh ?? 0;

  const chargingPoints = (doc.chargingPoints ?? []).map((cp) => ({
    id: String(cp.chargingPointId),
    availableNow: cp.availableNow ?? false,
    outOfService: cp.outOfService ?? false,
    connectors: (cp.connectors ?? []).map((connector) => ({
      type: connector.type,
      powerKw: connector.power,
      tethered: connector.tethered
    }))
  }));

  return {
    id: String(doc._id),
    name: doc.name,
    operator: doc.operator ?? doc.name,
    stationCode: doc.stationCode,
    location: { lat, lng },
    address: doc.address ? {
      street: doc.address.street,
      city: doc.address.city,
      postalCode: doc.address.postalCode,
      country: doc.address.country
    } : undefined,
    availability: {
      totalPoints: doc.availability?.totalPoints ?? 0,
      availableNowPoints: doc.availability?.availableNowPoints ?? 0,
      operationalPoints: doc.availability?.operationalPoints ?? 0
    },
    priceCentsPerKwh,
    hasFastCharging,
    connectorTypes: Array.from(connectorTypesSet),
    maxPowerKw,
    chargingPoints
  };
}

export async function getStationsInBounds(
  db: Db,
  bounds: Bounds,
  filters: ChargingStationFilters = {}
): Promise<ChargingStationForMap[]> {
  const docs = await findChargingStationsInBounds(db, bounds, filters);
  return docs.map(mapDocToGraphQL);
}

export type StationClusterForMap = {
  id: string;
  location: { lat: number; lng: number };
  count: number;
};

export type MapItemResult =
  | { __typename: "ChargingStation"; id: string; name: string; operator: string; stationCode: string; location: { lat: number; lng: number }; address?: { street: string; city: string; postalCode: string; country: string }; availability: { totalPoints: number; availableNowPoints: number; operationalPoints: number }; priceCentsPerKwh: number; hasFastCharging: boolean; connectorTypes: ConnectorType[]; maxPowerKw: number; chargingPoints: { id: string; availableNow: boolean; outOfService: boolean; connectors: { type: ConnectorType; powerKw: number; tethered?: boolean }[] }[] }
  | { __typename: "StationCluster"; id: string; location: { lat: number; lng: number }; count: number };

export async function getChargingStationFacets(db: Db) {
  return findChargingStationFacets(db);
}

export async function getMapItemsInBounds(
  db: Db,
  bounds: Bounds,
  zoom: number,
  filters: ChargingStationFilters = {}
): Promise<MapItemResult[]> {
  if (zoom < CLUSTER_ZOOM_THRESHOLD) {
    const clusters = await findStationClustersInBounds(db, bounds, zoom, filters);
    return clusters.map((c) => ({
      __typename: "StationCluster" as const,
      id: c.id,
      location: c.location,
      count: c.count
    }));
  }

  const docs = await findChargingStationsInBounds(db, bounds, filters);
  return docs.map((doc) => ({
    __typename: "ChargingStation" as const,
    ...mapDocToGraphQL(doc)
  }));
}
