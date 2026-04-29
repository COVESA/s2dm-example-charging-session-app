"use client";

import { useState } from "react";
import { Modal } from "@/ui/Modal";

import { IncidentSeverity } from "@/graphql/generated/graphql";

const SEVERITY_OPTIONS: Array<{
  value: IncidentSeverity;
  label: string;
  helpText: string;
}> = [
  {
    value: IncidentSeverity.Low,
    label: "Low",
    helpText: "Minor inconvenience or cosmetic issue."
  },
  {
    value: IncidentSeverity.Medium,
    label: "Medium",
    helpText: ""
  },
  {
    value: IncidentSeverity.High,
    label: "High",
    helpText: "Charging was disrupted or the point felt unsafe to use."
  },
  {
    value: IncidentSeverity.Critical,
    label: "Critical",
    helpText: "Immediate safety or hardware risk."
  }
];

type ReportIncidentModalProps = {
  onSubmit: (input: {
    severity: IncidentSeverity;
    description: string;
  }) => Promise<unknown> | unknown;
  onDismiss: () => void;
  isSubmitting?: boolean;
  error?: string | null;
};

export function ReportIncidentModal({
  onSubmit,
  onDismiss,
  isSubmitting,
  error
}: ReportIncidentModalProps) {
  const [severity, setSeverity] = useState<IncidentSeverity>(IncidentSeverity.Medium);
  const [description, setDescription] = useState("");
  const isDescriptionValid = description.trim().length > 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ severity, description });
  };

  return (
    <Modal isOpen={true} onClose={onDismiss} titleId="report-incident-dialog-title" maxWidth="lg">
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="px-6 pt-6">
          <div className="flex items-start justify-between">
            <div className="h-8 w-8 shrink-0" aria-hidden="true" />
            <button
              type="button"
              onClick={onDismiss}
              disabled={isSubmitting}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
              aria-label="Close"
              style={{ margin: 0, padding: 0, border: "none" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
          <div className="mt-1 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
              <span className="material-symbols-outlined text-3xl text-amber-500">flag</span>
            </div>
            <div className="mt-4">
              <h2
                id="report-incident-dialog-title"
                className="text-[17px] font-bold text-slate-900"
              >
                Report an Issue
              </h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Share what happened during this charging session. The incident will be sent to the back office for review.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-5">
          <div className="space-y-2">
            <label
              htmlFor="report-incident-severity"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400"
            >
              Severity
            </label>
            <select
              id="report-incident-severity"
              value={severity}
              onChange={(event) => setSeverity(event.target.value as IncidentSeverity)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
            >
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {SEVERITY_OPTIONS.find((o) => o.value === severity)?.helpText && (
              <p className="text-xs text-slate-500">
                {SEVERITY_OPTIONS.find((o) => o.value === severity)?.helpText}
              </p>
            )}
          </div>

          <div className="mt-5">
            <label
              htmlFor="report-incident-description"
              className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400"
            >
              Description
            </label>
            <textarea
              id="report-incident-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the problem you noticed, what you tried, and whether charging was affected."
              rows={5}
              maxLength={1000}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
            />
            <div className="mt-2 flex justify-end text-xs text-slate-500">
              <span>{description.length}/1000</span>
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-[13px] text-rose-600">
              <span
                className="material-symbols-outlined mt-0.5 shrink-0"
                style={{ fontSize: 16 }}
              >
                error
              </span>
              {error}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row-reverse">
            <div className="w-full sm:flex-1">
              <button
                type="submit"
                disabled={isSubmitting || !isDescriptionValid}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ margin: 0 }}
              >
                <span className="material-symbols-outlined text-xl">flag</span>
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              disabled={isSubmitting}
              className="w-full rounded-2xl px-4 py-3 text-[14px] font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 sm:w-auto sm:min-w-[120px]"
              style={{ margin: 0, border: "none", background: "transparent" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
