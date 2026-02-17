"use client";

import { useQuery } from "@apollo/client/react";

import { HelloDocument } from "@/graphql/generated/graphql";

import { useSimulatorControls } from "../_hooks/useSimulatorControls";

export function HomeScreen() {
  const { data, loading, error, refetch } = useQuery(HelloDocument);
  const { localStatus, pending, refreshStatus, callAction } = useSimulatorControls(refetch);

  return (
    <main>
      <h1>EV Charging Demo Skeleton</h1>
      <p>This page validates frontend, GraphQL backend, and simulator connectivity.</p>
      <section>
        <h2>GraphQL Hello</h2>
        {loading && <p>Loading hello message...</p>}
        {error && <p>Failed to load GraphQL data.</p>}
        {!loading && !error && <p>{data?.hello}</p>}
        <p>Backend sees simulator as: {data?.simulationStatus ?? "unknown"}</p>
      </section>
      <section>
        <h2>Simulator Controls</h2>
        <p>Frontend sees simulator as: {localStatus}</p>
        <button disabled={pending} onClick={() => void callAction("start")} type="button">
          Start simulation
        </button>
        <button disabled={pending} onClick={() => void callAction("stop")} type="button">
          Stop simulation
        </button>
        <button disabled={pending} onClick={() => void refreshStatus()} type="button">
          Refresh simulator status
        </button>
      </section>
    </main>
  );
}
