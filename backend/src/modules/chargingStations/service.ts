import type { Db } from "mongodb";

import {
  findChargingStationsInBounds,
  findChargingStationFacets,
  findStationClustersInBounds,
  type Bounds,
  type ChargingStationDoc,
  type ChargingStationFilters
} from "../../db/repositories/chargingStations";

const CLUSTER_ZOOM_THRESHOLD = 14;

export type ChargingStationForMap = {
  id: string;
  name: string;
  stationCode: string;
  location: { lat: number; lng: number };
  availability: { totalPoints: number; availableNowPoints: number; operationalPoints: number };
  priceCentsPerKwh: number;
  hasFastCharging: boolean;
  connectorTypes: string[];
  maxPowerKw: number;
};

function mapDocToGraphQL(doc: ChargingStationDoc): ChargingStationForMap {
  const [lng, lat] = doc.location.coordinates;

  const connectorTypesSet = new Set<string>();
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

  return {
    id: String(doc._id),
    name: doc.name,
    stationCode: doc.stationCode,
    location: { lat, lng },
    availability: {
      totalPoints: doc.availability?.totalPoints ?? 0,
      availableNowPoints: doc.availability?.availableNowPoints ?? 0,
      operationalPoints: doc.availability?.operationalPoints ?? 0
    },
    priceCentsPerKwh,
    hasFastCharging,
    connectorTypes: Array.from(connectorTypesSet),
    maxPowerKw
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
  | { __typename: "ChargingStation"; id: string; name: string; stationCode: string; location: { lat: number; lng: number }; availability: { totalPoints: number; availableNowPoints: number; operationalPoints: number }; priceCentsPerKwh: number; hasFastCharging: boolean; connectorTypes: string[]; maxPowerKw: number }
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
