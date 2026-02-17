"use client";

import { useQuery } from "@apollo/client/react";

import { HelloDocument } from "@/graphql/generated/graphql";

import { useSimulatorControls } from "../_hooks/useSimulatorControls";

export function MapScreen() {
  const { data, loading, error, refetch } = useQuery(HelloDocument);
  const { localStatus, pending, refreshStatus, callAction } =
    useSimulatorControls(refetch);

  return (
    <main>
      <h1>Station Finder</h1>
      <p>Find and book EV charging stations near you.</p>

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          GraphQL Hello
        </h2>
        {loading && <p className="text-slate-600">Loading hello message...</p>}
        {error && (
          <p className="text-red-600">Failed to load GraphQL data.</p>
        )}
        {!loading && !error && (
          <p className="text-slate-700">{data?.hello}</p>
        )}
        <p className="mt-2 text-sm text-slate-600">
          Backend sees simulator as: {data?.simulationStatus ?? "unknown"}
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Simulator Controls
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          Frontend sees simulator as: {localStatus}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={pending}
            onClick={() => void callAction("start")}
            type="button"
          >
            Start simulation
          </button>
          <button
            disabled={pending}
            onClick={() => void callAction("stop")}
            type="button"
          >
            Stop simulation
          </button>
          <button
            disabled={pending}
            onClick={() => void refreshStatus()}
            type="button"
          >
            Refresh simulator status
          </button>
        </div>
      </section>
    </main>
  );
}
