"use client";

import { useQuery } from "@apollo/client/react";
import { ModelEvolutionValidationDocument } from "@/graphql/generated/graphql";
import { CodeBlock } from "./CodeBlock";
import {
  ADAPTATION_PAYLOADS,
  ADAPTATION_PIPELINE,
  MODL_DECISIONS,
  MONGODB_VIEW_PIPELINE
} from "../_data/chargingSessionEvolution";

const PAYLOADS = [
  {
    label: "Raw v6",
    filename: "incoming/session.v6.json",
    code: ADAPTATION_PAYLOADS.rawV6
  },
  {
    label: "Raw v7",
    filename: "incoming/session.v7.json",
    code: ADAPTATION_PAYLOADS.rawV7
  },
  {
    label: "Canonical v7",
    filename: "canonical/session.v7.json",
    code: ADAPTATION_PAYLOADS.canonicalV7
  }
] as const;

export function AdaptationWalkthrough() {
  const isStatic = process.env.NEXT_PUBLIC_GITHUB_PAGES === "true";
  const { data } = useQuery(ModelEvolutionValidationDocument, {
    skip: isStatic,
    fetchPolicy: "cache-and-network"
  });
  const live = data?.modelEvolutionValidation;

  return (
    <div className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/30 p-4">
      <header>
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-violet-700">
          Compact adaptation walkthrough
        </div>
        <h4 className="mt-0.5 text-[13px] font-bold text-slate-900">
          Two released shapes, one validated v7 contract
        </h4>
        <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">
          Release metadata selects the source contract. Raw v7 already matches the
          canonical representation; raw v6 follows the ledger-backed steps below.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {PAYLOADS.map((payload, index) => (
          <div key={payload.label}>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-600">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 font-mono text-[9px] text-violet-700">
                {index + 1}
              </span>
              {payload.label}
            </div>
            <CodeBlock
              code={payload.code}
              language="json"
              filename={payload.filename}
              maxHeight="230px"
            />
          </div>
        ))}
      </div>

      <div>
        <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          ModL decisions
        </h5>
        <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
          {MODL_DECISIONS.map((item) => (
            <div
              key={item.change}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="font-mono text-[11px] font-semibold text-slate-900">
                {item.change}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                {item.decision}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9.5px] font-semibold text-violet-700">
                  {item.category}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
                    item.lossiness === "none"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  lossiness: {item.lossiness}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <h5 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            MongoDB canonical view pipeline
          </h5>
          <CodeBlock
            code={MONGODB_VIEW_PIPELINE}
            language="json"
            filename="chargingSessions-canonical-view.pipeline.json"
            maxHeight="320px"
          />
        </div>
        <div>
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {live ? "Live database evidence" : "Static conference fixture"}
          </h5>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            {live
              ? live.versionCounts
                  .map(({ version, count }) => `v${version}: ${count}`)
                  .join(" · ")
              : "When connected to the demo backend, this panel reports effective version counts and raw/projected samples."}
          </p>
          <CodeBlock
            code={live?.projectedV7Json ?? ADAPTATION_PAYLOADS.canonicalV7}
            language="json"
            filename={live ? "live/projected-v7.json" : "static/projected-v7.json"}
            maxHeight="280px"
          />
        </div>
      </div>

      <div>
        <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Documented pipeline
        </h5>
        <ol className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {ADAPTATION_PIPELINE.map((step, index) => (
            <li
              key={step}
              className="flex gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-[11px] leading-relaxed text-slate-600"
            >
              <span className="font-mono font-bold text-violet-500">
                {String(index + 1).padStart(2, "0")}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
