"use client";

import { useMemo, memo } from "react";
import { Marker } from "react-leaflet";
import { divIcon, type LeafletMouseEvent } from "leaflet";
import type { MapStation } from "../_hooks/useChargingStationsQuery";

type PinStatus = "all-available" | "some-booked" | "all-booked" | "maintenance";

const COLLAPSED_PIN_HEIGHT = 36;
const COLLAPSED_PIN_WIDTH = 80;
const EXPANDED_PIN_WIDTH = 360;

export function estimateExpandedPinHeight(station: MapStation): number {
  const baseHeight = 162;
  const pointRowHeight = 56;
  const connectorWrapExtraHeight = 18;
  const connectorsPerLine = 2;

  const wrappedConnectorRows = station.chargingPoints.reduce((sum, point) => {
    const rows = Math.ceil(point.connectors.length / connectorsPerLine);
    return sum + Math.max(0, rows - 1);
  }, 0);

  return baseHeight + station.chargingPoints.length * pointRowHeight + wrappedConnectorRows * connectorWrapExtraHeight;
}

function getPinStatus(station: MapStation): PinStatus {
  const { chargingPoints, availableNowPoints, totalPoints, operationalPoints } = station;

  // Prefer per-point runtime flags so pin status matches expanded point rows.
  if (chargingPoints.length > 0) {
    const pointCount = chargingPoints.length;
    const availablePoints = chargingPoints.filter((point) => point.availableNow && !point.outOfService).length;
    const outOfServicePoints = chargingPoints.filter((point) => point.outOfService).length;

    if (availablePoints === pointCount) return "all-available";
    if (availablePoints === 0 && outOfServicePoints === pointCount) return "maintenance";
    if (availablePoints === 0) return "all-booked";
    return "some-booked";
  }

  // Fallback for responses that don't include chargingPoints.
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

const CHARGER_ICON = '<span class="material-symbols-outlined">charger</span>';
const BUILD_CIRCLE_ICON = '<span class="material-symbols-outlined">build_circle</span>';

function createStationIcon(station: MapStation, isExpanded: boolean) {
  const status = getPinStatus(station);
  const isMaintenance = status === "maintenance";
  const isAllBooked = status === "all-booked";

  const isGrayStatus = status === "maintenance";
  const isOrangeStatus = status === "all-booked";
  const iconClass = isGrayStatus
    ? "station-pin-icon-gray"
    : isOrangeStatus
      ? "station-pin-icon-orange"
      : "station-pin-icon-green";

  const iconHtml = isMaintenance ? BUILD_CIRCLE_ICON : CHARGER_ICON;
  const countClass = isGrayStatus
    ? "station-pin-availability-gray"
    : isOrangeStatus
      ? "station-pin-availability-orange"
      : "";
  const countLabelClass = countClass;
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
              <span class="station-pin-connector-sep">•</span>
              <span class="station-pin-connector-cable-icon station-pin-tooltip-trigger" data-tooltip="${connector.tethered ? "Tethered connector" : "Untethered connector"}">${connector.tethered ? '<span class="material-symbols-outlined">power</span>' : '<span class="material-symbols-outlined">power_off</span>'}</span>
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
      <div class="station-pin-section-title">Charging Points</div>
      <div class="station-pin-points-list" onwheel="event.stopPropagation()">${chargingPointsMarkup}</div>
    </div>
  `
    : "";

  const pinColorClass = isGrayStatus
    ? " station-pin-gray"
    : isOrangeStatus
      ? " station-pin-orange"
      : "";
  const dotColorClass = isGrayStatus
    ? " station-pin-dot-gray"
    : isOrangeStatus
      ? " station-pin-dot-orange"
      : " station-pin-dot-green";
  const html = `
    <div class="station-pin${pinColorClass}" data-station-id="${escapeHtml(station.id)}" data-expanded="${isExpanded ? "true" : "false"}">
      <div class="station-pin-box ${isExpanded ? "station-pin-box-expanded" : ""}">
        <div class="station-pin-clipper">
          <div class="station-pin-content">
            <span class="station-pin-icon ${iconClass}">${iconHtml}</span>
            <span class="station-pin-count ${countClass}">
              <span class="station-pin-available">${station.availableNowPoints}</span>
              <span class="station-pin-sep">/</span>
              <span class="station-pin-total">${station.totalPoints}</span>
            </span>
            ${isExpanded ? `<span class="station-pin-count-label ${countLabelClass}">available</span>` : ""}
            ${
              isExpanded
                ? `<span class="station-pin-price-badge station-pin-price-badge-inline">${priceFormatted}</span>`
                : ""
            }
          </div>
          ${expandedContent}
        </div>
      </div>
      <div class="station-pin-dot${dotColorClass}"></div>
    </div>
  `;

  const height = isExpanded ? estimateExpandedPinHeight(station) : COLLAPSED_PIN_HEIGHT;
  const width = isExpanded ? EXPANDED_PIN_WIDTH : COLLAPSED_PIN_WIDTH;

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
