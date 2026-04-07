"use client";

import { useMemo } from "react";
import useSupercluster from "use-supercluster";
import type { Feature, Point } from "geojson";
import type { MapStation } from "./useChargingStationsQuery";

const NO_CLUSTER_FROM_ZOOM = 16;

function stationToGeoJSONFeature(station: MapStation): Feature<Point, MapStation> {
  return {
    type: "Feature",
    properties: station,
    geometry: {
      type: "Point",
      coordinates: [station.lng, station.lat],
    },
  };
}

export function useStationClusters(
  stations: MapStation[],
  bounds: [number, number, number, number] | undefined,
  zoom: number
) {
  const points = useMemo(
    () => stations.map(stationToGeoJSONFeature),
    [stations]
  );

  const radius = zoom <= 16 ? 110 : zoom <= 17 ? 92 : 74;
  const minPoints = zoom <= 16 ? 3 : 2;

  const { clusters } = useSupercluster({
    points,
    bounds: bounds ?? [-180, -90, 180, 90],
    zoom,
    options: {
      radius,
      maxZoom: NO_CLUSTER_FROM_ZOOM - 1,
      minPoints,
    },
  });

  return clusters;
}
