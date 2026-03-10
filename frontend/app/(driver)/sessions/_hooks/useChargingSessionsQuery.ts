"use client";

import { NetworkStatus } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useCallback, useEffect, useState } from "react";

import { ChargingSessionsDocument } from "@/graphql/generated/graphql";
import type { ChargingSessionsQuery } from "@/graphql/generated/graphql";

const PAGE_SIZE = 15;
const POLL_INTERVAL_MS = 3_000;

function mergeUniqueSessions(
  currentEdges: ChargingSessionsQuery["chargingSessions"]["edges"],
  nextEdges: ChargingSessionsQuery["chargingSessions"]["edges"]
) {
  const uniqueById = new Map<string, ChargingSessionsQuery["chargingSessions"]["edges"][number]>();

  for (const edge of currentEdges) {
    uniqueById.set(edge.id, edge);
  }

  for (const edge of nextEdges) {
    uniqueById.set(edge.id, edge);
  }

  return Array.from(uniqueById.values());
}

export function useChargingSessionsQuery(userId: string | null) {
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data, previousData, loading, error, refetch, fetchMore, networkStatus } = useQuery(
    ChargingSessionsDocument,
    {
      variables: {
        userId: userId ?? "",
        limit: PAGE_SIZE,
        cursor: null
      },
      skip: !userId,
      notifyOnNetworkStatusChange: true
    }
  );

  const connection = data?.chargingSessions ?? previousData?.chargingSessions;
  const sessions = connection?.edges ?? [];
  const visibleSessions = sessions;
  const loadedCount = visibleSessions.length > 0 ? visibleSessions.length : PAGE_SIZE;
  const canLoadMore =
    Boolean(userId) &&
    Boolean(connection?.hasNextPage) &&
    !loading &&
    !isLoadingMore;
  const hasLiveSession = visibleSessions.some(
    (session) => session.status === "BOOKED" || session.status === "ACTIVE"
  );

  const refreshLoadedSessions = useCallback(async () => {
    if (!userId) {
      return;
    }

    await refetch({
      userId,
      limit: loadedCount,
      cursor: null
    });
  }, [loadedCount, refetch, userId]);

  useEffect(() => {
    if (!userId || !hasLiveSession) {
      return;
    }

    const id = setInterval(() => {
      void refreshLoadedSessions();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [userId, hasLiveSession, refreshLoadedSessions]);

  useEffect(() => {
    setIsLoadingMore(false);
  }, [userId]);

  const loadMore = async () => {
    if (!canLoadMore || !connection?.endCursor) {
      return;
    }

    setIsLoadingMore(true);
    await fetchMore({
      variables: {
        userId: userId!,
        limit: PAGE_SIZE,
        cursor: connection.endCursor
      },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult) {
          return previous;
        }

        return {
          chargingSessions: {
            __typename: fetchMoreResult.chargingSessions.__typename,
            edges: mergeUniqueSessions(
              previous.chargingSessions.edges,
              fetchMoreResult.chargingSessions.edges
            ),
            hasNextPage: fetchMoreResult.chargingSessions.hasNextPage,
            endCursor: fetchMoreResult.chargingSessions.endCursor
          }
        };
      }
    }).finally(() => {
      setIsLoadingMore(false);
    });
  };

  return {
    sessions: visibleSessions,
    hasNextPage: connection?.hasNextPage ?? false,
    endCursor: connection?.endCursor ?? null,
    loading,
    loadingMore:
      isLoadingMore || networkStatus === NetworkStatus.fetchMore,
    error,
    refetch: refreshLoadedSessions,
    loadMore
  };
}
