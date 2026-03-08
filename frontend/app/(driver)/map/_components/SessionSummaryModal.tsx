"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { formatCurrency } from "../../sessions/_components/formatters";
import { useSessionActions } from "../../sessions/_hooks/useSessionActions";
import type { ChargingSessionsQuery } from "@/graphql/generated/graphql";
import { BatteryIcon, getSocTier, SOC_COLORS } from "./ActiveSessionBubble";

type SessionItem = ChargingSessionsQuery["chargingSessions"]["edges"][number];

function useCountdown(expiresAtIso: string | null, enabled: boolean): string {
  const [display, setDisplay] = useState<string>("--:--");

  useEffect(() => {
    if (!enabled || !expiresAtIso) return;

    const tick = () => {
      const now = new Date().getTime();
      const expires = new Date(expiresAtIso).getTime();
      const diff = Math.max(0, Math.floor((expires - now) / 1000));

      if (diff <= 0) {
        setDisplay("0:00");
        return;
      }

      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setDisplay(`${m}:${s.toString().padStart(2, "0")}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAtIso, enabled]);

  return display;
}

function useElapsedTime(startedAtIso: string | null, enabled: boolean): string {
  const [display, setDisplay] = useState<string>("0:00");

  useEffect(() => {
    if (!enabled || !startedAtIso) {
      setDisplay("0:00");
      return;
    }

    const tick = () => {
      const now = Date.now();
      const started = new Date(startedAtIso).getTime();
      const diffSeconds = Math.max(0, Math.floor((now - started) / 1000));
      const hours = Math.floor(diffSeconds / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);
      const seconds = diffSeconds % 60;

      if (hours > 0) {
        setDisplay(
          `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`
        );
        return;
      }

      setDisplay(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAtIso, enabled]);

  return display;
}

function InfoRow({
  label,
  value,
  valueClassName
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className={`text-[13px] font-semibold ${valueClassName ?? "text-slate-800"}`}>
        {value}
      </span>
    </div>
  );
}

interface SessionSummaryModalProps {
  session: SessionItem;
  onClose: () => void;
  onSessionChanged?: () => Promise<unknown> | unknown;
}

export function SessionSummaryModal({
  session,
  onClose,
  onSessionChanged
}: SessionSummaryModalProps) {
  const isBooked = session.status === "BOOKED";
  const isActive = session.status === "ACTIVE";

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSuccess = useCallback(async () => {
    await onSessionChanged?.();
    handleClose();
  }, [onSessionChanged, handleClose]);

  const {
    startCharging: handleStartCharging,
    cancelReservation: handleCancelReservation,
    stopCharging: handleStopCharging,
    isUpdating: isUpdatingSession,
    error: actionError
  } = useSessionActions({
    sessionId: session.id,
    isBooked,
    onSuccess: handleSuccess
  });

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleClose]);

  const countdown = useCountdown(
    session.booking.expiresAt,
    isBooked || isActive
  );
  const chargingTime = useElapsedTime(
    session.charging.startedAt ?? null,
    isActive
  );

  const energyKwh =
    session.charging.energyDeliveredKwh ??
    (session.charging.meterStopKwh != null && session.charging.meterStartKwh != null
      ? Math.max(0, session.charging.meterStopKwh - session.charging.meterStartKwh)
      : null);
  const energyDisplay = energyKwh != null ? `${energyKwh.toFixed(2)} kWh` : "0.00 kWh";

  const price = formatCurrency(session.cost.totalCents, session.pricingSnapshot.currency);
  const rateDisplay = `${(session.pricingSnapshot.priceCentsPerKwh / 100).toFixed(2)} EUR/kWh`;

  const socValue =
    session.charging.socStopPercent ?? session.charging.socStartPercent ?? null;
  const socPercent = socValue != null ? Math.round(socValue) : null;
  const socTier = getSocTier(socPercent);
  const socColors = SOC_COLORS[socTier];

  const vehicleLabel = session.vehicleSnapshot
    ? `${session.vehicleSnapshot.make} ${session.vehicleSnapshot.model}`
    : null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-summary-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-0">
          <h2
            id="session-summary-modal-title"
            className="text-[17px] font-bold text-slate-900"
          >
            {isBooked ? "Reservation" : "Charging Session"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            aria-label="Close"
            style={{ margin: 0, padding: 0, border: "none" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Hero area */}
        <div className="flex flex-col items-center px-6 pt-5 pb-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full ${
              isBooked ? "bg-emerald-50" : "bg-amber-50"
            }`}
          >
            <span
              className={`material-symbols-outlined text-3xl ${
                isBooked ? "text-emerald-500" : "text-amber-500"
              }`}
            >
              {isBooked ? "event_available" : "bolt"}
            </span>
          </div>
          <p className="mt-3 text-center text-[15px] font-semibold text-slate-800">
            {isBooked
              ? "Your charging point is reserved"
              : "Your session is active"}
          </p>
          {vehicleLabel && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-400">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>directions_car</span>
              {vehicleLabel}
            </div>
          )}
        </div>

        {/* Details card */}
        <div className="mx-6 mb-4 divide-y divide-slate-100 rounded-2xl bg-slate-50/80 px-4">
          <InfoRow label="Station" value={session.stationSnapshot.name} />
          <InfoRow label="Charging Point" value={session.stationSnapshot.chargingPointLabel} />
          <InfoRow label="Rate" value={rateDisplay} />

          {isBooked ? (
            <InfoRow label="Time remaining" value={countdown} valueClassName="text-emerald-600" />
          ) : (
            <>
              <InfoRow label="Duration" value={chargingTime} />
              <InfoRow label="Energy consumed" value={energyDisplay} />
              <InfoRow label="Cost so far" value={price} />
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[13px] text-slate-500">Battery</span>
                <div className="flex items-center gap-2">
                  {socPercent != null && <BatteryIcon percent={socPercent} tier={socTier} />}
                  <span className={`text-[13px] font-semibold ${socPercent != null ? socColors.text : "text-slate-400"}`}>
                    {socPercent != null ? `${socPercent}%` : "--"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-1">
          <div className="space-y-2.5">
            {isBooked ? (
              <>
                <button
                  type="button"
                  onClick={handleStartCharging}
                  disabled={isUpdatingSession}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
                  style={{ margin: 0 }}
                >
                  <span className="material-symbols-outlined text-xl">bolt</span>
                  {isUpdatingSession ? "Starting..." : "Start Charging"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelReservation}
                  disabled={isUpdatingSession}
                  className="w-full rounded-2xl py-3 text-[14px] font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                  style={{ margin: 0, border: "none", background: "transparent" }}
                >
                  {isUpdatingSession ? "Updating..." : "Cancel Reservation"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStopCharging}
                disabled={isUpdatingSession}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-slate-700"
                style={{ margin: 0 }}
              >
                <span className="material-symbols-outlined text-xl">stop_circle</span>
                {isUpdatingSession ? "Stopping..." : "Stop Charging"}
              </button>
            )}
            {actionError && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-[13px] text-rose-600">
                <span className="material-symbols-outlined mt-0.5 shrink-0" style={{ fontSize: 16 }}>error</span>
                {actionError}
              </div>
            )}
          </div>
          {!isBooked && (
            <Link
              href={`/sessions?sessionId=${session.id}`}
              className="mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-[13px] font-medium text-slate-400 no-underline transition-colors hover:text-slate-600"
              style={{ margin: 0, border: "none", background: "transparent" }}
            >
              View more details
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
