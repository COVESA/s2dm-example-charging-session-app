"use client";

import { useMemo } from "react";
import { useQuery } from "@apollo/client/react";

import { ChargingSessionsDocument } from "@/graphql/generated/graphql";
import type { ChargingSessionsQuery } from "@/graphql/generated/graphql";

const PAGE_SIZE = 10;
const DAYS_LOOKBACK = 30;

function getFromDateIso(): string {
  const now = new Date();
  now.setDate(now.getDate() - DAYS_LOOKBACK);
  return now.toISOString();
}

export function useChargingSessionsQuery(userId: string | null) {
  const fromDate = useMemo(() => getFromDateIso(), []);

  const { data, previousData, loading, error, refetch, fetchMore } = useQuery(
    ChargingSessionsDocument,
    {
      variables: {
        userId: userId ?? "",
        fromDate,
        limit: PAGE_SIZE,
        cursor: null
      },
      skip: !userId
    }
  );

  const connection = data?.chargingSessions ?? previousData?.chargingSessions;
  const sessions = connection?.edges ?? [];
  const visibleSessions = sessions;
  const canLoadMore = Boolean(userId) && Boolean(connection?.hasNextPage) && !loading;

  const loadMore = async () => {
    if (!canLoadMore || !connection?.endCursor) {
      return;
    }

    await fetchMore({
      variables: {
        userId: userId!,
        fromDate,
        limit: PAGE_SIZE,
        cursor: connection.endCursor
      },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult) {
          return previous;
        }

        const mergedEdges = [
          ...previous.chargingSessions.edges,
          ...fetchMoreResult.chargingSessions.edges
        ];
        const uniqueById = new Map<string, ChargingSessionsQuery["chargingSessions"]["edges"][number]>();
        for (const edge of mergedEdges) {
          uniqueById.set(edge.id, edge);
        }

        return {
          chargingSessions: {
            __typename: fetchMoreResult.chargingSessions.__typename,
            edges: Array.from(uniqueById.values()),
            hasNextPage: fetchMoreResult.chargingSessions.hasNextPage,
            endCursor: fetchMoreResult.chargingSessions.endCursor
          }
        };
      }
    });
  };

  return {
    sessions: visibleSessions,
    hasNextPage: connection?.hasNextPage ?? false,
    endCursor: connection?.endCursor ?? null,
    loading,
    loadingMore: loading && visibleSessions.length > 0,
    error,
    refetch,
    loadMore
  };
}
