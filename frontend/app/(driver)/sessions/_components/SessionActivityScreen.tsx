"use client";

import { useMemo, useState } from "react";

import { useUserContext } from "@/contexts/UserContext";
import { useChargingSessionsQuery } from "../_hooks/useChargingSessionsQuery";
import { SessionDetail } from "./SessionDetail";
import { SessionList } from "./SessionList";

export function SessionActivityScreen() {
  const { selectedUser } = useUserContext();
  const [explicitSelectedSessionId, setExplicitSelectedSessionId] = useState<string | null>(null);

  const { sessions, loading, loadingMore, error, hasNextPage, loadMore } =
    useChargingSessionsQuery(selectedUser?.id ?? null);

  const selectedSessionId = useMemo(() => {
    if (!explicitSelectedSessionId) {
      return sessions[0]?.id ?? null;
    }
    const stillExists = sessions.some((session) => session.id === explicitSelectedSessionId);
    return stillExists ? explicitSelectedSessionId : sessions[0]?.id ?? null;
  }, [sessions, explicitSelectedSessionId]);

  const selectedSession = useMemo(() => {
    if (sessions.length === 0) {
      return null;
    }
    return sessions.find((session) => session.id === selectedSessionId) ?? sessions[0];
  }, [sessions, selectedSessionId]);

  if (!selectedUser) {
    return (
      <main className="flex h-full items-center justify-center">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">Session Activity</h1>
          <p className="text-sm text-slate-600">
            Select a user first to view assigned charging sessions.
          </p>
        </div>
      </main>
    );
  }

  if (loading && sessions.length === 0) {
    return (
      <main className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-600">Loading session activity...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex h-full items-center justify-center">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load sessions. Please try again.
        </div>
      </main>
    );
  }

  if (sessions.length === 0) {
    return (
      <main className="flex h-full items-center justify-center">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">No sessions found</h1>
          <p className="text-sm text-slate-600">
            {selectedUser.displayName} has no sessions in the last 30 days.
          </p>
        </div>
      </main>
    );
  }

  if (!selectedSession) {
    return null;
  }

  return (
    <main className="h-full w-full bg-slate-50 p-4">
      <div className="flex h-full min-h-0 gap-4">
        <SessionDetail session={selectedSession} />
        <SessionList
          sessions={sessions}
          selectedSessionId={selectedSession.id}
          onSelect={setExplicitSelectedSessionId}
          hasNextPage={hasNextPage}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      </div>
    </main>
  );
}
