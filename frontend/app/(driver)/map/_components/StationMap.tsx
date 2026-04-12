"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { useMap } from "react-leaflet";
import { useMapBounds } from "../_hooks/useMapBounds";
import { useChargingStationsQuery } from "../_hooks/useChargingStationsQuery";
import { useStationClusters } from "../_hooks/useStationClusters";
import type { MapStation } from "../_hooks/useChargingStationsQuery";
import { StationPin, estimateExpandedPinHeight } from "./StationPin";
import { ClusterMarker } from "./ClusterMarker";
import { LocationPin } from "./LocationPin";
import { ReserveModal } from "./ReserveModal";
import type { ChargingStationFiltersInput } from "@/graphql/generated/graphql";

const MARIENPLATZ: [number, number] = [48.1374, 11.5755];
const DEFAULT_ZOOM = 16;
const MAP_MAX_ZOOM = 19;

interface StationsLayerProps {
  filters: ChargingStationFiltersInput | undefined;
  locationPin: { lat: number; lng: number } | null;
  expandedStationId: string | null;
  onStationClick: (stationId: string) => void;
  hasActiveOrBookedSession?: boolean;
  onSessionChanged?: () => Promise<unknown> | unknown;
  onReservationComplete?: () => void;
}

interface FocusControllerProps {
  focusLocation: { lat: number; lng: number } | null;
  focusRequestId: number;
}

function MapFocusController({ focusLocation, focusRequestId }: FocusControllerProps) {
  const map = useMap();

  useEffect(() => {
    if (!focusLocation) return;
    map.setView([focusLocation.lat, focusLocation.lng], DEFAULT_ZOOM, {
      animate: false
    });
  }, [focusLocation, focusRequestId, map]);

  return null;
}

function MapInteractionHandler({ onCollapse, onMapMove }: { onCollapse: () => void; onMapMove?: (center: { lat: number; lng: number }) => void }) {
  const map = useMap();
  useMapEvents({
    click: onCollapse,
    dragstart: onCollapse,
    zoomstart: onCollapse,
    moveend: () => {
      const center = map.getCenter();
      onMapMove?.({ lat: center.lat, lng: center.lng });
    },
  });
  return null;
}

