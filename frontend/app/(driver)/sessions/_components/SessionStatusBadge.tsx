import type { SessionStatus } from "@/graphql/generated/graphql";

const STATUS_LABELS: Record<SessionStatus, string> = {
  BOOKED: "Booked",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
  NO_SHOW: "No Show",
  FAILED: "Failed"
};

const STATUS_CLASSES: Record<SessionStatus, string> = {
  BOOKED: "bg-blue-100 text-blue-800 border-blue-200",
  ACTIVE: "bg-amber-100 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELED: "bg-rose-100 text-rose-800 border-rose-200",
  NO_SHOW: "bg-rose-100 text-rose-800 border-rose-200",
  FAILED: "bg-slate-100 text-slate-800 border-slate-200"
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
