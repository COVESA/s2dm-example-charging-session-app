"use client";

import { useQuery } from "@apollo/client/react";
import { ChargingStationsInBoundsDocument } from "@/graphql/generated/graphql";
import type { ChargingStationFiltersInput } from "@/graphql/generated/graphql";
import type { MapBounds } from "./useMapBounds";

export type MapStation = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  availableNowPoints: number;
  totalPoints: number;
  hasFastCharging: boolean;
  connectorTypes: string[];
  maxPowerKw: number;
  priceCentsPerKwh: number;
};

export type MapCluster = {
  id: string;
  lat: number;
  lng: number;
  count: number;
};

function getBoundsSnapStepForZoom(zoom: number): number {
  if (zoom <= 8) return 0.5;
  if (zoom <= 10) return 0.25;
  if (zoom <= 12) return 0.125;
  if (zoom <= 14) return 0.0625;
  if (zoom <= 16) return 0.03125;
  return 0.015625;
}

function getSnappedBounds(
  bounds: MapBounds | undefined,
  zoom: number
): MapBounds | undefined {
  if (!bounds) return undefined;
  const step = getBoundsSnapStepForZoom(zoom);

  return {
    minLng: Math.floor(bounds.minLng / step) * step,
    minLat: Math.floor(bounds.minLat / step) * step,
    maxLng: Math.ceil(bounds.maxLng / step) * step,
    maxLat: Math.ceil(bounds.maxLat / step) * step,
  };
}

function apiStationToMapStation(
  s: {
    id: string;
    location: { lat: number; lng: number };
    name: string;
    availability: { totalPoints: number; availableNowPoints: number };
    hasFastCharging: boolean;
    connectorTypes: string[];
    maxPowerKw: number;
    priceCentsPerKwh: number;
  }
): MapStation {
  return {
    id: s.id,
    lat: s.location.lat,
    lng: s.location.lng,
    name: s.name,
    availableNowPoints: s.availability.availableNowPoints,
    totalPoints: s.availability.totalPoints,
    hasFastCharging: s.hasFastCharging,
    connectorTypes: s.connectorTypes,
    maxPowerKw: s.maxPowerKw,
    priceCentsPerKwh: s.priceCentsPerKwh,
  };
}

export function useChargingStationsQuery(
  bounds: MapBounds | undefined,
  zoom: number,
  filters: ChargingStationFiltersInput | undefined
) {
  const snappedBounds = getSnappedBounds(bounds, zoom);

  const { data, previousData, loading, error } = useQuery(ChargingStationsInBoundsDocument, {
    variables: {
      bounds: snappedBounds!,
      zoom,
      filters: filters ?? undefined,
    },
    skip: !snappedBounds,
  });

  const mapItems =
    data?.chargingStationsInBounds ??
    previousData?.chargingStationsInBounds ??
    [];

  const isServerClustered =
    mapItems.length > 0 &&
    mapItems.some((item) => item.__typename === "StationCluster");

  const stations: MapStation[] = isServerClustered
    ? []
    : mapItems
        .filter((item): item is Extract<typeof item, { __typename: "ChargingStation" }> =>
          item.__typename === "ChargingStation"
        )
        .map(apiStationToMapStation);

  const serverClusters: MapCluster[] = isServerClustered
    ? mapItems
        .filter((item): item is Extract<typeof item, { __typename: "StationCluster" }> =>
          item.__typename === "StationCluster"
        )
        .map((c) => ({
          id: c.id,
          lat: c.location.lat,
          lng: c.location.lng,
          count: c.count,
        }))
    : [];

  return {
    mapItems,
    stations,
    serverClusters,
    isServerClustered,
    loading,
    error,
  };
}
