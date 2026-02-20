"use client";

import { useCallback, useState } from "react";

const PHOTON_URL = "https://photon.komoot.io/api";
const GERMANY_CENTER = { lat: 51.1657, lng: 10.4515 };

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export function useGeocode() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string, limit = 5): Promise<GeocodeResult[]> => {
    if (!query.trim()) return [];

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(limit),
        lang: "en",
        lat: String(GERMANY_CENTER.lat),
        lon: String(GERMANY_CENTER.lng),
      });

      const res = await fetch(`${PHOTON_URL}?${params}`);

      if (!res.ok) {
        throw new Error("Geocoding request failed");
      }

      const data = await res.json();

      if (!Array.isArray(data?.features) || data.features.length === 0) {
        setError("Location not found");
        return [];
      }

      const results = data.features
        .map((feature: unknown) => {
          const item = feature as {
            geometry?: { coordinates?: [number, number] };
            properties?: {
              name?: string;
              city?: string;
              state?: string;
              country?: string;
            };
          };

          const coordinates = item.geometry?.coordinates;
          if (!Array.isArray(coordinates) || coordinates.length < 2) {
            return null;
          }

          const [lng, lat] = coordinates;
          if (typeof lat !== "number" || typeof lng !== "number") {
            return null;
          }

          const properties = item.properties ?? {};
          const displayName = [
            properties.name,
            properties.city,
            properties.state,
            properties.country
          ]
            .filter(Boolean)
            .join(", ");

          return {
            lat,
            lng,
            displayName: displayName || query
          } satisfies GeocodeResult;
        })
        .filter((result: GeocodeResult | null): result is GeocodeResult => result !== null);

      setError(null);
      return results;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Geocoding failed");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const geocodeFirst = useCallback(
    async (query: string): Promise<GeocodeResult | null> => {
      const results = await search(query, 1);
      return results[0] ?? null;
    },
    [search]
  );

  return { search, geocodeFirst, loading, error };
}
