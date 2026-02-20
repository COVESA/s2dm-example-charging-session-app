"use client";

import { useQuery } from "@apollo/client/react";
import { ChargingStationFacetsDocument } from "@/graphql/generated/graphql";

const FACETS_CACHE_MS = 5 * 60 * 1000; // 5 minutes

export function useChargingStationFacets() {
  const { data, loading, error } = useQuery(ChargingStationFacetsDocument, {
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
    pollInterval: FACETS_CACHE_MS,
  });

  return {
    facets: data?.chargingStationFacets ?? null,
    loading,
    error,
  };
}
