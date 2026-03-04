import type { UIEvent } from "react";
import type { ChargingSessionsQuery } from "@/graphql/generated/graphql";
import type { SessionStatus } from "@/graphql/generated/graphql";
import { SessionStatusBadge } from "./SessionStatusBadge";
import { formatCurrency, formatEnergy, formatSessionDateTime } from "./formatters";

const STATUS_LEFT_BORDER: Record<SessionStatus, string> = {
  BOOKED: "border-l-blue-400",
  ACTIVE: "border-l-amber-400",
  COMPLETED: "border-l-emerald-400",
  CANCELED: "border-l-rose-400",
  NO_SHOW: "border-l-rose-400",
  FAILED: "border-l-slate-400"
};

type SessionItem = ChargingSessionsQuery["chargingSessions"]["edges"][number];

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
    <aside className="h-full w-full max-w-md border-l border-slate-200 bg-white/80 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Recent Sessions</h2>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
          onScroll={handleScroll}
        >
          <div className="flex flex-col gap-3">
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
                  className={`cursor-pointer rounded-xl border border-l-2 p-3 transition-all ${STATUS_LEFT_BORDER[session.status]} ${
                    isSelected
                      ? "border-blue-200 bg-blue-50/60 shadow-sm"
                      : "border-slate-200 bg-white shadow-none hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                  }`}
                  aria-label={`Open details for session ${session.id}`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <SessionStatusBadge status={session.status} />
                    <span className="text-xs text-slate-500">
                      {formatSessionDateTime(session.createdAt)}
                    </span>
                  </div>

                  <h3 className="truncate text-sm font-semibold text-slate-900">
                    {session.stationSnapshot.name}
                  </h3>
                  <p className="mb-3 truncate text-xs text-slate-500">
                    {session.stationSnapshot.chargingPointLabel} · {session.stationSnapshot.addressShort}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">Total Cost</p>
                      <p className="font-semibold text-slate-800">
                        {formatCurrency(
                          session.cost.totalCents,
                          session.pricingSnapshot.currency ?? "EUR"
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Energy</p>
                      <p className="font-semibold text-slate-800">
                        {formatEnergy(session.charging.energyDeliveredKwh)}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}

            {loadingMore ? (
              <p className="px-1 py-2 text-xs text-slate-500">Loading more sessions...</p>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
