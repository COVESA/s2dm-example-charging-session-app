"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { ApplicationPanel } from "./ApplicationPanel";
import { ArchitectureDiagram, type NodeKey } from "./ArchitectureDiagram";
import { ConceptualPanel } from "./ConceptualPanel";
import { DatabasePanel } from "./DatabasePanel";
import { DetailModal } from "./DetailModal";
import { EvolutionPanel } from "./EvolutionPanel";
import { STEPS, type StepKey } from "./steps";
import { Stepper } from "./Stepper";
import type { VersionKey } from "../_data/evolutionVersions";

type ModalKind =
  | "conceptual"
  | "graphql"
  | "backend"
  | "json"
  | "mongo"
  | "evolution";

const MODAL_META: Record<
  ModalKind,
  { title: string; subtitle: string; icon: string; accent: string }
> = {
  conceptual: {
    title: "EV Charging Conceptual Model",
    subtitle: "COVESA Simplified Semantic Data Model (S2DM).",
    icon: "hub",
    accent: "bg-violet-100 text-violet-700"
  },
  graphql: {
    title: "Artifact: GraphQL Schema",
    subtitle:
      "The composed GraphQL schema is the application-layer contract and fuels schema-first codegen for backend and frontend.",
    icon: "schema",
    accent: "bg-sky-100 text-sky-700"
  },
  backend: {
    title: "Backend API",
    subtitle:
      "Typed resolvers and frontend hooks are generated from the same GraphQL artifact — drift becomes a compile error.",
    icon: "dns",
    accent: "bg-amber-100 text-amber-700"
  },
  json: {
    title: "Artifact: JSON Schemas",
    subtitle:
      "JSON Schemas are the database-layer artifact — one per collection, ready to be applied as $jsonSchema validators.",
    icon: "rule",
    accent: "bg-sky-100 text-sky-700"
  },
  mongo: {
    title: "MongoDB",
    subtitle:
      "Validators are applied to each collection. You control the level and the action, and can test writes in the playground.",
    icon: "database",
    accent: "bg-emerald-100 text-emerald-700"
  },
  evolution: {
    title: "Schema evolution through versions",
    subtitle:
      "Scrub the timeline to see how a new release ripples from the conceptual model into both artifacts.",
    icon: "timeline",
    accent: "bg-violet-100 text-violet-700"
  }
};

function nodeToModal(node: NodeKey): ModalKind | null {
  switch (node) {
    case "s2dm":
      return "conceptual";
    case "graphql":
      return "graphql";
    case "backend":
      return "backend";
    case "json":
      return "json";
    case "mongo":
      return "mongo";
    default:
      return null;
  }
}

