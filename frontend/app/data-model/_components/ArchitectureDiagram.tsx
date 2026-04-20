"use client";

import type { StepKey } from "./steps";

export type NodeKey =
  | "s2dm"
  | "graphql"
  | "json"
  | "backend"
  | "mongo"
  | "drivers"
  | "ops"
  | "infotainment";

type HighlightMap = Partial<Record<NodeKey, boolean>>;

type Props = {
  step: StepKey;
  versionBadge?: string | null;
  onOpen: (node: NodeKey) => void;
  onOpenEvolution?: () => void;
};

function activeFor(step: StepKey): HighlightMap {
  switch (step) {
    case "conceptual":
      return { s2dm: true };
    case "artifacts":
      return { s2dm: true, graphql: true, json: true };
    case "application":
      return {
        graphql: true,
        backend: true
      };
    case "database":
      return { json: true, mongo: true };
    case "evolution":
      return {
        s2dm: true,
        graphql: true,
        json: true,
        backend: true,
        mongo: true,
        drivers: true,
        ops: true,
        infotainment: true
      };
    default:
      return {};
  }
}

type NodeTone = "violet" | "sky" | "amber" | "emerald" | "slate";

const TONE: Record<
  NodeTone,
  {
    bg: string;
    border: string;
    text: string;
    icon: string;
  }
> = {
  violet: {
    bg: "bg-violet-50",
    border: "border-violet-300",
    text: "text-violet-900",
    icon: "bg-violet-500 text-white"
  },
  sky: {
    bg: "bg-sky-50",
    border: "border-sky-300",
    text: "text-sky-900",
    icon: "bg-sky-500 text-white"
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-900",
    icon: "bg-amber-500 text-white"
  },
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    text: "text-emerald-900",
    icon: "bg-emerald-500 text-white"
  },
  slate: {
    bg: "bg-white",
    border: "border-slate-300",
    text: "text-slate-800",
    icon: "bg-slate-800 text-white"
  }
};

type DiagramNodeProps = {
  icon: string;
  label: string;
  sub?: string;
  tone: NodeTone;
  active: boolean;
  onClick?: () => void;
  clickable?: boolean;
  size?: "md" | "sm";
};

function DiagramNode({
  icon,
  label,
  sub,
  tone,
  active,
  onClick,
  clickable = true,
  size = "md"
}: DiagramNodeProps) {
  const t = TONE[tone];
  const isClickable = clickable && !!onClick;
  const common = `group relative flex w-full items-center gap-2.5 rounded-xl border text-left transition-all duration-200 ${
    size === "sm" ? "px-2.5 py-1.5" : "px-3 py-2.5"
  } ${t.bg} ${t.border} ${
    active ? `shadow-sm opacity-100` : "opacity-45 shadow-none"
  } ${isClickable ? "cursor-pointer hover:-translate-y-0.5 hover:opacity-100 hover:shadow-md" : ""}`;

  const content = (
    <>
      <span
        className={`flex ${size === "sm" ? "h-6 w-6" : "h-8 w-8"} shrink-0 items-center justify-center rounded-lg ${t.icon}`}
      >
        <span
          className={`material-symbols-outlined ${size === "sm" ? "text-[13px]" : "text-[16px]"}`}
        >
          {icon}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={`truncate ${size === "sm" ? "text-[11px]" : "text-[12.5px]"} font-semibold ${t.text}`}
        >
          {label}
        </span>
        {sub ? (
          <span className="truncate text-[10px] text-slate-500">{sub}</span>
        ) : null}
      </span>
      {isClickable ? (
        <span
          className="material-symbols-outlined pointer-events-none shrink-0 leading-none text-slate-400 opacity-0 transition-opacity group-hover:opacity-100"
          style={{ fontSize: 13, width: 13, height: 13 }}
          aria-hidden
        >
          open_in_new
        </span>
      ) : null}
    </>
  );

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={common}
        style={{ margin: 0 }}
      >
        {content}
      </button>
    );
  }
  return <div className={common}>{content}</div>;
}

