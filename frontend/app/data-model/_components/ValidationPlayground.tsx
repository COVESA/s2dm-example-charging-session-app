"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CodeBlock } from "./CodeBlock";
import { COLLECTIONS, type CollectionKey } from "../_data/schemas";
import { VALIDATION_EXAMPLES } from "../_data/validationExamples";

type Level = "strict" | "moderate";
type Action = "error" | "warn";

type Props = {
  collection: CollectionKey;
  onCollectionChange?: (next: CollectionKey) => void;
};

type FlatSample = {
  collection: CollectionKey;
  idx: number;
};

const FLAT_SAMPLES: FlatSample[] = COLLECTIONS.flatMap((c) =>
  (VALIDATION_EXAMPLES[c.key] ?? []).map((_, idx) => ({
    collection: c.key,
    idx
  }))
);

type Outcome = {
  status: "rejected" | "written-with-warning" | "accepted";
  headline: string;
  detail: string;
};

function computeOutcome(
  valid: boolean,
  level: Level,
  action: Action,
  // Assume documents are inserts (the typical write path). Moderate only affects
  // existing documents being *updated*, so the effect on inserts is identical
  // to strict. We surface this nuance in the narration.
  isUpdateOfPreExisting = false
): Outcome {
  if (valid) {
    return {
      status: "accepted",
      headline: "Accepted",
      detail:
        "The document matches the validator. Written normally; no side effects."
    };
  }

  const validationSkipped =
    level === "moderate" && isUpdateOfPreExisting;

  if (validationSkipped) {
    return {
      status: "written-with-warning",
      headline: "Written (legacy doc, moderate level)",
      detail:
        "Moderate only enforces on inserts and on updates of documents that already matched. This legacy document is updated without validation."
    };
  }

  if (action === "warn") {
    return {
      status: "written-with-warning",
      headline: "Written + warning logged",
      detail:
        "validationAction: warn writes the document and emits a warning to the server log. Good for soft rollouts."
    };
  }

  return {
    status: "rejected",
    headline: "Rejected",
    detail:
      "validationAction: error refuses the write; the client gets a WriteError and no document is persisted."
  };
}

const LEVEL_COPY: Record<Level, string> = {
  strict: "All inserts and updates are validated (default, safest).",
  moderate:
    "Updates to documents that never matched skip validation — safe for legacy data."
};

const ACTION_COPY: Record<Action, string> = {
  error: "Invalid writes are rejected with a WriteError.",
  warn: "Invalid writes are accepted; a warning is logged on the server."
};

