"use client";

import { useCallback, useEffect, useState } from "react";
import { useMap } from "react-leaflet";

const DEBOUNCE_MS = 300;

export type MapBounds = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

export function useMapBounds() {
  const map = useMap();
  const [bounds, setBounds] = useState<MapBounds | undefined>();
  const [zoom, setZoom] = useState(map.getZoom());

  const updateBounds = useCallback(() => {
    const b = map.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    setBounds({
      minLng: sw.lng,
      minLat: sw.lat,
      maxLng: ne.lng,
      maxLat: ne.lat,
    });
    setZoom(map.getZoom());
  }, [map]);

  useEffect(() => {
    updateBounds();
    let timeoutId: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateBounds, DEBOUNCE_MS);
    };
    map.on("moveend", handler);
    map.on("zoomend", handler);
    return () => {
      clearTimeout(timeoutId);
      map.off("moveend", handler);
      map.off("zoomend", handler);
    };
  }, [map, updateBounds]);

  return { bounds, zoom };
}
