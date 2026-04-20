export type StepKey =
  | "conceptual"
  | "artifacts"
  | "application"
  | "database"
  | "evolution";

export type Step = {
  key: StepKey;
  label: string;
  title: string;
  narrative: string;
};

export const STEPS: Step[] = [
  {
    key: "conceptual",
    label: "Conceptual",
    title: "A shared conceptual model",
    narrative:
      "Domain experts capture meaning once — entities, fields, relationships — using GraphQL SDL. This is descriptive, runtime-agnostic, and acts as a contract between producers and consumers of data."
  },
  {
    key: "artifacts",
    label: "Artifacts",
    title: "From descriptive to prescriptive",
    narrative:
      "The conceptual model generates implementation-ready artifacts. Two of them drive this demo: a composed GraphQL schema for the API, and JSON Schemas for MongoDB validation."
  },
  {
    key: "application",
    label: "Application",
    title: "Artifacts drive the application layer",
    narrative:
      "The composed GraphQL schema defines the Backend API and fuels schema-first codegen: typed resolvers on the backend, typed hooks and fragments on each consumer app."
  },
  {
    key: "database",
    label: "Database",
    title: "Artifacts drive the database layer",
    narrative:
      "MongoDB's flexible schema stays flexible — but $jsonSchema validators apply the generated JSON Schemas selectively. Enforcement level and action are choices, not assumptions."
  },
  {
    key: "evolution",
    label: "Evolution",
    title: "Schema evolution, one source of truth",
    narrative:
      "A new release of the conceptual model regenerates both artifacts. Open the new release tag below the model to scrub through versions and see the ripple through the app and the database."
  }
];
