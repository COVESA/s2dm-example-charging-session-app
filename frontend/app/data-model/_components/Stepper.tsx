"use client";

import type { StepKey } from "./steps";
import { STEPS } from "./steps";

type Props = {
  active: StepKey;
  onChange: (key: StepKey) => void;
};

export function Stepper({ active, onChange }: Props) {
  const activeIdx = STEPS.findIndex((s) => s.key === active);
  const n = STEPS.length;
  /* Each step circle sits at the horizontal center of its flex-1 slot, i.e. at
     ((i + 0.5) / n) * 100% of the full width. The connecting line therefore must start
     at circle-1's center (half a slot from the left) and end at circle-N's center
     (half a slot from the right) — NOT at a fixed pixel offset (left-4/right-4), which
     caused the previous progress-width mismatch.

     Using % offsets keeps the line aligned with the circle centers at any width. */
  const halfSlotPct = 100 / n / 2;
  const progressPct =
    activeIdx <= 0 ? 0 : (activeIdx / (n - 1)) * (100 - 2 * halfSlotPct);

  return (
    /* pt-2 gives the active circle's ring-4 shadow room to render — the parent has
       overflow-x-auto which (per CSS spec) forces overflow-y to auto too, clipping the
       top shadow/ring without this padding. */
    <div className="relative overflow-x-auto pb-2 pt-2">
      <div className="relative min-w-[560px]">
        {/* Connecting line — anchored at circle-1's center and circle-N's center. */}
        <div
          className="pointer-events-none absolute top-4 h-[2px] rounded-full bg-slate-200"
          style={{ left: `${halfSlotPct}%`, right: `${halfSlotPct}%` }}
        />
        <div
          className="pointer-events-none absolute top-4 h-[2px] rounded-full bg-gradient-to-r from-violet-400 via-sky-400 to-emerald-400 transition-all duration-500"
          style={{
            left: `${halfSlotPct}%`,
            width: `${progressPct}%`
          }}
        />

        <ol className="relative flex justify-between">
          {STEPS.map((step, idx) => {
            const isActive = step.key === active;
            const isDone = idx < activeIdx;
            return (
              <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center">
                <button
                  type="button"
                  onClick={() => onChange(step.key)}
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold transition-all ${
                    isActive
                      ? "bg-emerald-500 text-white shadow-md ring-4 ring-emerald-100"
                      : isDone
                        ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-slate-300"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={step.label}
                  style={{ margin: 0, padding: 0, border: "none" }}
                >
                  {isDone ? (
                    <span className="material-symbols-outlined text-[16px]">
                      check
                    </span>
                  ) : (
                    idx + 1
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onChange(step.key)}
                  className={`mt-2 whitespace-nowrap text-[11px] font-semibold transition-colors ${
                    isActive
                      ? "text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  style={{ margin: 0, padding: 0, background: "transparent", border: "none" }}
                >
                  {step.label}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
