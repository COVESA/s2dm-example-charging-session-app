"use client";

import { useCallback, useEffect, useState } from "react";

import { config } from "@/lib/config/env";

const simulatorBaseUrl = config.simulatorUrl;

export type SimulatorStatus = "running" | "stopped" | "unknown";

export function useSimulatorControls() {
  const [status, setStatus] = useState<SimulatorStatus>("unknown");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${simulatorBaseUrl}/status`);
      if (!res.ok) {
        setStatus("unknown");
        return;
      }
      const { running } = (await res.json()) as { running: boolean };
      setStatus(running ? "running" : "stopped");
    } catch {
      setStatus("unknown");
    }
  }, []);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 10_000);
    return () => clearTimeout(id);
  }, [error]);

  const toggle = useCallback(async () => {
    setError(null);
    setPending(true);
    try {
      const action = status === "running" ? "stop" : "start";
      const res = await fetch(`${simulatorBaseUrl}/${action}`, {
        method: "POST"
      });
      if (!res.ok) {
        const msg =
          action === "start"
            ? "Failed to start simulation"
            : "Failed to stop simulation";
        setError(msg);
        return;
      }
      await refreshStatus();
    } catch {
      setError(
        status === "running"
          ? "Failed to stop simulation"
          : "Failed to start simulation"
      );
    } finally {
      setPending(false);
    }
  }, [status, refreshStatus]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  return { status, pending, error, toggle };
}