/** Compact consumer app indicator: an icon tile with a short label underneath.
    Smaller footprint than DiagramNode, used for the downstream apps row. */
function AppIcon({
  icon,
  label,
  active
}: {
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1 transition-opacity duration-200 ${
        active ? "opacity-100" : "opacity-45"
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl border bg-white shadow-sm ${
          active ? "border-slate-300" : "border-slate-200"
        }`}
      >
        <span className="material-symbols-outlined text-[20px] text-slate-700">
          {icon}
        </span>
      </span>
      <span className="whitespace-nowrap text-[10.5px] font-semibold text-slate-600">
        {label}
      </span>
    </div>
  );
}

type HLineProps = {
  label?: string;
  active: boolean;
  /** Flow direction for the traveling dot. "forward" = left→right, "reverse" = right→left, "both" = bidirectional. */
  flow?: "forward" | "reverse" | "both";
};

/** Horizontal line with a traveling dot (no arrow head). The label floats above the line
    using absolute positioning so the line itself remains vertically centered in its slot. */
function HLine({ label, active, flow = "forward" }: HLineProps) {
  const line = active ? "bg-emerald-500" : "bg-slate-300";
  const dot = active ? "bg-emerald-500" : "bg-transparent";
  const dotAnim =
    flow === "reverse"
      ? "dm-flow-dot-rev"
      : flow === "both"
        ? "dm-flow-dot-bi"
        : "dm-flow-dot";

  return (
    <div className="relative flex h-full w-full items-center px-1">
      <div className={`relative h-[2px] w-full ${line}`}>
        {label ? (
          <span
            className={`absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9.5px] font-semibold uppercase tracking-wider ${
              active ? "text-emerald-700" : "text-slate-400"
            }`}
          >
            {label}
          </span>
        ) : null}
        {active ? (
          <span
            className={`${dotAnim} absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${dot}`}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Vertical line with a traveling dot. Supports forward (down), reverse (up), or bidirectional. */
function VLine({
  active,
  flow = "forward"
}: {
  active: boolean;
  flow?: "forward" | "reverse" | "both";
}) {
  const line = active ? "bg-emerald-500" : "bg-slate-300";
  const dot = active ? "bg-emerald-500" : "bg-transparent";
  const dotAnim =
    flow === "reverse"
      ? "dm-flow-dot-v"
      : flow === "both"
        ? "dm-flow-dot-v-bi"
        : "dm-flow-dot-v-fwd";

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className={`relative h-full min-h-[20px] w-[2px] ${line}`}>
        {active ? (
          <span
            className={`${dotAnim} absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${dot}`}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Fan of 3 lines from Backend (bottom-center) to 3 app targets (top at 1/6, 3/6, 5/6).
    Lines are SVG (stretched to fill the container via preserveAspectRatio="none").
    Dots are plain HTML spans positioned via CSS keyframes — this guarantees they stay perfectly
    round regardless of the container's aspect ratio (the SVG-based animateMotion approach
    distorted dots into ellipses because the viewBox was stretched). */
function BackendToAppsFan({ active }: { active: boolean }) {
  const stroke = active ? "#10b981" /* emerald-500 */ : "#cbd5e1" /* slate-300 */;
  const vbWidth = 1000;
  const vbHeight = 40;
  /* Source is bottom-center; targets at 1/6, 3/6, 5/6 to align with the 3 evenly-spaced apps. */
  const sourceX = vbWidth / 2;
  const targets = [vbWidth / 6, vbWidth / 2, (5 * vbWidth) / 6];
  const dotClasses = ["dm-fan-dot-left", "dm-fan-dot-mid", "dm-fan-dot-right"];
  const dotColor = active ? "bg-emerald-500" : "bg-transparent";

  return (
    <div className="relative h-full w-full">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {targets.map((x, i) => (
          <line
            key={`bf-app-${i}`}
            x1={sourceX}
            y1={vbHeight}
            x2={x}
            y2="0"
            stroke={stroke}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {active ? (
        <div className="pointer-events-none absolute inset-0">
          {dotClasses.map((cls) => (
            <span
              key={cls}
              className={`absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${dotColor} ${cls}`}
              aria-hidden
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ArchitectureDiagram({
  step,
  versionBadge,
  onOpen,
  onOpenEvolution
}: Props) {
  const hi = activeFor(step);
  const evolutionMode = step === "evolution";
  const consumersActive =
    !!hi.drivers || !!hi.ops || !!hi.infotainment;
  const backendMongoActive = !!hi.backend && !!hi.mongo;

  /* Column template for the outer grid.
     5 columns: S2DM | HLine | Artifacts | HLines | Stack (apps+backend+mongo). */
  const columns =
    "minmax(0, 1.1fr) minmax(32px, 0.4fr) minmax(0, 1.3fr) minmax(32px, 0.4fr) minmax(0, 1.2fr)";

  /* Row heights for the 6-row layout.
     Row 1: apps row (consumers).
     Row 2: fan connector / top padding for artifacts wrapper (44px).
     Row 3: first artifact + backend.
     Row 4: vertical connector between the two artifacts / between backend & mongo (20px).
     Row 5: second artifact + mongo.
     Row 6: bottom padding for artifacts wrapper (44px, matches row 2). */
  const rows = "auto 44px auto 20px auto 44px";

  return (
    <div className="flex h-full w-full max-w-[1040px] flex-col items-stretch justify-center">
      <div
        className="relative grid w-full items-stretch gap-x-1.5"
        style={{ gridTemplateColumns: columns, gridTemplateRows: rows }}
      >
        {/* Col 1 · S2DM — spans rows 2-6 so its vertical center matches the Artifacts wrapper
            (which also spans rows 2-6). The "New release" badge hangs below the card via absolute
            positioning so it doesn't shift the card's centering. */}
        <div
          className="relative flex items-center"
          style={{ gridColumn: 1, gridRow: "2 / 7" }}
        >
          <div className="relative w-full">
            <DiagramNode
              icon="hub"
              label="EV Charging Model"
              sub="COVESA S2DM"
              tone="violet"
              active={!!hi.s2dm}
              onClick={() => onOpen("s2dm")}
            />
            {evolutionMode && onOpenEvolution ? (
              <button
                type="button"
                onClick={onOpenEvolution}
                className="dm-fade-in group absolute left-1/2 top-full inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-violet-300 bg-white px-2.5 py-1 text-[10.5px] font-semibold text-violet-700 shadow-sm transition-colors hover:border-violet-400 hover:bg-violet-50"
                style={{ marginTop: 16, marginRight: 0, marginLeft: 0, marginBottom: 0 }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-violet-400 opacity-60" />
                  <span className="relative h-2 w-2 rounded-full bg-violet-500" />
                </span>
                New release {versionBadge ? `· ${versionBadge}` : ""}
                <span className="material-symbols-outlined text-[13px] text-violet-400 transition-colors group-hover:text-violet-600">
                  open_in_new
                </span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Col 2 · Line S2DM → Artifacts (spans rows 2-6, centered — matches S2DM and Artifacts) */}
        <div
          className="flex items-center"
          style={{ gridColumn: 2, gridRow: "2 / 7" }}
        >
          <HLine
            label="generates"
            active={!!hi.s2dm && (!!hi.graphql || !!hi.json)}
          />
        </div>

        {/* Col 3 · Artifacts — dashed wrapper spans rows 2-6 so there is equal vertical space
            above the first artifact card (row 3) and below the second (row 5). Top padding = row 2
            (44px); bottom padding = row 6 (44px). The two inner cards sit in rows 3 and 5 which
            mirrors Backend (row 3) and MongoDB (row 5) for horizontal alignment. */}
        <div
          className="pointer-events-none relative"
          style={{ gridColumn: 3, gridRow: "2 / 7" }}
        >
          <div className="absolute inset-0 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50" />
          <div className="absolute -top-2 left-4 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-500 ring-1 ring-slate-200">
            <span className="material-symbols-outlined text-[11px]">extension</span>
            Artifacts
          </div>
        </div>
        <div
          className="flex items-center justify-center px-4"
          style={{ gridColumn: 3, gridRow: 3 }}
        >
          <div className="w-[92%]">
            <DiagramNode
              icon="schema"
              label="GraphQL Schema"
              sub="Application artifact"
              tone="sky"
              active={!!hi.graphql}
              onClick={() => onOpen("graphql")}
            />
          </div>
        </div>
        <div
          className="flex items-center justify-center px-4"
          style={{ gridColumn: 3, gridRow: 5 }}
        >
          <div className="w-[92%]">
            <DiagramNode
              icon="rule"
              label="JSON Schemas"
              sub="Database artifact"
              tone="sky"
              active={!!hi.json}
              onClick={() => onOpen("json")}
            />
          </div>
        </div>

        {/* Col 4 · Two horizontal connectors placed at r3 (composed→backend) and r5 (json→mongo).
            Extended symmetrically via negative x margin so the lines reach the edges of the
            equally-sized cards on both sides (all 4 cards in cols 3 & 5 are 92% wide, centered). */}
        <div
          className="-mx-2 flex items-center"
          style={{ gridColumn: 4, gridRow: 3 }}
        >
          <HLine label="defines" active={!!hi.graphql && !!hi.backend} />
        </div>
        <div
          className="-mx-2 flex items-center"
          style={{ gridColumn: 4, gridRow: 5 }}
        >
          <HLine label="validates" active={!!hi.json && !!hi.mongo} />
        </div>

        {/* Apps row · compact icons (not cards) so the downstream apps are visually lightweight
            and the whole diagram fits within col 5 without horizontal overflow. Three evenly-spaced
            items sit on the same x-center as the Backend/MongoDB column below. */}
        <div
          className="flex items-end justify-around gap-2 px-1"
          style={{ gridColumn: 5, gridRow: 1 }}
        >
          <AppIcon icon="smartphone" label="Driver app" active={!!hi.drivers} />
          <AppIcon icon="dashboard" label="Operations" active={!!hi.ops} />
          <AppIcon
            icon="directions_car"
            label="Infotainment"
            active={!!hi.infotainment}
          />
        </div>

        {/* Fan connectors · kept within col 5 so they don't push the diagram beyond its container.
            Source sits at 50% (center) since both apps row and Backend are centered on col 5. */}
        <div
          style={{ gridColumn: 5, gridRow: 2 }}
          className="relative px-1"
        >
          <BackendToAppsFan active={consumersActive} />
        </div>

        {/* Backend · 92% wide (matches composed.graphql/JSON Schemas) so the "defines" line
            reaches the card edge with a minimal, consistent gap equal to the "generates" line. */}
        <div
          className="flex items-center justify-center"
          style={{ gridColumn: 5, gridRow: 3 }}
        >
          <div className="w-[92%]">
            <DiagramNode
              icon="dns"
              label="Backend API"
              sub="GraphQL resolvers"
              tone="amber"
              active={!!hi.backend}
              onClick={() => onOpen("backend")}
            />
          </div>
        </div>

        {/* Backend ↔ MongoDB connector (bidirectional flow) */}
        <div
          className="flex items-center justify-center"
          style={{ gridColumn: 5, gridRow: 4 }}
        >
          <VLine active={backendMongoActive} flow="both" />
        </div>

        {/* MongoDB · same width as Backend card so "validates" line reaches the card edge. */}
        <div
          className="flex items-center justify-center"
          style={{ gridColumn: 5, gridRow: 5 }}
        >
          <div className="w-[92%]">
            <DiagramNode
              icon="database"
              label="MongoDB"
              sub="Validated collections"
              tone="emerald"
              active={!!hi.mongo}
              onClick={() => onOpen("mongo")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
