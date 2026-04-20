"use client";

import { useState } from "react";

import { CodeBlock } from "./CodeBlock";
import { CollectionTabs } from "./CollectionTabs";
import { ValidationPlayground } from "./ValidationPlayground";
import { ViewSwitcher } from "./ViewSwitcher";
import {
  COLLECTIONS,
  COLLECTION_SCHEMAS,
  type CollectionKey
} from "../_data/schemas";

function buildValidatorCommand(
  collection: string,
  jsonSchema: string,
  level: "strict" | "moderate",
  action: "error" | "warn"
): string {
  return `db.runCommand({
  collMod: "${collection}",
  validator: { $jsonSchema: ${jsonSchema} },
  validationLevel: "${level}",
  validationAction: "${action}"
})`;
}

type View = "schema" | "playground";

type Props = {
  initialView?: View;
};

export function DatabasePanel({ initialView = "schema" }: Props) {
  const [active, setActive] = useState<CollectionKey>("chargingStations");
  const [view, setView] = useState<View>(initialView);
  const [showCompassCommand, setShowCompassCommand] = useState(false);

  const activeMeta = COLLECTIONS.find((c) => c.key === active)!;
  const schema = COLLECTION_SCHEMAS[active];
  const compassCommand = buildValidatorCommand(
    activeMeta.label,
    schema,
    "strict",
    "error"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <ViewSwitcher
          ariaLabel="Database artifact view"
          value={view}
          onChange={setView}
          options={[
            { value: "schema", label: "JSON Schema", icon: "rule" },
            { value: "playground", label: "Playground", icon: "science" }
          ]}
        />
      </div>

      <div>
        <CollectionTabs
          collections={COLLECTIONS}
          active={active}
          onChange={setActive}
        />
      </div>

      {view === "schema" ? (
        <div className="dm-fade-in space-y-4">
          <CodeBlock
            code={schema}
            language="json"
            filename={`docs/data-model/schemas/${activeMeta.label}.json`}
            copyLabel="Copy for Compass"
            maxHeight="420px"
          />

          <div>
            <button
              type="button"
              onClick={() => setShowCompassCommand((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              style={{ margin: 0 }}
            >
              <span className="material-symbols-outlined text-[14px]">
                terminal
              </span>
              {showCompassCommand ? "Hide" : "Show"} mongosh command
            </button>

            {showCompassCommand && (
              <div className="dm-fade-in mt-3">
                <CodeBlock
                  code={compassCommand}
                  language="typescript"
                  filename="mongosh"
                  maxHeight="240px"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="dm-fade-in">
          <ValidationPlayground
            collection={active}
            onCollectionChange={setActive}
          />
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
            <span className="material-symbols-outlined text-[18px]">verified</span>
          </span>
          <div className="text-[12.5px] leading-relaxed text-amber-900">
            <p className="font-semibold">Flexible, not schema-less.</p>
            <p className="mt-1 text-amber-900/90">
              MongoDB doesn&rsquo;t require a predefined shape, but you can apply{" "}
              <code className="rounded bg-white/70 px-1 py-0.5">$jsonSchema</code>{" "}
              validators per collection to enforce as much (or as little)
              structure as you want. Pair them with{" "}
              <code className="rounded bg-white/70 px-1 py-0.5">validationLevel</code>{" "}
              and{" "}
              <code className="rounded bg-white/70 px-1 py-0.5">validationAction</code>{" "}
              to control <em>when</em> it applies and <em>what happens</em> on
              mismatch.{" "}
              <a
                href="https://www.mongodb.com/docs/manual/core/schema-validation/"
                target="_blank"
                rel="noreferrer"
                className="text-amber-900 underline decoration-amber-400 underline-offset-2 hover:text-amber-800"
              >
                Learn more
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
