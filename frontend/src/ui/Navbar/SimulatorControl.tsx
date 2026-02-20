"use client";

import type { SimulatorStatus } from "@/hooks/useSimulatorControls";

type SimulatorControlProps = {
  status: SimulatorStatus;
  pending: boolean;
  error: string | null;
  onToggle: () => void;
};

const STATUS_LABELS: Record<SimulatorStatus, string> = {
  running: "Simulation running",
  stopped: "Simulation stopped",
  unknown: "Unknown"
};

export function SimulatorControl({
  status,
  pending,
  error,
  onToggle
}: SimulatorControlProps) {
  const isRunning = status === "running";
  const buttonLabel = isRunning ? "Stop" : "Start";

  const statusText = error ? `Error: ${error}` : STATUS_LABELS[status];
  const statusColor = error ? "text-red-600" : "text-slate-700";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        error
          ? "border-red-200 bg-red-50 hover:bg-red-100"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
      aria-label={`${buttonLabel} simulation. ${statusText}`}
      title={error ? `Error: ${error}` : undefined}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          isRunning ? "bg-green-500" : "bg-slate-300"
        }`}
        style={
          isRunning
            ? {
                animation: "sim-blink 1.5s ease-in-out infinite"
              }
            : undefined
        }
        aria-hidden
      />
      <span className={`min-w-0 truncate max-w-[140px] ${statusColor}`}>
        {statusText}
      </span>
      <span className="shrink-0 text-slate-400">·</span>
      <span className="shrink-0 font-medium text-slate-900">
        {pending ? "…" : buttonLabel}
      </span>
    </button>
  );
}
