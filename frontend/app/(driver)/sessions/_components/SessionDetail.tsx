import { useState, useEffect } from "react";
import type { ChargingSessionsQuery } from "@/graphql/generated/graphql";
import { SessionStatusBadge } from "./SessionStatusBadge";
import {
  formatCurrency,
  formatEnergy,
  formatSessionDateTime,
  formatSessionDate,
  formatDuration,
  formatConnector,
  formatSocRange,
  formatRate
} from "./formatters";

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
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
    <div className="flex items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        <span className={`material-symbols-outlined text-lg ${iconColor}`}>{icon}</span>
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function BookedHero({ session, countdown }: { session: SessionItem; countdown: string }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4">
      <HeroMetric
        icon="timer"
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        label="Time Remaining"
        value={countdown}
      />
      <HeroMetric
        icon="bolt"
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
        label="Rate"
        value={formatRate(session.pricingSnapshot.priceCentsPerKwh, session.pricingSnapshot.currency)}
      />
    </div>
  );
}

function ActiveHero({ session, liveDuration }: { session: SessionItem; liveDuration: string }) {
  return (
    <div className="mb-6 grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4">
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
    </div>
  );
}

function CompletedHero({ session }: { session: SessionItem }) {
  return (
    <div className="mb-6 grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4">
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
    </div>
  );
}

function TerminalHero({ session }: { session: SessionItem }) {
  return (
    <div className="mb-6 rounded-lg bg-slate-50 p-4">
      <HeroMetric
        icon="event"
        iconBg="bg-slate-200"
        iconColor="text-slate-600"
        label="Date"
        value={formatSessionDate(session.createdAt)}
      />
    </div>
  );
}

function BookedInfo({ session }: { session: SessionItem }) {
  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-4">
      <InfoRow label="Booked at" value={formatSessionDateTime(session.booking.bookedAt)} />
      <InfoRow label="Expires at" value={formatSessionDateTime(session.booking.expiresAt)} />
      <InfoRow label="Connector" value={formatConnector(session.charging.connectorUsed)} />
    </div>
  );
}

function ActiveInfo({ session }: { session: SessionItem }) {
  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-4">
      <InfoRow
        label="Started"
        value={session.charging.startedAt ? formatSessionDateTime(session.charging.startedAt) : "--"}
      />
      <InfoRow label="Connector" value={formatConnector(session.charging.connectorUsed)} />
      <InfoRow
        label="Battery"
        value={formatSocRange(session.charging.socStartPercent, session.charging.socStopPercent)}
      />
      <InfoRow
        label="Rate"
        value={formatRate(session.pricingSnapshot.priceCentsPerKwh, session.pricingSnapshot.currency)}
      />
    </div>
  );
}

function CompletedInfo({ session }: { session: SessionItem }) {
  const hasIdleFees = (session.cost.idleCents ?? 0) > 0;

  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-4">
      <InfoRow label="Date" value={formatSessionDate(session.createdAt)} />
      <InfoRow label="Connector" value={formatConnector(session.charging.connectorUsed)} />
      <InfoRow
        label="Battery"
        value={formatSocRange(session.charging.socStartPercent, session.charging.socStopPercent)}
      />
      <InfoRow
        label="Rate"
        value={formatRate(session.pricingSnapshot.priceCentsPerKwh, session.pricingSnapshot.currency)}
      />
      {hasIdleFees && (
        <>
          <InfoRow
            label="Energy cost"
            value={formatCurrency(session.cost.energyCents, session.pricingSnapshot.currency)}
          />
          <InfoRow
            label="Idle fees"
            value={formatCurrency(session.cost.idleCents, session.pricingSnapshot.currency)}
          />
        </>
      )}
    </div>
  );
}

function TerminalInfo({ session }: { session: SessionItem }) {
  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-4">
      <InfoRow label="Booked at" value={formatSessionDateTime(session.booking.bookedAt)} />
      {session.booking.cancelReason && (
        <InfoRow label="Reason" value={session.booking.cancelReason} />
      )}
    </div>
  );
}

export function SessionDetail({ session }: { session: SessionItem }) {
  const isBooked = session.status === "BOOKED";
  const isActive = session.status === "ACTIVE";
  const isCompleted = session.status === "COMPLETED";
  const isTerminal = session.status === "CANCELED" || session.status === "NO_SHOW" || session.status === "FAILED";

  const countdown = useCountdown(session.booking.expiresAt, isBooked);
  const liveDuration = useLiveDuration(session.charging.startedAt, isActive);

  return (
    <section className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <span className="material-symbols-outlined text-xl text-slate-600">ev_station</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{session.stationSnapshot.name}</h2>
            <p className="text-sm text-slate-500">
              {session.stationSnapshot.chargingPointLabel} · {session.stationSnapshot.addressShort}
            </p>
          </div>
        </div>
        <SessionStatusBadge status={session.status} />
      </div>

      {isBooked && <BookedHero session={session} countdown={countdown} />}
      {isActive && <ActiveHero session={session} liveDuration={liveDuration} />}
      {isCompleted && <CompletedHero session={session} />}
      {isTerminal && <TerminalHero session={session} />}

      {isBooked && <BookedInfo session={session} />}
      {isActive && <ActiveInfo session={session} />}
      {isCompleted && <CompletedInfo session={session} />}
      {isTerminal && <TerminalInfo session={session} />}

      <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
        <span className="material-symbols-outlined text-sm">directions_car</span>
        <span>
          {session.vehicleSnapshot.make} {session.vehicleSnapshot.model} · VIN ...{session.vehicleSnapshot.vinLast6}
        </span>
      </div>
    </section>
  );
}
