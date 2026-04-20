"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ChargingSessionsQuery } from "@/graphql/generated/graphql";
import { IncidentSeverity } from "@/graphql/generated/graphql";
import { useSessionFeedback } from "@/hooks/useSessionFeedback";
import {
  RatingStars,
  SessionFeedbackModal
} from "@/ui/SessionFeedback";
import { SessionStatusBadge } from "./SessionStatusBadge";
import { useSessionActions } from "../_hooks/useSessionActions";
import { useReportSessionIncident } from "../_hooks/useReportSessionIncident";
import { ReportIncidentModal } from "./ReportIncidentModal";
import {
  formatCurrency,
  formatEnergy,
  formatSessionDateTime,
  formatSessionDate,
  formatDuration,
  formatConnector,
  formatSocCurrent,
  formatRate,
  formatIdleFeePolicy,
} from "./formatters";

type SessionItem = ChargingSessionsQuery["chargingSessions"]["edges"][number];

const SessionMiniMap = dynamic(
  () => import("./SessionMiniMap").then((mod) => mod.SessionMiniMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-slate-100" />
  }
);

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

function useLiveDuration(startIso: string | null | undefined, enabled: boolean): string {
  const [display, setDisplay] = useState(() => formatDuration(startIso, null));

  useEffect(() => {
    if (!enabled || !startIso) return;

    const tick = () => setDisplay(formatDuration(startIso, null));
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [startIso, enabled]);

  return display;
}

function InfoCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-xl bg-slate-50 px-5 py-4 3xl:px-6 3xl:py-5">
      <div className="mb-3 flex items-center gap-1.5 3xl:mb-4">
        <span className="material-symbols-outlined text-sm text-slate-400">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 3xl:text-[13px]">{title}</span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1.5 3xl:gap-2.5">{children}</div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 3xl:py-2">
      <span className="text-sm text-slate-500 3xl:text-[15px]">{label}</span>
      <span className="text-sm font-semibold text-slate-800 3xl:text-[15px]">{value}</span>
    </div>
  );
}

