"use client";

import { CodeBlock } from "./CodeBlock";

const CONCEPT_EXAMPLE = `# A conceptual model, written in SDL.
# It captures meaning — not endpoints, not tables.

"""
A physical site that offers one or more charging points.
"""
type ChargingStation {
  id: ID!
  name: String!
  address: Address!
  chargingPoints: [ChargingPoint!]!
}

"""
A single connector at a charging station.
"""
type ChargingPoint {
  id: ID!
  connectorType: ConnectorType!
  powerKw: Float!
  status: PointStatus!
}

enum ConnectorType { CCS2 CHADEMO TYPE2 NACS }
enum PointStatus  { AVAILABLE OCCUPIED OUT_OF_SERVICE }
`;

export function ConceptualPanel() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Trait
          icon="translate"
          title="Shared vocabulary"
          body="Entities, fields, and enums defined once, in a language domain experts can read."
        />
        <Trait
          icon="link_off"
          title="Runtime-agnostic"
          body="No assumptions about REST, GraphQL, SQL, MongoDB — only the concepts."
        />
        <Trait
          icon="handshake"
          title="Producer ↔ consumer contract"
          body="Every downstream system can trust the same meaning of ‘charging session’ or ‘energy delivered’."
        />
      </div>

      <CodeBlock
        code={CONCEPT_EXAMPLE}
        language="graphql"
        filename="conceptual-model.graphql"
      />

      <div className="rounded-xl border border-violet-200 bg-violet-50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500 text-white">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          </span>
          <div className="text-[12.5px] leading-relaxed text-violet-900">
            <p className="font-semibold">From descriptive to prescriptive</p>
            <p className="mt-1 text-violet-800/90">
              The conceptual model is <em>descriptive</em>: it says what things mean.
              Generators turn it into <em>prescriptive</em> artifacts — a composed
              GraphQL schema for the application layer, and JSON Schemas for the
              database layer. Pick what each system needs; reject the rest.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Trait({
  icon,
  title,
  body
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </span>
        <div>
          <p className="text-[12.5px] font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-600">{body}</p>
        </div>
      </div>
    </div>
  );
}
