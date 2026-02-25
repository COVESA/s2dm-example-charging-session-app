"use client";

import { useMemo, memo } from "react";
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

function getChargingPointStatus(chargingPoint: MapStation["chargingPoints"][number]) {
  if (chargingPoint.outOfService) return { label: "Out of service", className: "station-pin-status-out" };
  if (chargingPoint.availableNow) return { label: "Available", className: "station-pin-status-available" };
  return { label: "In use", className: "station-pin-status-in-use" };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LIGHTNING_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/></svg>';

const WRENCH_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>';

const PLUG_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h2v6h2V2h2v6h1a3 3 0 0 1 3 3v1a5 5 0 0 1-5 5v5h-2v-5a5 5 0 0 1-5-5v-1a3 3 0 0 1 3-3h1V2z"/></svg>';

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
  const priceFormatted = `${(station.priceCentsPerKwh / 100).toFixed(2)} €`;

  const chargingPointsMarkup = station.chargingPoints
    .map((chargingPoint, index) => {
      const cpStatus = getChargingPointStatus(chargingPoint);
      const isOutOfService = chargingPoint.outOfService;
      const rowOutClass = isOutOfService ? " station-pin-point-row-out" : "";
      const connectorsMarkup = chargingPoint.connectors
        .map(
          (connector) => `
            <span class="station-pin-connector-chip">
              <span class="station-pin-connector-type">${escapeHtml(connector.type)}</span>
              <span class="station-pin-connector-sep">•</span>
              <span class="station-pin-connector-power">${Math.round(connector.powerKw)} kW</span>
              ${
                connector.tethered
                  ? `<span class="station-pin-connector-tethered-icon station-pin-tooltip-trigger" data-tooltip="Tethered connector">${PLUG_SVG}</span>`
                  : ""
              }
            </span>
          `
        )
        .join("");

      return `
        <div class="station-pin-point-row${rowOutClass}">
          <span class="station-pin-point-status-dot station-pin-status-dot-trigger ${cpStatus.className}" data-tooltip="${escapeHtml(cpStatus.label)}" aria-label="${escapeHtml(cpStatus.label)}"></span>
          <span class="station-pin-point-name">CP ${index + 1}</span>
          <div class="station-pin-connectors">${connectorsMarkup || '<span class="station-pin-connector-empty">No connectors</span>'}</div>
        </div>
      `;
    })
    .join("");

  const expandedContent = isExpanded
    ? `
    <div class="station-pin-expanded" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()">
      <div class="station-pin-header">
        <div class="station-pin-header-main">
          <div class="station-pin-name">${escapeHtml(station.operator ?? station.name)}</div>
          ${
            station.address
              ? `<div class="station-pin-address">${escapeHtml(station.address.street || "")}${
                  station.address.city ? `, ${escapeHtml(station.address.city)}` : ""
                }</div>`
              : ""
          }
        </div>
      </div>
      <div class="station-pin-points-list" onwheel="event.stopPropagation()">${chargingPointsMarkup}</div>
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
            ${isExpanded ? '<span class="station-pin-count-label">available</span>' : ""}
            ${
              isExpanded
                ? `<span class="station-pin-price-badge station-pin-price-badge-inline">${priceFormatted}</span>`
                : ""
            }
          </div>
          ${expandedContent}
        </div>
      </div>
      <div class="station-pin-dot"></div>
    </div>
  `;

  const collapsedHeight = 36;
  const expandedHeight = Math.min(
    420,
    Math.max(240, 186 + station.chargingPoints.length * 66)
  );
  const height = isExpanded ? expandedHeight : collapsedHeight;
  const width = isExpanded ? 340 : 80;

  return divIcon({
    html,
    className: "station-pin-wrapper",
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
  });
}

interface StationPinProps {
  station: MapStation;
  isExpanded: boolean;
  onClick: () => void;
}

export const StationPin = memo(function StationPin({
  station,
  isExpanded,
  onClick,
}: StationPinProps) {
  const icon = useMemo(
    () => createStationIcon(station, isExpanded),
    [station, isExpanded]
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
}, (prevProps, nextProps) => {
  return (
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.station.id === nextProps.station.id &&
    JSON.stringify(prevProps.station) === JSON.stringify(nextProps.station)
  );
});
