"use client";

import { Marker, Popup } from "react-leaflet";
import { divIcon } from "leaflet";
import type { MapStation } from "../_hooks/useChargingStationsQuery";

interface StationPinProps {
  station: MapStation;
}

function createStationIcon(station: MapStation) {
  const html = `
    <div class="station-pin">
      <div class="station-pin-box">
        <div class="station-pin-content">
          <span class="station-pin-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/>
            </svg>
          </span>
          ${station.hasFastCharging ? '<span class="station-pin-fast-arrow">↑</span>' : ""}
          <span class="station-pin-count">
            <span class="station-pin-available">${station.availableNowPoints}</span>
            <span class="station-pin-sep">/</span>
            <span class="station-pin-total">${station.totalPoints}</span>
          </span>
        </div>
      </div>
      <div class="station-pin-dot"></div>
    </div>
  `;

  return divIcon({
    html,
    className: "station-pin-wrapper",
    iconSize: [80, 36],
    iconAnchor: [40, 36],
  });
}

export function StationPin({ station }: StationPinProps) {
  const icon = createStationIcon(station);

  return (
    <Marker position={[station.lat, station.lng]} icon={icon}>
      <Popup>
        <div className="text-sm">
          <p className="font-medium">{station.name}</p>
          <p>
            {station.availableNowPoints}/{station.totalPoints} available
          </p>
          {station.hasFastCharging && <p className="text-blue-600">Fast charging</p>}
        </div>
      </Popup>
    </Marker>
  );
}
