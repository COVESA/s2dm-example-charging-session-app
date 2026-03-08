"use client";

import { useState, useEffect } from "react";
import type { UIEvent } from "react";
import type { ChargingSessionsQuery } from "@/graphql/generated/graphql";
import type { SessionStatus } from "@/graphql/generated/graphql";
import { SessionStatusBadge } from "./SessionStatusBadge";
import {
  formatCurrency,
  formatEnergy,
  formatSessionDateTime
} from "./formatters";

type SessionItem = ChargingSessionsQuery["chargingSessions"]["edges"][number];

const STATUS_ACCENT: Record<SessionStatus, string> = {
  BOOKED: "border-l-blue-400",
  ACTIVE: "border-l-amber-400",
  COMPLETED: "border-l-emerald-400",
  CANCELED: "border-l-rose-300",
  NO_SHOW: "border-l-rose-300",
  FAILED: "border-l-slate-300"
};

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

function Metric({ icon, value }: { icon: string; value: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>{icon}</span>
      <span className="font-semibold text-slate-700">{value}</span>
    </span>
  );
}

function CardMetrics({ session }: { session: SessionItem }) {
  const isBooked = session.status === "BOOKED";

  const countdown = useCountdown(session.booking.expiresAt, isBooked);

  if (isBooked) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <span className="material-symbols-outlined text-blue-400" style={{ fontSize: 14 }}>timer</span>
        <span className="font-semibold text-blue-600">{countdown} remaining</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <Metric icon="payments" value={formatCurrency(session.cost.totalCents, session.pricingSnapshot.currency)} />
      <Metric icon="bolt" value={formatEnergy(session.charging.energyDeliveredKwh)} />
    </div>
  );
}

type SessionListProps = {
  sessions: SessionItem[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
  hasNextPage: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
};

export function SessionList({
  sessions,
  selectedSessionId,
  onSelect,
  hasNextPage,
  loadingMore,
  onLoadMore
}: SessionListProps) {
  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasNextPage || loadingMore) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 24;
    if (isNearBottom) {
      onLoadMore();
    }
  };

  return (
    <aside className="flex h-full w-full max-w-sm flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-800">Recent Sessions</h2>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-3"
        onScroll={handleScroll}
      >
        <div className="flex flex-col gap-2">
          {sessions.map((session) => {
            const isSelected = session.id === selectedSessionId;

            return (
              <article
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(session.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(session.id);
                  }
                }}
                className={`cursor-pointer rounded-xl border-l-[3px] p-3 shadow-[0_1px_4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] transition-all ${STATUS_ACCENT[session.status]} ${
                  isSelected
                    ? "bg-slate-50 shadow-[0_1px_4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.05)]"
                    : "bg-white hover:bg-slate-50/50 hover:shadow-[0_2px_8px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.04)]"
                }`}
                aria-label={`Open details for session ${session.id}`}
              >
                {/* Row 1: status badge + date */}
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <SessionStatusBadge status={session.status} />
                    {session.status === "ACTIVE" && (
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-[pulse_2s_ease-in-out_infinite]" />
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {formatSessionDateTime(session.createdAt)}
                  </span>
                </div>

                {/* Row 2: address */}
                <p className="mb-2 truncate text-[12px] text-slate-400">
                  {session.stationSnapshot.chargingPointLabel} · {session.stationSnapshot.addressShort}
                </p>

                {/* Row 4: metrics */}
                <CardMetrics session={session} />
              </article>
            );
          })}

          {loadingMore ? (
            <p className="px-1 py-2 text-xs text-slate-500">Loading more sessions...</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
