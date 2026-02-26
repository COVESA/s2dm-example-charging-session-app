"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { useGeocode } from "../_hooks/useGeocode";
import {
  FilterSidebar,
  DEFAULT_FILTERS,
  type FilterState,
} from "./FilterSidebar";
import { SearchBar } from "./SearchBar";
import type { ChargingStationFiltersInput } from "@/graphql/generated/graphql";

const StationMap = dynamic(
  () =>
    import("./StationMap").then((mod) => ({ default: mod.StationMap })),
  { ssr: false }
);

const FILTER_WIDTH_EXPANDED = 288; // w-72
const FILTER_WIDTH_COLLAPSED = 48; // w-12

function filtersToApiInput(filters: FilterState): ChargingStationFiltersInput {
  return {
    connectorTypes:
      filters.connectorTypes.length > 0 ? filters.connectorTypes : undefined,
    minPowerKw: filters.minPowerKw ?? undefined,
    maxPowerKw: filters.maxPowerKw ?? undefined,
    minPriceCentsPerKwh: filters.minPriceCentsPerKwh ?? undefined,
    maxPriceCentsPerKwh: filters.maxPriceCentsPerKwh ?? undefined,
    availableNow: filters.availableNow || undefined,
    fastCharging: filters.fastCharging || undefined,
    tethered: filters.tethered || undefined,
  };
}

export function MapScreen() {
  const [locationPin, setLocationPin] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(
    { lat: 48.1374, lng: 11.5755 } // Start with Munich bias
  );
  const [focusRequestId, setFocusRequestId] = useState(0);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ lat: number; lng: number; displayName: string }>
  >([]);
  const [suppressSuggestions, setSuppressSuggestions] = useState(false);
  const [filterOpen, setFilterOpen] = useState(true);
  const [hoverExpanded, setHoverExpanded] = useState(false);

  const { search, geocodeFirst, loading, error } = useGeocode(mapCenter);

  const isExpanded = filterOpen || hoverExpanded;

  useEffect(() => {
    if (suppressSuggestions) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const results = await search(query, 6);
      setSearchResults(results);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [search, searchQuery, suppressSuggestions]);

  const focusOnLocation = (location: { lat: number; lng: number }) => {
    setLocationPin(location);
    setFocusRequestId((value) => value + 1);
  };

  const handleSelectResult = (result: {
    lat: number;
    lng: number;
    displayName: string;
  }) => {
    setSuppressSuggestions(true);
    setSearchQuery(result.displayName);
    setSearchResults([]);
    focusOnLocation({ lat: result.lat, lng: result.lng });
  };

  const handleSearchSubmit = async () => {
    if (searchResults.length > 0) {
      handleSelectResult(searchResults[0]);
      return;
    }

    const result = await geocodeFirst(searchQuery);
    if (!result) return;

    handleSelectResult(result);
  };

  const apiFilters = filtersToApiInput(filters);
  const filterWidth = isExpanded ? FILTER_WIDTH_EXPANDED : FILTER_WIDTH_COLLAPSED;

  const handleToggle = () => {
    setFilterOpen((o) => !o);
    if (filterOpen) setHoverExpanded(false);
  };

  return (
    <main className="relative h-full w-full">
      <div className="absolute inset-0">
        <StationMap
          filters={apiFilters}
          locationPin={locationPin}
          focusRequestId={focusRequestId}
          onMapMove={setMapCenter}
        />
      </div>

      <div
        className="absolute left-0 top-0 bottom-0 z-[1000] flex flex-col items-center border-r border-white/55 bg-white/30 shadow-lg backdrop-blur-xl transition-[width] duration-200 ease-out"
        style={{ width: filterWidth }}
        onMouseEnter={() => !filterOpen && setHoverExpanded(true)}
        onMouseLeave={() => setHoverExpanded(false)}
        onPointerLeave={() => setHoverExpanded(false)}
      >
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          <FilterSidebar
            filters={filters}
            onFiltersChange={setFilters}
            open={isExpanded}
            onToggle={handleToggle}
          />
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={handleToggle}
          onKeyDown={(e) => e.key === "Enter" && handleToggle()}
          className="absolute right-0 bottom-10 flex h-9 w-9 translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-white/70 bg-white/85 text-slate-600 shadow backdrop-blur-xl transition-colors hover:bg-white/95 hover:text-slate-800"
          aria-label={isExpanded ? "Close filters" : "Open filters"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      <div
        className="absolute top-4 z-[1000] transition-[left] duration-200 ease-out"
        style={{ left: filterWidth + 16 }}
      >
        <SearchBar
          query={searchQuery}
          onQueryChange={(value) => {
            setSuppressSuggestions(false);
            setSearchQuery(value);
          }}
          onSubmit={handleSearchSubmit}
          onSelectResult={handleSelectResult}
          results={searchResults}
          loading={loading}
          error={error}
        />
      </div>
    </main>
  );
}
