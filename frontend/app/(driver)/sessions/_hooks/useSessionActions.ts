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
  onSuccess?: () => Promise<unknown> | unknown;
}

export function useSessionActions({ sessionId, isBooked, onSuccess }: UseSessionActionsOptions) {
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
      await startChargingMutation({ variables: { input: { sessionId } } });
      await onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start charging");
    } finally {
      setIsUpdating(false);
    }
  }, [isBooked, isUpdating, sessionId, startChargingMutation, onSuccess]);

  const cancelReservation = useCallback(async () => {
    if (!isBooked || isUpdating) return;
    setError(null);
    setIsUpdating(true);
    try {
      await cancelChargingMutation({ variables: { input: { sessionId } } });
      await onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel reservation");
    } finally {
      setIsUpdating(false);
    }
  }, [isBooked, isUpdating, sessionId, cancelChargingMutation, onSuccess]);

  const stopCharging = useCallback(async () => {
    if (isBooked || isUpdating) return;
    setError(null);
    setIsUpdating(true);
    try {
      await completeChargingMutation({ variables: { input: { sessionId } } });
      await onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop charging");
    } finally {
      setIsUpdating(false);
    }
  }, [isBooked, isUpdating, sessionId, completeChargingMutation, onSuccess]);

  return { startCharging, cancelReservation, stopCharging, isUpdating, error };
}