export function ValidationPlayground({
  collection,
  onCollectionChange
}: Props) {
  const [level, setLevel] = useState<Level>("strict");
  const [action, setAction] = useState<Action>("error");
  const [activeIdx, setActiveIdx] = useState(0);
  const [prevCollection, setPrevCollection] = useState(collection);
  if (prevCollection !== collection) {
    setPrevCollection(collection);
    setActiveIdx(0);
  }

  const cases = VALIDATION_EXAMPLES[collection];
  const safeIdx = Math.min(activeIdx, cases.length - 1);
  const activeCase = cases[safeIdx];

  const flatPos = useMemo(() => {
    const found = FLAT_SAMPLES.findIndex(
      (s) => s.collection === collection && s.idx === safeIdx
    );
    return found >= 0 ? found : 0;
  }, [collection, safeIdx]);

  const goTo = (delta: number) => {
    const total = FLAT_SAMPLES.length;
    const next = (flatPos + delta + total) % total;
    const target = FLAT_SAMPLES[next];
    if (target.collection !== collection) {
      onCollectionChange?.(target.collection);
      setActiveIdx(target.idx);
    } else {
      setActiveIdx(target.idx);
    }
  };

  const outcome = useMemo(
    () => computeOutcome(activeCase.valid, level, action),
    [activeCase.valid, level, action]
  );

  const badgeClass =
    outcome.status === "accepted"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : outcome.status === "written-with-warning"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-rose-50 text-rose-700 ring-rose-200";

  const badgeIcon =
    outcome.status === "accepted"
      ? "check_circle"
      : outcome.status === "written-with-warning"
        ? "warning"
        : "block";

  const candidateToolbar = (
    <SampleStepper
      position={flatPos + 1}
      total={FLAT_SAMPLES.length}
      onPrev={() => goTo(-1)}
      onNext={() => goTo(1)}
    />
  );

  return (
    <div className="space-y-4">
      {/* Document + outcome */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CodeBlock
            code={activeCase.document}
            language="json"
            maxHeight="420px"
            headerExtra={candidateToolbar}
          />
        </div>

        <div className="lg:col-span-2 space-y-3">
          {/* Validator config — level + action as 50/50 rich dropdowns */}
          <div className="grid grid-cols-2 gap-2">
            <RichDropdown
              label="level"
              ariaLabel="validationLevel"
              value={level}
              onChange={(v) => setLevel(v as Level)}
              options={[
                {
                  value: "strict",
                  label: "strict",
                  description: LEVEL_COPY.strict
                },
                {
                  value: "moderate",
                  label: "moderate",
                  description: LEVEL_COPY.moderate
                }
              ]}
            />
            <RichDropdown
              label="action"
              ariaLabel="validationAction"
              value={action}
              onChange={(v) => setAction(v as Action)}
              options={[
                {
                  value: "error",
                  label: "error",
                  description: ACTION_COPY.error
                },
                {
                  value: "warn",
                  label: "warn",
                  description: ACTION_COPY.warn
                }
              ]}
            />
          </div>

          <div
            className={`rounded-xl p-4 ring-1 ${badgeClass} dm-fade-in`}
            key={`${collection}-${safeIdx}-${level}-${action}`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">
                {badgeIcon}
              </span>
              <span className="text-[13px] font-bold uppercase tracking-wider">
                {outcome.headline}
              </span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-700">
              {outcome.detail}
            </p>
          </div>

          {!activeCase.valid && activeCase.errors && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-rose-700">
                validator errors
              </div>
              <ul className="mt-1.5 space-y-1">
                {activeCase.errors.map((err, idx) => (
                  <li
                    key={idx}
                    className="flex gap-1.5 font-mono text-[11.5px] leading-snug text-rose-800"
                  >
                    <span className="text-rose-400">→</span>
                    <span>{err}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-3 text-[12px] leading-relaxed text-slate-600">
            {activeCase.explanation}
          </div>
        </div>
      </div>
    </div>
  );
}

type SampleStepperProps = {
  position: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
};

function SampleStepper({
  position,
  total,
  onPrev,
  onNext
}: SampleStepperProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-0.5 py-0.5 shadow-sm">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous sample"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        style={{ margin: 0, padding: 0, border: "none" }}
      >
        <span className="material-symbols-outlined text-[16px]">
          chevron_left
        </span>
      </button>
      <span
        aria-live="polite"
        className="px-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-slate-500"
      >
        sample {position}/{total}
      </span>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next sample"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        style={{ margin: 0, padding: 0, border: "none" }}
      >
        <span className="material-symbols-outlined text-[16px]">
          chevron_right
        </span>
      </button>
    </div>
  );
}

type RichOption = { value: string; label: string; description: string };

type RichDropdownProps = {
  value: string;
  onChange: (v: string) => void;
  options: RichOption[];
  ariaLabel: string;
  label: string;
};

function RichDropdown({
  value,
  onChange,
  options,
  ariaLabel,
  label
}: RichDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const active = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-sm transition-colors hover:border-slate-300"
        style={{ margin: 0 }}
      >
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </span>
          <span className="truncate text-[12px] font-semibold text-slate-900">
            {active.label}
          </span>
        </span>
        <span
          aria-hidden
          className={`material-symbols-outlined shrink-0 text-[16px] text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="dm-fade-in absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "bg-slate-50"
                      : "bg-white hover:bg-slate-50"
                  }`}
                  style={{ margin: 0, border: "none", borderRadius: 0 }}
                >
                  <span
                    className={`material-symbols-outlined mt-0.5 text-[16px] ${
                      isActive ? "text-emerald-600" : "text-transparent"
                    }`}
                    aria-hidden
                  >
                    check
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[12.5px] font-semibold text-slate-900">
                      {opt.label}
                    </span>
                    <span className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
                      {opt.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
