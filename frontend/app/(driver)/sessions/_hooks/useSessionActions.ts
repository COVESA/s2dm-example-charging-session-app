"use client";

import { useState, useCallback } from "react";
import { useMutation } from "@apollo/client/react";
import {
  StartChargingSessionDocument,
  CancelChargingSessionDocument,
  CompleteChargingSessionDocument
} from "@/graphql/generated/graphql";

interface UseSessionActionsOptions {
  sessionId: string;
  isBooked: boolean;
}

export function useSessionActions({ sessionId, isBooked }: UseSessionActionsOptions) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startChargingMutation] = useMutation(StartChargingSessionDocument, {
    refetchQueries: "active"
  });
  const [cancelChargingMutation] = useMutation(CancelChargingSessionDocument, {
    refetchQueries: "active"
  });
  const [completeChargingMutation] = useMutation(CompleteChargingSessionDocument, {
    refetchQueries: "active"
  });

  const startCharging = useCallback(async () => {
    if (!isBooked || isUpdating) return;
    setError(null);
    setIsUpdating(true);
    try {
      const result = await startChargingMutation({ variables: { input: { sessionId } } });
      return result.data?.startChargingSession.session ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start charging");
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, [isBooked, isUpdating, sessionId, startChargingMutation]);

  const cancelReservation = useCallback(async () => {
    if (!isBooked || isUpdating) return;
    setError(null);
    setIsUpdating(true);
    try {
      const result = await cancelChargingMutation({ variables: { input: { sessionId } } });
      return result.data?.cancelChargingSession.session ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel reservation");
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, [isBooked, isUpdating, sessionId, cancelChargingMutation]);

  const stopCharging = useCallback(async () => {
    if (isBooked || isUpdating) return;
    setError(null);
    setIsUpdating(true);
    try {
      const result = await completeChargingMutation({ variables: { input: { sessionId } } });
      return result.data?.completeChargingSession.session ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop charging");
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, [isBooked, isUpdating, sessionId, completeChargingMutation]);

  return { startCharging, cancelReservation, stopCharging, isUpdating, error };
}
