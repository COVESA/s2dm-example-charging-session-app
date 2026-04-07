"use client";

import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { divIcon } from "leaflet";

const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; CARTO';
const ZOOM = 17;

const stationPinIcon = divIcon({
  className: "",
  html: `<div style="
    width: 36px; height: 36px; border-radius: 50%;
    background: rgb(16 185 129); border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <span class="material-symbols-outlined" style="font-size: 18px; color: white;">ev_station</span>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

interface SessionMiniMapProps {
  lat: number;
  lng: number;
  sessionId: string;
}

export function SessionMiniMap({ lat, lng, sessionId }: SessionMiniMapProps) {
  return (
    <div className="group relative h-full w-full overflow-hidden rounded-xl">
      <MapContainer
        key={sessionId}
        center={[lat, lng]}
        zoom={ZOOM}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          subdomains="abcd"
          maxZoom={19}
        />
        <Marker position={[lat, lng]} icon={stationPinIcon} />
      </MapContainer>
      <div className="pointer-events-none absolute bottom-1 right-1 z-[500] opacity-0 transition-opacity group-hover:opacity-100">
        <p className="rounded bg-white/85 px-1.5 py-0.5 text-[10px] leading-none text-slate-700 shadow-sm">
          <span className="pointer-events-auto">
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              OSM
            </a>{" "}
            |{" "}
            <a
              href="https://carto.com/attributions"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              CARTO
            </a>
          </span>
        </p>
      </div>
    </div>
  );
}
