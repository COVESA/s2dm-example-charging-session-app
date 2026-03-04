"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "../../sessions/_components/formatters";
import type { ChargingSessionsQuery } from "@/graphql/generated/graphql";

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

type SocTier = "red" | "orange" | "green";

function getSocTier(percent: number | null | undefined): SocTier {
  if (percent == null || percent < 20) return "red";
  if (percent < 50) return "orange";
  return "green";
}

const SOC_COLORS: Record<SocTier, { text: string; fill: string }> = {
  red: { text: "text-rose-500", fill: "fill-rose-500" },
  orange: { text: "text-amber-500", fill: "fill-amber-500" },
  green: { text: "text-emerald-500", fill: "fill-emerald-500" },
};

export function BatteryIcon({ percent, tier }: { percent: number; tier: SocTier }) {
  const fillWidth = Math.max(1, Math.round((percent / 100) * 16));
  const colors = SOC_COLORS[tier];

  return (
    <svg
      width="22"
      height="14"
      viewBox="0 0 24 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      <rect
        x="0.5"
        y="0.5"
        width="20"
        height="13"
        rx="3"
        stroke="currentColor"
        strokeWidth="1"
        className="text-slate-300"
      />
      <rect
        x="2"
        y="2"
        width={fillWidth}
        height="10"
        rx="1.5"
        className={colors.fill}
      />
      <rect
        x="21.5"
        y="4"
        width="2"
        height="6"
        rx="1"
        className="fill-slate-300"
      />
    </svg>
  );
}

export { getSocTier, SOC_COLORS };
export type { SocTier };

interface ActiveSessionBubbleProps {
  session: SessionItem;
  onClick: () => void;
}

export function ActiveSessionBubble({ session, onClick }: ActiveSessionBubbleProps) {
  const isBooked = session.status === "BOOKED";
  const isActive = session.status === "ACTIVE";

  const countdown = useCountdown(
    session.booking.expiresAt,
    isBooked || isActive
  );
  const chargingTime = useElapsedTime(
    session.charging.startedAt,
    isActive
  );

  const energyKwh =
    session.charging.energyDeliveredKwh ??
    (session.charging.meterStopKwh != null && session.charging.meterStartKwh != null
      ? Math.max(0, session.charging.meterStopKwh - session.charging.meterStartKwh)
      : null);
  const energyDisplay = energyKwh != null ? `${energyKwh.toFixed(1)} kWh` : "0.0 kWh";

  const price = formatCurrency(session.cost.totalCents, session.pricingSnapshot.currency);

  const socValue =
    session.charging.socStopPercent ??
    session.charging.socStartPercent ??
    null;
  const socPercent = socValue != null ? Math.round(socValue) : null;
  const socTier = getSocTier(socPercent);
  const socColors = SOC_COLORS[socTier];

  const vehicleLabel = session.vehicleSnapshot
    ? `${session.vehicleSnapshot.make} ${session.vehicleSnapshot.model}`
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 rounded-full border border-white/60 bg-white/90 text-left shadow-xl backdrop-blur-2xl transition-all hover:bg-white/95 hover:shadow-2xl active:scale-[0.97]"
      aria-label="View active session details"
      style={{ margin: 0, padding: "10px 20px" }}
    >
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-tight ${
            isBooked
              ? "bg-blue-50 text-blue-600"
              : "bg-amber-50 text-amber-600"
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            {isBooked ? "schedule" : "bolt"}
          </span>
          {isBooked ? "Booked" : "Charging"}
        </span>
        {vehicleLabel && (
          <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-slate-600">
            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 15 }}>
              directions_car
            </span>
            {vehicleLabel}
          </span>
        )}
      </div>

      {isBooked ? (
        <div className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-slate-500">
          <span className="font-semibold text-emerald-600">{countdown}</span>
          <span>remaining</span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 whitespace-nowrap text-[12px]">
          <span className="shrink-0 font-medium text-slate-700">{chargingTime}</span>
          <span className="text-slate-200">|</span>
          <span className="shrink-0 font-medium text-slate-700">{energyDisplay}</span>
          <span className="text-slate-200">|</span>
          <span className="shrink-0 font-medium text-slate-700">{price}</span>
          <span className="text-slate-200">|</span>
          {socPercent != null && <BatteryIcon percent={socPercent} tier={socTier} />}
          <span className={`shrink-0 font-semibold ${socPercent != null ? socColors.text : "text-slate-400"}`}>
            {socPercent != null ? `${socPercent}%` : "--"}
          </span>
        </div>
      )}
    </button>
  );
}
