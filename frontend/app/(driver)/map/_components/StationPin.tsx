"use client";

import { useMemo } from "react";
import { Marker } from "react-leaflet";
import { divIcon, type LeafletMouseEvent } from "leaflet";
import type { MapStation } from "../_hooks/useChargingStationsQuery";

type PinStatus = "all-available" | "some-booked" | "all-booked" | "maintenance";

function getPinStatus(station: MapStation): PinStatus {
  const { availableNowPoints, totalPoints, operationalPoints } = station;
  if (totalPoints === 0) return "all-available";
  if (availableNowPoints === 0 && operationalPoints === 0) return "maintenance";
  if (availableNowPoints === 0) return "all-booked";
  if (availableNowPoints === totalPoints) return "all-available";
  return "some-booked";
}

const LIGHTNING_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/></svg>';

const WRENCH_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>';

function createStationIcon(station: MapStation, isExpanded: boolean) {
  const status = getPinStatus(station);
  const isMaintenance = status === "maintenance";

  const iconClass =
    status === "all-available"
      ? "station-pin-icon-green"
      : status === "some-booked"
        ? "station-pin-icon-light-green"
        : "station-pin-icon-gray";

  const iconHtml = isMaintenance ? WRENCH_SVG : LIGHTNING_SVG;
  const countClass = isMaintenance ? "station-pin-maintenance" : "";

  const expandedContent = isExpanded
    ? `
    <div class="station-pin-expanded">
      <div class="station-pin-name">${escapeHtml(station.name)}</div>
      <div class="station-pin-meta">
        ${station.availableNowPoints}/${station.totalPoints} available
        ${station.hasFastCharging ? '<span class="station-pin-fast">Fast charging</span>' : ""}
      </div>
    </div>
  `
    : "";

  const html = `
    <div class="station-pin">
      <div class="station-pin-box ${isExpanded ? "station-pin-box-expanded" : ""}">
        <div class="station-pin-clipper">
          <div class="station-pin-content">
            <span class="station-pin-icon ${iconClass}">${iconHtml}</span>
            ${station.hasFastCharging && !isMaintenance ? '<span class="station-pin-fast-arrow">↑</span>' : ""}
            <span class="station-pin-count ${countClass}">
              <span class="station-pin-available">${station.availableNowPoints}</span>
              <span class="station-pin-sep">/</span>
              <span class="station-pin-total">${station.totalPoints}</span>
            </span>
          </div>
          ${expandedContent}
        </div>
      </div>
      <div class="station-pin-dot"></div>
    </div>
  `;

  const collapsedHeight = 36;
  const expandedHeight = 110;
  const height = isExpanded ? expandedHeight : collapsedHeight;
  const width = isExpanded ? 200 : 80;

  return divIcon({
    html,
    className: "station-pin-wrapper",
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface StationPinProps {
  station: MapStation;
  isExpanded: boolean;
  onClick: () => void;
}

export function StationPin({ station, isExpanded, onClick }: StationPinProps) {
  const icon = useMemo(
    () => createStationIcon(station, isExpanded),
    [
      station.name,
      station.availableNowPoints,
      station.totalPoints,
      station.operationalPoints,
      station.hasFastCharging,
      isExpanded,
    ]
  );

  const handleClick = (e: LeafletMouseEvent) => {
    e.originalEvent.stopPropagation();
    onClick();
  };

  return (
    <Marker
      position={[station.lat, station.lng]}
      icon={icon}
      eventHandlers={{ click: handleClick }}
      zIndexOffset={isExpanded ? 1000 : 0}
    />
  );
}
