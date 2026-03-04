"use client";

import { useMemo, useEffect } from "react";
import { useQuery } from "@apollo/client/react";

import { ChargingSessionsDocument } from "@/graphql/generated/graphql";
import type { ChargingSessionsQuery } from "@/graphql/generated/graphql";

type SessionItem = ChargingSessionsQuery["chargingSessions"]["edges"][number];

const DAYS_LOOKBACK = 30;
const POLL_INTERVAL_MS = 3_000;

function getFromDateIso(): string {
  const now = new Date();
  now.setDate(now.getDate() - DAYS_LOOKBACK);
  return now.toISOString();
}

export function useActiveOrBookedSession(userId: string | null) {
  const fromDate = useMemo(() => getFromDateIso(), []);

  const { data, previousData, loading, refetch } = useQuery(
    ChargingSessionsDocument,
    {
      variables: {
        userId: userId ?? "",
        fromDate,
        limit: 20,
        cursor: null
      },
      skip: !userId,
      pollInterval: undefined
    }
  );

  const connection = data?.chargingSessions ?? previousData?.chargingSessions;
  const sessions = connection?.edges ?? [];

  const session = useMemo(() => {
    return sessions.find(
      (s): s is SessionItem =>
        s.status === "BOOKED" || s.status === "ACTIVE"
    ) ?? null;
  }, [sessions]);

  useEffect(() => {
    if (!session || !userId) return;
    const id = setInterval(refetch, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [session, userId, refetch]);

  return {
    session,
    hasActiveOrBookedSession: session !== null,
    loading,
    refetch
  };
}