function BatteryBar({ startPercent, stopPercent }: { startPercent: number | null | undefined; stopPercent: number | null | undefined }) {
  if (startPercent == null && stopPercent == null) {
    return <InfoItem label="Battery" value="--" />;
  }

  const start = startPercent ?? 0;
  const stop = stopPercent ?? startPercent ?? 0;

  return (
    <div className="py-1.5 3xl:py-2">
      <div className="flex items-center">
        <span className="shrink-0 text-sm text-slate-500 3xl:text-[15px]">Battery</span>
        <div className="ml-auto w-[55%]">
          <div className="relative h-1.5 rounded-full bg-slate-200">
            {start > 0 && (
              <div
                className="absolute h-full rounded-l-full bg-emerald-200"
                style={{ left: 0, width: `${start}%` }}
              />
            )}
            <div
              className="absolute h-full bg-emerald-400"
              style={{
                left: `${start}%`,
                width: `${Math.max(stop - start, 0.5)}%`,
                borderRadius: start === 0 ? "9999px" : "0 9999px 9999px 0",
              }}
            />
            {start > 0 && (
              <div
                className="absolute top-[-1px] h-[8px] w-[2px] rounded-full bg-white"
                style={{ left: `${start}%`, transform: "translateX(-50%)" }}
              />
            )}
          </div>
        </div>
      </div>
      <div className="relative ml-auto mt-0.5 flex h-3 w-[55%]">
        {Math.abs(stop - start) < 12 ? (
          <span
            className="absolute flex gap-1 text-[10px]"
            style={{ left: `${(start + stop) / 2}%`, transform: "translateX(-50%)" }}
          >
            <span className="font-medium text-slate-400">{Math.round(start)}%</span>
            <span className="font-semibold text-emerald-600">{Math.round(stop)}%</span>
          </span>
        ) : (
          <>
            <span
              className="absolute text-[10px] font-medium text-slate-400"
              style={{ left: `${start}%`, transform: "translateX(-50%)" }}
            >
              {Math.round(start)}%
            </span>
            <span
              className="absolute text-[10px] font-semibold text-emerald-600"
              style={{ left: `${stop}%`, transform: "translateX(-50%)" }}
            >
              {Math.round(stop)}%
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function HeroMetric({
  icon,
  iconBg,
  iconColor,
  label,
  value
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 3xl:gap-4 3xl:px-5 3xl:py-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full 3xl:h-11 3xl:w-11 ${iconBg}`}>
        <span className={`material-symbols-outlined text-lg 3xl:text-xl ${iconColor}`}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 3xl:text-[13px]">{label}</p>
        <p className="text-lg font-semibold leading-tight text-slate-900 3xl:text-xl">{value}</p>
      </div>
    </div>
  );
}

function MetricGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-8 3xl:gap-12">
      {children}
    </div>
  );
}

function BookedHeroMetrics({ session, countdown }: { session: SessionItem; countdown: string }) {
  return (
    <MetricGrid>
      <HeroMetric
        icon="bolt"
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
        label="Energy"
        value={formatEnergy(session.charging.energyDeliveredKwh)}
      />
      <HeroMetric
        icon="payments"
        iconBg="bg-emerald-100"
        iconColor="text-emerald-600"
        label="Cost"
        value={formatCurrency(session.cost.totalCents, session.pricingSnapshot.currency)}
      />
      <HeroMetric
        icon="timer"
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        label="Time Remaining"
        value={countdown}
      />
      <HeroMetric
        icon="battery_charging_full"
        iconBg="bg-cyan-100"
        iconColor="text-cyan-600"
        label="Charge"
        value={formatSocCurrent(session.charging.socStartPercent, session.charging.socStopPercent)}
      />
    </MetricGrid>
  );
}

function ActiveHeroMetrics({ session, liveDuration }: { session: SessionItem; liveDuration: string }) {
  return (
    <MetricGrid>
      <HeroMetric
        icon="bolt"
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
        label="Energy"
        value={formatEnergy(session.charging.energyDeliveredKwh)}
      />
      <HeroMetric
        icon="payments"
        iconBg="bg-emerald-100"
        iconColor="text-emerald-600"
        label="Cost so far"
        value={formatCurrency(session.cost.totalCents, session.pricingSnapshot.currency)}
      />
      <HeroMetric
        icon="schedule"
        iconBg="bg-slate-200"
        iconColor="text-slate-600"
        label="Duration"
        value={liveDuration}
      />
      <HeroMetric
        icon="battery_charging_full"
        iconBg="bg-cyan-100"
        iconColor="text-cyan-600"
        label="Charge"
        value={formatSocCurrent(session.charging.socStartPercent, session.charging.socStopPercent)}
      />
    </MetricGrid>
  );
}

function CompletedHeroMetrics({ session }: { session: SessionItem }) {
  return (
    <MetricGrid>
      <HeroMetric
        icon="payments"
        iconBg="bg-emerald-100"
        iconColor="text-emerald-600"
        label="Total Cost"
        value={formatCurrency(session.cost.totalCents, session.pricingSnapshot.currency)}
      />
      <HeroMetric
        icon="bolt"
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
        label="Energy"
        value={formatEnergy(session.charging.energyDeliveredKwh)}
      />
      <HeroMetric
        icon="schedule"
        iconBg="bg-slate-200"
        iconColor="text-slate-600"
        label="Duration"
        value={formatDuration(session.charging.startedAt, session.charging.endedAt)}
      />
      <HeroMetric
        icon="battery_charging_full"
        iconBg="bg-cyan-100"
        iconColor="text-cyan-600"
        label="Charge"
        value={formatSocCurrent(session.charging.socStartPercent, session.charging.socStopPercent)}
      />
    </MetricGrid>
  );
}

function TerminalHeroMetrics({ session }: { session: SessionItem }) {
  return (
    <MetricGrid>
      <HeroMetric
        icon="bolt"
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
        label="Energy"
        value={formatEnergy(session.charging.energyDeliveredKwh)}
      />
      <HeroMetric
        icon="payments"
        iconBg="bg-emerald-100"
        iconColor="text-emerald-600"
        label="Cost"
        value={formatCurrency(session.cost.totalCents, session.pricingSnapshot.currency)}
      />
      <HeroMetric
        icon="schedule"
        iconBg="bg-slate-200"
        iconColor="text-slate-600"
        label="Duration"
        value={formatDuration(session.charging.startedAt, session.charging.endedAt)}
      />
      <HeroMetric
        icon="battery_charging_full"
        iconBg="bg-cyan-100"
        iconColor="text-cyan-600"
        label="Charge"
        value={formatSocCurrent(session.charging.socStartPercent, session.charging.socStopPercent)}
      />
    </MetricGrid>
  );
}

function SessionFooter({
  session,
  onSessionChanged
}: {
  session: SessionItem;
  onSessionChanged?: () => Promise<unknown> | unknown;
}) {
  const isBooked = session.status === "BOOKED";
  const isActive = session.status === "ACTIVE";
  const isCompleted = session.status === "COMPLETED";
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [incidentSuccessMessage, setIncidentSuccessMessage] = useState<string | null>(null);
  const [draftRating, setDraftRating] = useState(0);

  const { startCharging, cancelReservation, stopCharging, isUpdating, error } =
    useSessionActions({ sessionId: session.id, isBooked });
  const {
    submitFeedback,
    isSubmitting: isSubmittingFeedback,
    error: feedbackError,
    clearError: clearFeedbackError
  } = useSessionFeedback({ sessionId: session.id });
  const {
    submitIncident,
    isSubmitting: isSubmittingIncident,
    error: incidentError,
    clearError: clearIncidentError
  } = useReportSessionIncident({ sessionId: session.id });

  useEffect(() => {
    if (!incidentSuccessMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIncidentSuccessMessage(null);
    }, 10_000);

    return () => window.clearTimeout(timeoutId);
  }, [incidentSuccessMessage]);

  const openFeedbackModal = (rating = 0) => {
    setDraftRating(rating);
    clearFeedbackError();
    setFeedbackModalOpen(true);
  };

  const closeFeedbackModal = () => {
    clearFeedbackError();
    setFeedbackModalOpen(false);
  };

  const openIncidentModal = () => {
    setIncidentSuccessMessage(null);
    clearIncidentError();
    setIncidentModalOpen(true);
  };

  const closeIncidentModal = () => {
    clearIncidentError();
    setIncidentModalOpen(false);
  };

  const handleStartCharging = async () => {
    const updatedSession = await startCharging();
    if (updatedSession) {
      await onSessionChanged?.();
    }
  };

  const handleCancelReservation = async () => {
    const updatedSession = await cancelReservation();
    if (updatedSession) {
      await onSessionChanged?.();
    }
  };

  const handleStopCharging = async () => {
    const updatedSession = await stopCharging();
    if (!updatedSession) {
      return;
    }

    await onSessionChanged?.();
    openFeedbackModal();
  };

  const handleSubmitFeedback = async ({
    rating,
    comment
  }: {
    rating: number;
    comment: string | null;
  }) => {
    const updatedSession = await submitFeedback({ rating, comment });
    if (!updatedSession) {
      return;
    }

    await onSessionChanged?.();
    closeFeedbackModal();
  };

  const handleSubmitIncident = async ({
    severity,
    description
  }: {
    severity: IncidentSeverity;
    description: string;
  }) => {
    const incidentId = await submitIncident({ severity, description });
    if (!incidentId) {
      return;
    }

    closeIncidentModal();
    setIncidentSuccessMessage("Issue reported. Our operations team will review it.");
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div className="flex min-h-[52px] items-center justify-center">
        {isCompleted && (
          <div className="flex flex-col items-center gap-2">
            <RatingStars
              value={session.feedback?.rating}
              onChange={session.feedback ? undefined : (rating) => openFeedbackModal(rating)}
            />
            {!session.feedback && (
              <p className="text-xs font-medium text-slate-400">
                Tap a star to rate this session
              </p>
            )}
          </div>
        )}
        {isBooked && (
          <button
            type="button"
            onClick={() => void handleStartCharging()}
            disabled={isUpdating}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-8 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
            style={{ margin: 0 }}
          >
            <span className="material-symbols-outlined text-xl">bolt</span>
            {isUpdating ? "Starting..." : "Start Charging"}
          </button>
        )}
        {isActive && (
          <button
            type="button"
            onClick={() => void handleStopCharging()}
            disabled={isUpdating}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-8 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-slate-700"
            style={{ margin: 0 }}
          >
            <span className="material-symbols-outlined text-xl">stop_circle</span>
            {isUpdating ? "Stopping..." : "Stop Charging"}
          </button>
        )}
      </div>

      {error && (
        <div className="flex w-full items-start gap-2 rounded-xl bg-rose-50 p-3 text-[13px] text-rose-600">
          <span className="material-symbols-outlined mt-0.5 shrink-0" style={{ fontSize: 16 }}>error</span>
          {error}
        </div>
      )}

      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={openIncidentModal}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-2.5 text-[13px] font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
            style={{ margin: 0, border: "none", background: "transparent" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>flag</span>
            Report an Issue
          </button>
          <div className="min-w-0 flex-1">
            {incidentSuccessMessage && (
              <div className="flex items-start gap-2 text-[13px] text-emerald-700">
                <span
                  className="material-symbols-outlined mt-0.5 shrink-0"
                  style={{ fontSize: 16 }}
                >
                  check_circle
                </span>
                <span className="min-w-0 break-words leading-snug">
                  {incidentSuccessMessage}
                </span>
              </div>
            )}
          </div>
        </div>
        {isBooked && (
          <button
            type="button"
            onClick={() => void handleCancelReservation()}
            disabled={isUpdating}
            className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2.5 text-[13px] font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
            style={{ margin: 0, border: "none", background: "transparent" }}
          >
            {isUpdating ? "Updating..." : "Cancel Reservation"}
          </button>
        )}
      </div>

      {feedbackModalOpen && (
        <SessionFeedbackModal
          title="Rate This Charge"
          initialRating={draftRating}
          onDismiss={closeFeedbackModal}
          onSubmit={handleSubmitFeedback}
          isSubmitting={isSubmittingFeedback}
          error={feedbackError}
        />
      )}

      {incidentModalOpen && (
        <ReportIncidentModal
          onDismiss={closeIncidentModal}
          onSubmit={handleSubmitIncident}
          isSubmitting={isSubmittingIncident}
          error={incidentError}
        />
      )}
    </div>
  );
}

export function SessionDetail({
  session,
  onSessionChanged
}: {
  session: SessionItem;
  onSessionChanged?: () => Promise<unknown> | unknown;
}) {
  const isBooked = session.status === "BOOKED";
  const isActive = session.status === "ACTIVE";
  const isCompleted = session.status === "COMPLETED";
  const isTerminal = session.status === "CANCELED" || session.status === "NO_SHOW" || session.status === "FAILED";

  const countdown = useCountdown(session.booking.expiresAt, isBooked);
  const liveDuration = useLiveDuration(session.charging.startedAt, isActive);

  const vehicleLabel = `${session.vehicleSnapshot.make} ${session.vehicleSnapshot.model}`;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm 3xl:gap-9 3xl:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 3xl:h-11 3xl:w-11">
            <span className="material-symbols-outlined text-xl text-slate-600">ev_station</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 3xl:text-xl">{session.stationSnapshot.name}</h2>
            <p className="text-sm text-slate-500">
              {session.stationSnapshot.chargingPointLabel} · {session.stationSnapshot.addressShort}
            </p>
          </div>
        </div>
        <SessionStatusBadge status={session.status} />
      </div>

      {/* Minimap + Hero metrics side by side */}
      <div className="flex min-h-0 flex-1 basis-[220px] gap-4">
        <div className="w-1/2 shrink-0 overflow-hidden rounded-xl">
          <SessionMiniMap
            lat={session.stationSnapshot.location.lat}
            lng={session.stationSnapshot.location.lng}
            sessionId={session.id}
          />
        </div>
        <div className="flex w-1/2 items-center justify-center">
          {isBooked && <BookedHeroMetrics session={session} countdown={countdown} />}
          {isActive && <ActiveHeroMetrics session={session} liveDuration={liveDuration} />}
          {isCompleted && <CompletedHeroMetrics session={session} />}
          {isTerminal && <TerminalHeroMetrics session={session} />}
        </div>
      </div>

      {/* Info cards */}
      <div className="flex min-h-0 flex-1 basis-[220px] items-stretch gap-4">
        <div className="w-1/2">
          <InfoCard icon="ev_station" title="Charging">
            <InfoItem label="Vehicle" value={vehicleLabel} />
            <InfoItem label="Connector" value={formatConnector(session.charging.connectorUsed)} />
            <InfoItem label="Energy delivered" value={formatEnergy(session.charging.energyDeliveredKwh)} />
            <InfoItem
              label="Started"
              value={
                isActive || isCompleted
                  ? session.charging.startedAt ? formatSessionDateTime(session.charging.startedAt) : "--"
                  : "--"
              }
            />
            <BatteryBar startPercent={session.charging.socStartPercent} stopPercent={session.charging.socStopPercent} />
          </InfoCard>
        </div>

        <div className="w-1/2">
          {isActive && (
            <InfoCard icon="receipt_long" title="Pricing">
              <InfoItem label="Rate" value={formatRate(session.pricingSnapshot.priceCentsPerKwh, session.pricingSnapshot.currency)} />
              <InfoItem label="Energy cost" value={formatCurrency(session.cost.energyCents ?? 0, session.pricingSnapshot.currency)} />
              <InfoItem label="Idle fees" value={formatCurrency(session.cost.idleCents ?? 0, session.pricingSnapshot.currency)} />
              <InfoItem label="Idle rate" value={formatIdleFeePolicy(session.pricingSnapshot.idleFee, session.pricingSnapshot.currency)} />
              <InfoItem label="Booking time" value={formatSessionDateTime(session.booking.bookedAt)} />
            </InfoCard>
          )}
          {isBooked && (
            <InfoCard icon="receipt_long" title="Pricing">
              <InfoItem label="Rate" value={formatRate(session.pricingSnapshot.priceCentsPerKwh, session.pricingSnapshot.currency)} />
              <InfoItem label="Energy cost" value={formatCurrency(session.cost.energyCents ?? 0, session.pricingSnapshot.currency)} />
              <InfoItem label="Idle fees" value={formatCurrency(session.cost.idleCents ?? 0, session.pricingSnapshot.currency)} />
              <InfoItem label="Idle rate" value={formatIdleFeePolicy(session.pricingSnapshot.idleFee, session.pricingSnapshot.currency)} />
              <InfoItem label="Booking time" value={formatSessionDateTime(session.booking.bookedAt)} />
            </InfoCard>
          )}
          {isCompleted && (
            <InfoCard icon="receipt_long" title="Pricing">
              <InfoItem label="Date" value={formatSessionDate(session.createdAt)} />
              <InfoItem label="Rate" value={formatRate(session.pricingSnapshot.priceCentsPerKwh, session.pricingSnapshot.currency)} />
              <InfoItem label="Booked at" value={formatSessionDateTime(session.booking.bookedAt)} />
              <InfoItem label="Energy cost" value={formatCurrency(session.cost.energyCents, session.pricingSnapshot.currency)} />
              <InfoItem label="Idle fees" value={formatCurrency(session.cost.idleCents ?? 0, session.pricingSnapshot.currency)} />
              <InfoItem label="Idle rate" value={formatIdleFeePolicy(session.pricingSnapshot.idleFee, session.pricingSnapshot.currency)} />
            </InfoCard>
          )}
          {isTerminal && (
            <InfoCard icon="receipt_long" title="Pricing">
              <InfoItem label="Rate" value={formatRate(session.pricingSnapshot.priceCentsPerKwh, session.pricingSnapshot.currency)} />
              <InfoItem label="Idle fee" value={formatIdleFeePolicy(session.pricingSnapshot.idleFee, session.pricingSnapshot.currency)} />
              {session.booking.cancelReason && (
                <InfoItem label="Reason" value={session.booking.cancelReason} />
              )}
            </InfoCard>
          )}
        </div>
      </div>

      {/* Footer */}
      <SessionFooter session={session} onSessionChanged={onSessionChanged} />
    </section>
  );
}