export function DataModelExplorer() {
  const [step, setStep] = useState<StepKey>("conceptual");
  const [version, setVersion] = useState<VersionKey>("v4");
  const [modal, setModal] = useState<ModalKind | null>(null);

  const activeStep = STEPS.find((s) => s.key === step) ?? STEPS[0];
  const stepIdx = STEPS.findIndex((s) => s.key === step);

  const openForNode = useCallback((node: NodeKey) => {
    const kind = nodeToModal(node);
    if (kind) setModal(kind);
  }, []);

  const goPrev = () => {
    if (stepIdx > 0) setStep(STEPS[stepIdx - 1].key);
  };
  const goNext = () => {
    if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1].key);
  };

  return (
    <main className="mx-auto flex h-full w-full max-w-6xl flex-col px-5 py-5 sm:px-6 sm:py-6">
      <section className="relative flex h-full min-h-0 flex-col rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Top row: title (left) · back link (right) */}
        <header className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-7">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 md:text-2xl">
              Data Model Explorer
            </h1>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-slate-600">
              One conceptual model, two artifacts, many systems it keeps in sync.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 no-underline transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to demo
          </Link>
        </header>

        {/* Stepper */}
        <div className="px-6 pt-5 sm:px-8 sm:pt-6">
          <Stepper active={step} onChange={setStep} />
        </div>

        {/* Narrative — compact */}
        <div
          key={activeStep.key}
          className="dm-fade-in mt-4 px-6 sm:px-8"
        >
          <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">
            <span className="inline-flex h-4 items-center rounded-full bg-emerald-100 px-1.5 font-bold">
              Step {stepIdx + 1} / {STEPS.length}
            </span>
            <span className="text-slate-500">· {activeStep.label}</span>
          </div>

          <h2 className="mt-1 text-[16px] font-bold text-slate-900">
            {activeStep.title}
          </h2>
          <p className="mt-0.5 max-w-3xl text-[12.5px] leading-relaxed text-slate-600">
            {activeStep.narrative}
          </p>
        </div>

        {/* Diagram — fills remaining space */}
        <div className="mt-2 flex min-h-0 flex-1 items-stretch px-6 sm:px-8">
          <div className="flex h-full w-full items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-5 py-1">
            <ArchitectureDiagram
              step={step}
              versionBadge={version}
              onOpen={openForNode}
              onOpenEvolution={() => setModal("evolution")}
            />
          </div>
        </div>

        {/* Prev / Next */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={goPrev}
            disabled={stepIdx === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ margin: 0 }}
          >
            <span className="material-symbols-outlined text-[16px]">
              chevron_left
            </span>
            Previous
          </button>
          <div className="flex items-center gap-1 text-[11px]">
            {STEPS.map((s, i) => (
              <span
                key={s.key}
                aria-hidden
                className={`inline-block h-1.5 rounded-full transition-all ${
                  i === stepIdx
                    ? "w-5 bg-emerald-500"
                    : i < stepIdx
                      ? "w-1.5 bg-emerald-300"
                      : "w-1.5 bg-slate-200"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={goNext}
            disabled={stepIdx === STEPS.length - 1}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ margin: 0, border: "none" }}
          >
            Next
            <span className="material-symbols-outlined text-[16px]">
              chevron_right
            </span>
          </button>
        </div>
      </section>

      {/* Modals */}
      <DetailModal
        isOpen={modal === "conceptual"}
        onClose={() => setModal(null)}
        title={MODAL_META.conceptual.title}
        subtitle={MODAL_META.conceptual.subtitle}
        icon={MODAL_META.conceptual.icon}
        accent={MODAL_META.conceptual.accent}
      >
        <ConceptualPanel />
      </DetailModal>

      <DetailModal
        isOpen={modal === "graphql"}
        onClose={() => setModal(null)}
        title={MODAL_META.graphql.title}
        subtitle={MODAL_META.graphql.subtitle}
        icon={MODAL_META.graphql.icon}
        accent={MODAL_META.graphql.accent}
      >
        <ApplicationPanel initialView="compose" />
      </DetailModal>

      <DetailModal
        isOpen={modal === "backend"}
        onClose={() => setModal(null)}
        title={MODAL_META.backend.title}
        subtitle={MODAL_META.backend.subtitle}
        icon={MODAL_META.backend.icon}
        accent={MODAL_META.backend.accent}
      >
        <ApplicationPanel initialView="codegen" />
      </DetailModal>

      <DetailModal
        isOpen={modal === "json"}
        onClose={() => setModal(null)}
        title={MODAL_META.json.title}
        subtitle={MODAL_META.json.subtitle}
        icon={MODAL_META.json.icon}
        accent={MODAL_META.json.accent}
      >
        <DatabasePanel initialView="schema" />
      </DetailModal>

      <DetailModal
        isOpen={modal === "mongo"}
        onClose={() => setModal(null)}
        title={MODAL_META.mongo.title}
        subtitle={MODAL_META.mongo.subtitle}
        icon={MODAL_META.mongo.icon}
        accent={MODAL_META.mongo.accent}
      >
        <DatabasePanel initialView="playground" />
      </DetailModal>

      <DetailModal
        isOpen={modal === "evolution"}
        onClose={() => setModal(null)}
        title={MODAL_META.evolution.title}
        subtitle={MODAL_META.evolution.subtitle}
        icon={MODAL_META.evolution.icon}
        accent={MODAL_META.evolution.accent}
      >
        <EvolutionPanel active={version} onChange={setVersion} />
      </DetailModal>
    </main>
  );
}
