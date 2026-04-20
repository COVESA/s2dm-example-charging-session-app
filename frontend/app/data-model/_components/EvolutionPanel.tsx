"use client";

import { CodeBlock } from "./CodeBlock";
import {
  ROLLOUT_STEPS,
  VERSIONS,
  type VersionKey
} from "../_data/evolutionVersions";

type Props = {
  active: VersionKey;
  onChange: (key: VersionKey) => void;
};

export function EvolutionPanel({ active, onChange }: Props) {
  const version = VERSIONS.find((v) => v.key === active) ?? VERSIONS[0];
  const activeIdx = VERSIONS.findIndex((v) => v.key === active);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              Model version
            </div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-mono text-[18px] font-bold text-slate-900">
                {version.label}
              </span>
              <span className="text-[12.5px] font-semibold text-slate-700">
                · {version.title}
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] text-slate-500">{version.tagline}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                onChange(VERSIONS[Math.max(0, activeIdx - 1)].key)
              }
              disabled={activeIdx === 0}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous version"
              style={{ margin: 0, padding: 0 }}
            >
              <span className="material-symbols-outlined text-[18px]">
                chevron_left
              </span>
            </button>

            <div className="relative flex-1 min-w-[220px] max-w-[320px]">
              <input
                type="range"
                min={0}
                max={VERSIONS.length - 1}
                step={1}
                value={activeIdx}
                onChange={(e) =>
                  onChange(VERSIONS[Number(e.target.value)].key)
                }
                className="dm-slider w-full"
                aria-label="Model version slider"
              />
              <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-400">
                {VERSIONS.map((v) => (
                  <span
                    key={v.key}
                    className={v.key === active ? "text-emerald-700" : ""}
                  >
                    {v.label}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onChange(
                  VERSIONS[Math.min(VERSIONS.length - 1, activeIdx + 1)].key
                )
              }
              disabled={activeIdx === VERSIONS.length - 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next version"
              style={{ margin: 0, padding: 0 }}
            >
              <span className="material-symbols-outlined text-[18px]">
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="dm-fade-in rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4" key={`app-${version.key}`}>
          <header className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white">
              <span className="material-symbols-outlined text-[16px]">bolt</span>
            </span>
            <h4 className="text-[13px] font-bold text-slate-900">
              Application impact
            </h4>
          </header>
          <CodeBlock
            code={version.appGraphql}
            language="graphql"
            filename={`governed/${version.key}/composed.graphql`}
            maxHeight="260px"
          />
          <ul className="mt-3 space-y-1.5">
            {version.appNarrative.map((line, idx) => (
              <li
                key={idx}
                className="flex gap-1.5 text-[11.5px] leading-relaxed text-slate-700"
              >
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                {line}
              </li>
            ))}
          </ul>
          {(version.highlightsAdded.length > 0 ||
            version.highlightsDeprecated.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {version.highlightsAdded.map((h) => (
                <span
                  key={`a-${h}`}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800"
                >
                  <span className="material-symbols-outlined text-[12px]">
                    add
                  </span>
                  {h}
                </span>
              ))}
              {version.highlightsDeprecated.map((h) => (
                <span
                  key={`d-${h}`}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-semibold text-rose-800 line-through"
                >
                  <span className="material-symbols-outlined text-[12px] no-underline">
                    history
                  </span>
                  {h}
                </span>
              ))}
            </div>
          )}
        </div>

        <div
          className="dm-fade-in rounded-2xl border border-amber-200 bg-amber-50/40 p-4"
          key={`db-${version.key}`}
        >
          <header className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white">
              <span className="material-symbols-outlined text-[16px]">
                database
              </span>
            </span>
            <h4 className="text-[13px] font-bold text-slate-900">Database impact</h4>
          </header>
          <CodeBlock
            code={version.dbJsonSchema}
            language="json"
            filename={`schemas/${version.key}/chargingStations.json`}
            maxHeight="260px"
          />
          <ul className="mt-3 space-y-1.5">
            {version.dbNarrative.map((line, idx) => (
              <li
                key={idx}
                className="flex gap-1.5 text-[11.5px] leading-relaxed text-slate-700"
              >
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-[13px] font-bold text-slate-900">
          Rollout playbook
        </h4>
        <p className="mt-0.5 text-[11.5px] text-slate-500">
          How evolved artifacts reach production without breaking consumers.
        </p>
        <ol className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-4">
          {ROLLOUT_STEPS.map((step) => (
            <li
              key={step.step}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="font-mono text-[11px] font-bold text-slate-400">
                {step.step}
              </div>
              <div className="mt-0.5 text-[12.5px] font-semibold text-slate-900">
                {step.title}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
