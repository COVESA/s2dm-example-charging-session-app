"use client";

import { useState } from "react";

import { CodeBlock } from "./CodeBlock";
import { ViewSwitcher } from "./ViewSwitcher";
import { config } from "@/lib/config/env";
import {
  BACKEND_TYPES_PREVIEW,
  COMPOSED_PREVIEW,
  FRONTEND_HOOKS_PREVIEW,
  SOURCE_MODULES
} from "../_data/graphqlSamples";

type View = "compose" | "codegen";

type Props = {
  initialView?: View;
};

const isGhPages = process.env.NEXT_PUBLIC_GITHUB_PAGES === "true";

export function ApplicationPanel({ initialView = "compose" }: Props) {
  const [view, setView] = useState<View>(initialView);
  const [composed, setComposed] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewSwitcher
          ariaLabel="Application artifact view"
          value={view}
          onChange={setView}
          options={[
            { value: "compose", label: "GraphQL API usage", icon: "merge" },
            {
              value: "codegen",
              label: "Schema-first codegen",
              icon: "auto_awesome"
            }
          ]}
        />
        {!isGhPages && (
          <a
            href={config.graphqlUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-2.5 text-[13px] font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
            style={{ margin: 0, border: "none", background: "transparent" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              travel_explore
            </span>
            Open GraphQL explorer
          </a>
        )}
      </div>

      {view === "compose" ? (
        <ComposeView composed={composed} onToggleCompose={setComposed} />
      ) : (
        <CodegenView />
      )}

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <span className="material-symbols-outlined text-[18px]">lightbulb</span>
          </span>
          <div className="text-[12.5px] leading-relaxed text-emerald-900">
            <p className="font-semibold">
              GraphQL for modeling — not necessarily for APIs.
            </p>
            <p className="mt-1 text-emerald-900/90">
              The conceptual model uses GraphQL SDL syntactically. In this demo the
              same artifact happens to also drive the API, so the transformation is
              GraphQL-to-GraphQL. For REST or gRPC you would generate a different
              artifact from the same model.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComposeView({
  composed,
  onToggleCompose
}: {
  composed: boolean;
  onToggleCompose: (next: boolean) => void;
}) {
  return (
    <div className="dm-fade-in">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-bold text-slate-900">
            Modules compose into a contract
          </h3>
          <p className="mt-1 text-[12.5px] text-slate-500">
            Each concept lives in its own module. A compose step merges them into
            one governed artifact.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onToggleCompose(!composed)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
            composed
              ? "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              : "border-emerald-600 bg-emerald-500 text-white hover:bg-emerald-600"
          }`}
          style={{ margin: 0 }}
        >
          <span className="material-symbols-outlined text-[16px]">
            {composed ? "undo" : "merge"}
          </span>
          {composed ? "Reset" : "Compose"}
        </button>
      </div>

      <div className="relative">
        {!composed ? (
          <div className="dm-fade-in grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SOURCE_MODULES.map((mod) => (
              <div
                key={mod.name}
                className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              >
                <div className="flex items-center gap-1.5 border-b border-slate-200 bg-white/70 px-2.5 py-1.5 text-[10.5px] font-semibold text-slate-500">
                  <span className="material-symbols-outlined text-[13px] text-slate-400">
                    description
                  </span>
                  {mod.name}
                </div>
                <pre className="overflow-auto p-2.5 font-mono text-[11px] leading-relaxed text-slate-700">
                  {mod.body}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="dm-fade-in">
            <CodeBlock
              code={COMPOSED_PREVIEW}
              language="graphql"
              filename="backend/schema/governed/composed.graphql"
              maxHeight="380px"
            />
          </div>
        )}
      </div>

      <p className="mt-3 text-[12px] text-slate-500">
        <span className="material-symbols-outlined align-middle text-[14px] text-slate-400">
          check_circle
        </span>{" "}
        The composed artifact is the contract: versioned, reviewable, shipped
        alongside the app.
      </p>
    </div>
  );
}

function CodegenView() {
  return (
    <div className="dm-fade-in">
      <div className="mb-3">
        <h3 className="text-[14px] font-bold text-slate-900">
          Schema-first drives codegen
        </h3>
        <p className="mt-1 text-[12.5px] text-slate-500">
          The same artifact generates typed resolvers on the backend and query
          hooks on the frontend. Drift becomes a compile error.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
            <span className="material-symbols-outlined text-[13px]">dns</span>
            Backend types
          </div>
          <CodeBlock
            code={BACKEND_TYPES_PREVIEW}
            language="typescript"
            filename="backend/src/graphql/generated/graphql.ts"
            maxHeight="380px"
          />
        </div>
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200">
            <span className="material-symbols-outlined text-[13px]">phonelink</span>
            Frontend hooks
          </div>
          <CodeBlock
            code={FRONTEND_HOOKS_PREVIEW}
            language="typescript"
            filename="frontend/src/graphql/generated/graphql.ts"
            maxHeight="380px"
          />
        </div>
      </div>

      <p className="mt-3 text-[12px] text-slate-500">
        <span className="material-symbols-outlined align-middle text-[14px] text-slate-400">
          autorenew
        </span>{" "}
        Generated with <code>@graphql-codegen/typescript</code> (backend) and{" "}
        <code>@graphql-codegen/client-preset</code> (frontend).
      </p>
    </div>
  );
}
