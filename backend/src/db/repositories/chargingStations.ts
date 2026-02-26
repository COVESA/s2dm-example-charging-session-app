import type { Db } from "mongodb";
import type { ObjectId } from "mongodb";

export type Bounds = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

export type ChargingStationFilters = {
  connectorTypes?: string[];
  minPowerKw?: number;
  maxPowerKw?: number;
  minPriceCentsPerKwh?: number;
  maxPriceCentsPerKwh?: number;
  availableNow?: boolean;
  fastCharging?: boolean;
  tethered?: boolean;
};

export type ChargingStationFacetsResult = {
  connectorTypes: { type: string; count: number }[];
  powerRange: { min: number; max: number };
  priceRange: { min: number; max: number };
  availableNowCount: number;
};

type ConnectorDoc = {
  type: string;
  power: number;
  tethered?: boolean;
};

type ChargingPointDoc = {
  chargingPointId: ObjectId;
  connectors: ConnectorDoc[];
  availableNow?: boolean;
  outOfService?: boolean;
};

type AvailabilityDoc = {
  totalPoints: number;
  operationalPoints?: number;
  availableNowPoints: number;
};

type PricingDoc = {
  currency?: string;
  defaultTariff?: {
    priceCentsPerKwh: number;
    priceCentsPerMinuteIdleAfterMinutes?: number;
  };
};

type AddressDoc = {
  street: string;
  city: string;
  postalCode: string;
  country: string;
};

export type ChargingStationDoc = {
  _id: ObjectId;
  stationCode: string;
  name: string;
  operator?: string;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  address?: AddressDoc;
  chargingPoints: ChargingPointDoc[];
  availability: AvailabilityDoc;
  pricing: PricingDoc;
};

export async function findChargingStationsInBounds(
  database: Db,
  bounds: Bounds,
  filters: ChargingStationFilters = {}
): Promise<ChargingStationDoc[]> {
  const match = buildMatchStage(bounds, filters);

  const cursor = database
    .collection<ChargingStationDoc>("chargingStations")
    .find(match);

  return cursor.toArray();
}

export async function findChargingStationFacets(
  database: Db
): Promise<ChargingStationFacetsResult> {
  const collection = database.collection<ChargingStationDoc>("chargingStations");

  const [result] = await collection
    .aggregate<{
      connectorTypes: { type: string; count: number }[];
      powerRange: { min: number; max: number }[];
      priceRange: { min: number; max: number }[];
      availableNowCount: { count: number }[];
    }>([
      {
        $facet: {
          connectorTypes: [
            { $unwind: "$chargingPoints" },
            { $unwind: "$chargingPoints.connectors" },
            {
              $group: {
                _id: "$chargingPoints.connectors.type",
                stationIds: { $addToSet: "$_id" }
              }
            },
            {
              $project: {
                type: "$_id",
                count: { $size: "$stationIds" }
              }
            },
            { $sort: { count: -1 } }
          ],
          powerRange: [
            { $unwind: "$chargingPoints" },
            { $unwind: "$chargingPoints.connectors" },
            {
              $group: {
                _id: null,
                min: { $min: "$chargingPoints.connectors.power" },
                max: { $max: "$chargingPoints.connectors.power" }
              }
            }
          ],
          priceRange: [
            { $match: { "pricing.defaultTariff.priceCentsPerKwh": { $exists: true, $ne: null } } },
            {
              $group: {
                _id: null,
                min: { $min: "$pricing.defaultTariff.priceCentsPerKwh" },
                max: { $max: "$pricing.defaultTariff.priceCentsPerKwh" }
              }
            }
          ],
          availableNowCount: [
            { $match: { "availability.availableNowPoints": { $gt: 0 } } },
            { $count: "count" }
          ]
        }
      }
    ])
    .toArray();

  const connectorTypes = result?.connectorTypes ?? [];
  const powerRangeDoc = result?.powerRange?.[0];
  const priceRangeDoc = result?.priceRange?.[0];
  const availableNowCount = result?.availableNowCount?.[0]?.count ?? 0;

  return {
    connectorTypes: connectorTypes.map((c) => ({ type: c.type, count: c.count })),
    powerRange: {
      min: powerRangeDoc?.min ?? 0,
      max: powerRangeDoc?.max ?? 350
    },
    priceRange: {
      min: priceRangeDoc?.min ?? 0,
      max: priceRangeDoc?.max ?? 100
    },
    availableNowCount
  };
}

export type ClusterValues = {
  id: string;
  count: number;
  location: { lat: number; lng: number };
};

