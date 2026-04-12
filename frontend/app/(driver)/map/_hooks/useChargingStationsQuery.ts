"use client";

import { useQuery } from "@apollo/client/react";
import { ChargingStationsInBoundsDocument } from "@/graphql/generated/graphql";
import type { ChargingStationFiltersInput, ConnectorType } from "@/graphql/generated/graphql";
import type { MapBounds } from "./useMapBounds";

export type MapStation = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  operator: string;
  address?: {
    street?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
  availableNowPoints: number;
  totalPoints: number;
  operationalPoints: number;
  hasFastCharging: boolean;
  connectorTypes: ConnectorType[];
  maxPowerKw: number;
  priceCentsPerKwh: number;
  chargingPoints: {
    id: string;
    availableNow: boolean;
    outOfService: boolean;
    connectors: {
      type: ConnectorType;
      powerKw: number;
      tethered?: boolean | null;
    }[];
  }[];
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
    operator: string;
    address?: { street?: string | null; city?: string | null; postalCode?: string | null; country?: string | null } | null;
    availability: { totalPoints: number; availableNowPoints: number; operationalPoints: number };
    hasFastCharging: boolean;
    connectorTypes: ConnectorType[];
    maxPowerKw: number;
    priceCentsPerKwh: number;
    chargingPoints?: {
      id: string;
      availableNow: boolean;
      outOfService: boolean;
      connectors: {
        type: ConnectorType;
        powerKw: number;
        tethered?: boolean | null;
      }[];
    }[];
  }
): MapStation {
  return {
    id: s.id,
    lat: s.location.lat,
    lng: s.location.lng,
    name: s.name,
    operator: s.operator,
    address: s.address ?? undefined,
    availableNowPoints: s.availability.availableNowPoints,
    totalPoints: s.availability.totalPoints,
    operationalPoints: s.availability.operationalPoints,
    hasFastCharging: s.hasFastCharging,
    connectorTypes: s.connectorTypes,
    maxPowerKw: s.maxPowerKw,
    priceCentsPerKwh: s.priceCentsPerKwh,
    chargingPoints: s.chargingPoints ?? [],
  };
}

export function useChargingStationsQuery(
  bounds: MapBounds | undefined,
  zoom: number,
  filters: ChargingStationFiltersInput | undefined
) {
  const snappedBounds = getSnappedBounds(bounds, zoom);

  const { data, previousData, loading, error, refetch } = useQuery(ChargingStationsInBoundsDocument, {
    variables: {
      bounds: snappedBounds!,
      zoom,
      filters: filters ?? undefined,
    },
    skip: !snappedBounds
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
    refetch,
  };
}
