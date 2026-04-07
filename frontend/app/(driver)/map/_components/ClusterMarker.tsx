"use client";

import { Marker, useMap } from "react-leaflet";
import { divIcon } from "leaflet";

interface ClusterMarkerProps {
  lat: number;
  lng: number;
  count: number;
}

function createClusterIcon(count: number) {
  const displayCount = count > 99 ? "99+" : String(count);

  const html = `
    <div class="cluster-marker">
      <div class="cluster-marker-box">
        <span class="cluster-marker-count">${displayCount}</span>
      </div>
    </div>
  `;

  return divIcon({
    html,
    className: "cluster-marker-wrapper",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export function ClusterMarker({ lat, lng, count }: ClusterMarkerProps) {
  const map = useMap();
  const icon = createClusterIcon(count);

  const handleClick = () => {
    const maxZoom = map.getMaxZoom();
    const boundedMaxZoom = Number.isFinite(maxZoom) ? maxZoom : 19;
    const nextZoom = Math.min(map.getZoom() + 2, boundedMaxZoom);
    if (nextZoom <= map.getZoom()) return;
    map.flyTo([lat, lng], nextZoom);
  };

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      zIndexOffset={100}
      eventHandlers={{ click: handleClick }}
    />
  );
}
