"use client";

import { useMemo, memo, useState } from "react";
import { Marker } from "react-leaflet";
import { divIcon, type LeafletMouseEvent } from "leaflet";
import type { MapStation } from "../_hooks/useChargingStationsQuery";

type PinStatus = "all-available" | "some-booked" | "all-booked" | "maintenance";

const COLLAPSED_PIN_HEIGHT = 36;
const COLLAPSED_PIN_WIDTH = 80;
const EXPANDED_PIN_WIDTH = 360;

const RESERVE_BUTTON_HEIGHT = 38;

export function estimateExpandedPinHeight(station: MapStation): number {
  const baseHeight = 160;
  const inlineRowHeight = 32;
  const stackedRowHeight = 54;
  const listGap = 4;
  const maxListHeight = 150; // Reduced from 234 to show approx 3.5 items

  const fullListHeight = station.chargingPoints.reduce((sum, point, i) => {
    const rowH = point.connectors.length === 1 ? inlineRowHeight : stackedRowHeight;
    return sum + rowH + (i > 0 ? listGap : 0);
  }, 0);
  const listHeight = Math.min(fullListHeight, maxListHeight);

  return baseHeight + listHeight + RESERVE_BUTTON_HEIGHT;
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


function createStationIcon(
  station: MapStation,
  isExpanded: boolean,
  hasActiveOrBookedSession = false,
  selectedChargingPointId: string | null = null,
  shouldAnimate = true
) {
  const status = getPinStatus(station);
  const isMaintenance = status === "maintenance";

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
      const isInline = chargingPoint.connectors.length === 1;
      const isSelectable = chargingPoint.availableNow && !chargingPoint.outOfService;
      const isSelected = selectedChargingPointId === chargingPoint.id;
      
      const rowExtraClass =
        (chargingPoint.outOfService ? " station-pin-point-row-out" : "") +
        (isInline ? " station-pin-point-row-inline" : "") +
        (isSelectable ? " clickable" : "") +
        (isSelected ? " selected" : "");

      const connectorsMarkup = chargingPoint.connectors
        .map(
          (connector) =>
            `<span class="station-pin-connector-chip">${escapeHtml(connector.type)} · ${Math.round(connector.powerKw)} kW · <span class="station-pin-chip-cable station-pin-tooltip-trigger" data-tooltip="${connector.tethered ? "Cable included" : "Bring your cable"}"><span class="material-symbols-outlined">${connector.tethered ? "power" : "power_off"}</span></span></span>`
        )
        .join("");

      const onClickHandler = isSelectable 
        ? `onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('select-charging-point', { detail: { stationId: '${escapeHtml(station.id)}', chargingPointId: '${escapeHtml(chargingPoint.id)}' } }));"`
        : "";

      return `
        <div class="station-pin-point-row${rowExtraClass}" ${onClickHandler}>
          <div class="station-pin-point-identity">
            <span class="station-pin-point-status-dot ${cpStatus.className}"></span>
            <span class="station-pin-point-name">CP ${index + 1}</span>
            <span class="station-pin-point-status-label ${cpStatus.className}-text">${escapeHtml(cpStatus.label)}</span>
          </div>
          <div class="station-pin-connectors">${connectorsMarkup || '<span class="station-pin-connector-empty">No connectors</span>'}</div>
        </div>
      `;
    })
    .join("");

  const expandedContent = isExpanded
    ? `
    <div class="station-pin-expanded ${shouldAnimate ? "animate" : "static"}" onmousedown="event.stopPropagation()" ondblclick="event.stopPropagation()" onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('deselect-charging-point', { detail: { stationId: '${escapeHtml(station.id)}' } }));">
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
      ${(() => {
        const canReserve = !hasActiveOrBookedSession && station.availableNowPoints > 0;
        if (canReserve) {
          const isDisabled = !selectedChargingPointId;
          const btnText = "Reserve";
          const btnClass = isDisabled ? "station-pin-reserve-btn disabled" : "station-pin-reserve-btn";
          const disabledAttr = isDisabled ? "disabled" : "";
          
          return `<button type="button" class="${btnClass}" ${disabledAttr} data-reserve-station-id="${escapeHtml(station.id)}" onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('reserve-station', { detail: { stationId: this.getAttribute('data-reserve-station-id') } }));"><span class="material-symbols-outlined" style="font-size:18px">bolt</span> ${btnText}</button>`;
        }
        const icon = hasActiveOrBookedSession ? "event_busy" : "block";
        const label = hasActiveOrBookedSession ? "Session in progress" : "All points in use";
        return `<div class="station-pin-reserve-hint"><span class="material-symbols-outlined">${icon}</span>${escapeHtml(label)}</div>`;
      })()}
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
      <div class="station-pin-box ${isExpanded ? (shouldAnimate ? "station-pin-box-expanded" : "station-pin-box-expanded-static") : ""}">
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
  hasActiveOrBookedSession?: boolean;
  selectedChargingPointId?: string | null;
}

export const StationPin = memo(function StationPin({
  station,
  isExpanded,
  onClick,
  hasActiveOrBookedSession = false,
  selectedChargingPointId = null,
}: StationPinProps) {
  const [prevIsExpanded, setPrevIsExpanded] = useState(isExpanded);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  if (isExpanded !== prevIsExpanded) {
    setPrevIsExpanded(isExpanded);
    setShouldAnimate(isExpanded && !prevIsExpanded);
  }

  const icon = useMemo(
    () => createStationIcon(station, isExpanded, hasActiveOrBookedSession, selectedChargingPointId, shouldAnimate),
    [station, isExpanded, hasActiveOrBookedSession, selectedChargingPointId, shouldAnimate]
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
    prevProps.hasActiveOrBookedSession === nextProps.hasActiveOrBookedSession &&
    prevProps.selectedChargingPointId === nextProps.selectedChargingPointId &&
    JSON.stringify(prevProps.station) === JSON.stringify(nextProps.station)
  );
});
