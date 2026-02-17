"use client";

import { useCallback, useState } from "react";

import { config } from "@/lib/config/env";

const simulatorBaseUrl = config.simulatorUrl;

type SimulatorStatus = "running" | "stopped" | "unknown";

export function useSimulatorControls(refetch?: () => void) {
  const [localStatus, setLocalStatus] = useState<SimulatorStatus>("unknown");
  const [pending, setPending] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch(`${simulatorBaseUrl}/status`);
      if (!res.ok) {
        setLocalStatus("unknown");
        return;
      }
      const { running } = (await res.json()) as { running: boolean };
      setLocalStatus(running ? "running" : "stopped");
    } catch {
      setLocalStatus("unknown");
    }
  }, []);

  const callAction = useCallback(
    async (action: "start" | "stop") => {
      setPending(true);
      try {
        await fetch(`${simulatorBaseUrl}/${action}`, { method: "POST" });
        await Promise.all([refreshStatus(), refetch?.()]);
      } finally {
        setPending(false);
      }
    },
    [refreshStatus, refetch]
  );

  return { localStatus, pending, refreshStatus, callAction };
}