function getStableGridStepForZoom(zoom: number): number {
  // World-anchored, zoom-adaptive grid: halve cell size each zoom step.
  // This keeps cluster buckets stable while panning and avoids oversized
  // buckets at medium zoom levels.
  const step = 360 / Math.pow(2, zoom + 2);
  return Math.max(step, 0.0025);
}

function buildMatchStage(bounds: Bounds, filters: ChargingStationFilters): Record<string, unknown> {
  const { minLng, minLat, maxLng, maxLat } = bounds;
  const boxPolygon = {
    type: "Polygon" as const,
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat]
      ]
    ]
  };

  const match: Record<string, unknown> = {
    location: {
      $geoWithin: {
        $geometry: boxPolygon
      }
    }
  };

  if (filters.connectorTypes && filters.connectorTypes.length > 0) {
    match["chargingPoints.connectors.type"] = { $in: filters.connectorTypes };
  }

  const hasMinPower = filters.minPowerKw != null && filters.minPowerKw > 0;
  const hasMaxPower = filters.maxPowerKw != null;
  const fastChargingMin = filters.fastCharging === true ? 50 : 0;
  const effectiveMinPower =
    hasMinPower || fastChargingMin > 0
      ? Math.max(filters.minPowerKw ?? 0, fastChargingMin)
      : null;
  const effectiveMaxPower = hasMaxPower ? filters.maxPowerKw! : null;

  if (effectiveMinPower != null && effectiveMaxPower != null) {
    match["chargingPoints"] = {
      $elemMatch: {
        connectors: {
          $elemMatch: {
            power: { $gte: effectiveMinPower, $lte: effectiveMaxPower }
          }
        }
      }
    };
  } else if (effectiveMinPower != null && effectiveMinPower > 0) {
    match["chargingPoints.connectors.power"] = { $gte: effectiveMinPower };
  } else if (effectiveMaxPower != null) {
    match["chargingPoints.connectors.power"] = { $lte: effectiveMaxPower };
  } else if (filters.fastCharging === true) {
    match["chargingPoints"] = {
      $elemMatch: {
        connectors: {
          $elemMatch: {
            power: { $gte: 50 }
          }
        }
      }
    };
  }

  const hasMinPrice = filters.minPriceCentsPerKwh != null;
  const hasMaxPrice = filters.maxPriceCentsPerKwh != null;
  if (hasMinPrice && hasMaxPrice) {
    match["pricing.defaultTariff.priceCentsPerKwh"] = {
      $gte: filters.minPriceCentsPerKwh!,
      $lte: filters.maxPriceCentsPerKwh!
    };
  } else if (hasMinPrice) {
    match["pricing.defaultTariff.priceCentsPerKwh"] = {
      $gte: filters.minPriceCentsPerKwh
    };
  } else if (hasMaxPrice) {
    match["pricing.defaultTariff.priceCentsPerKwh"] = {
      $lte: filters.maxPriceCentsPerKwh
    };
  }

  if (filters.availableNow === true) {
    match["availability.availableNowPoints"] = { $gt: 0 };
  }

  if (filters.tethered === true) {
    match["chargingPoints.connectors.tethered"] = true;
  }

  return match;
}

export async function findStationClustersInBounds(
  database: Db,
  bounds: Bounds,
  zoom: number,
  filters: ChargingStationFilters = {}
): Promise<ClusterValues[]> {
  const match = buildMatchStage(bounds, filters);
  const step = getStableGridStepForZoom(zoom);

  const cursor = database
    .collection<ChargingStationDoc>("chargingStations")
    .aggregate<ClusterValues>([
      { $match: match },
      {
        $group: {
          _id: {
            gridX: {
              $floor: {
                $divide: [
                  {
                    $add: [{ $arrayElemAt: ["$location.coordinates", 0] }, 180]
                  },
                  step
                ]
              }
            },
            gridY: {
              $floor: {
                $divide: [
                  {
                    $add: [{ $arrayElemAt: ["$location.coordinates", 1] }, 90]
                  },
                  step
                ]
              }
            }
          },
          count: { $sum: 1 },
          avgLat: { $avg: { $arrayElemAt: ["$location.coordinates", 1] } },
          avgLng: { $avg: { $arrayElemAt: ["$location.coordinates", 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          id: {
            $concat: [
              { $toString: zoom },
              "_",
              { $toString: "$_id.gridX" },
              "_",
              { $toString: "$_id.gridY" }
            ]
          },
          count: 1,
          location: {
            lat: "$avgLat",
            lng: "$avgLng"
          }
        }
      }
    ]);

  return cursor.toArray();
}