function StationsLayer({
  filters,
  locationPin,
  expandedStationId,
  onStationClick,
  hasActiveOrBookedSession = false,
  onSessionChanged,
  onReservationComplete
}: StationsLayerProps) {
  const map = useMap();
  const [reserveStationId, setReserveStationId] = useState<string | null>(null);
  const [selectedChargingPointId, setSelectedChargingPointId] = useState<string | null>(null);
  const { bounds, zoom } = useMapBounds();
  const {
    stations,
    serverClusters,
    isServerClustered,
    refetch: refetchStations,
  } = useChargingStationsQuery(bounds, zoom, filters);
  const clientClusters = useStationClusters(
    stations,
    bounds ? [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat] : undefined,
    zoom
  );

  const lastPannedId = useRef<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ stationId: string }>;
      setReserveStationId(customEvent.detail?.stationId ?? null);
    };
    window.addEventListener("reserve-station", handler);
    return () => window.removeEventListener("reserve-station", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ stationId: string; chargingPointId: string }>;
      if (customEvent.detail?.stationId === expandedStationId) {
        setSelectedChargingPointId(prevId => 
          prevId === customEvent.detail.chargingPointId ? null : customEvent.detail.chargingPointId
        );
      }
    };
    window.addEventListener("select-charging-point", handler);
    return () => window.removeEventListener("select-charging-point", handler);
  }, [expandedStationId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ stationId: string }>;
      if (customEvent.detail?.stationId === expandedStationId) {
        setSelectedChargingPointId(null);
      }
    };
    window.addEventListener("deselect-charging-point", handler);
    return () => window.removeEventListener("deselect-charging-point", handler);
  }, [expandedStationId]);

  const reserveStation = reserveStationId
    ? stations.find((s) => s.id === reserveStationId)
    : null;

  const getRenderedExpandedPinHeight = useCallback((stationId: string) => {
    const markers = document.querySelectorAll<HTMLElement>(".station-pin[data-expanded='true']");
    for (const marker of markers) {
      if (marker.dataset.stationId === stationId) {
        return marker.offsetHeight;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (!expandedStationId) {
      lastPannedId.current = null;
      return;
    }

    // Prevent re-panning if we already handled this station expansion
    if (expandedStationId === lastPannedId.current) return;

    const station = stations.find((s) => s.id === expandedStationId);
    if (!station) return;

    let frameId = 0;
    frameId = window.requestAnimationFrame(() => {
      const renderedHeight = getRenderedExpandedPinHeight(expandedStationId);
      const expandedPinHeight = renderedHeight ?? estimateExpandedPinHeight(station);
      const point = map.latLngToContainerPoint([station.lat, station.lng]);
      const bubbleTop = point.y - expandedPinHeight;
      const topMargin = 80; // Navbar height + safe area.

      if (bubbleTop < topMargin) {
        const offset = bubbleTop - topMargin;
        map.panBy([0, offset], { animate: true });
      }

      lastPannedId.current = expandedStationId;
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [expandedStationId, getRenderedExpandedPinHeight, map, stations]);

  return (
    <>
      {reserveStation && (
        <ReserveModal
          station={reserveStation}
          initialChargingPointId={selectedChargingPointId}
          onClose={() => setReserveStationId(null)}
          onReservationSuccess={() => { refetchStations(); onReservationComplete?.(); }}
          onSessionChanged={onSessionChanged}
        />
      )}
      {locationPin && (
        <LocationPin lat={locationPin.lat} lng={locationPin.lng} />
      )}
      {isServerClustered
        ? serverClusters.map((cluster) => (
            <ClusterMarker
              key={`cluster-${cluster.id}`}
              lat={cluster.lat}
              lng={cluster.lng}
              count={cluster.count}
            />
          ))
        : clientClusters.map((cluster) => {
            const [lng, lat] = cluster.geometry.coordinates;
            const props = cluster.properties as {
              cluster?: boolean;
              point_count?: number;
            } & MapStation;

            if (props.cluster && props.point_count !== undefined) {
              return (
                <ClusterMarker
                  key={`cluster-${cluster.id}`}
                  lat={lat}
                  lng={lng}
                  count={props.point_count}
                />
              );
            }

            const station = props as MapStation;
            return (
              <StationPin
                key={station.id}
                station={station}
                isExpanded={expandedStationId === station.id}
                onClick={() => onStationClick(station.id)}
                hasActiveOrBookedSession={hasActiveOrBookedSession}
                selectedChargingPointId={expandedStationId === station.id ? selectedChargingPointId : null}
              />
            );
          })}
    </>
  );
}

interface StationMapProps {
  filters: ChargingStationFiltersInput | undefined;
  locationPin: { lat: number; lng: number } | null;
  focusRequestId: number;
  onMapMove?: (center: { lat: number; lng: number }) => void;
  hasActiveOrBookedSession?: boolean;
  onSessionChanged?: () => Promise<unknown> | unknown;
  onReservationComplete?: () => void;
}

export function StationMap({
  filters,
  locationPin,
  focusRequestId,
  onMapMove,
  hasActiveOrBookedSession = false,
  onSessionChanged,
  onReservationComplete
}: StationMapProps) {
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [expandedStationId, setExpandedStationId] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleStationClick = useCallback((stationId: string) => {
    setExpandedStationId(stationId);
  }, []);

  const handleMapClick = useCallback(() => {
    setExpandedStationId(null);
  }, []);

  if (!mounted || typeof window === "undefined") {
    return (
      <div className="h-full min-h-[400px] w-full bg-slate-100 animate-pulse" aria-hidden="true" />
    );
  }

  return (
    <div className="h-full w-full">
      <MapContainer
        center={MARIENPLATZ}
        zoom={DEFAULT_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        className="h-full w-full"
        scrollWheelZoom
        zoomControl={false}
        whenReady={() => setMapReady(true)}
      >
        {mapReady && (
          <>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={MAP_MAX_ZOOM}
            />
            <MapFocusController
              focusLocation={locationPin}
              focusRequestId={focusRequestId}
            />
            <MapInteractionHandler onCollapse={handleMapClick} onMapMove={onMapMove} />
            <StationsLayer
              filters={filters}
              locationPin={locationPin}
              expandedStationId={expandedStationId}
              onStationClick={handleStationClick}
              hasActiveOrBookedSession={hasActiveOrBookedSession}
              onSessionChanged={onSessionChanged}
              onReservationComplete={onReservationComplete}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
