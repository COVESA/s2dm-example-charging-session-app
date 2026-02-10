"use client";

import { gql } from "@apollo/client";
import { ApolloProvider, useQuery } from "@apollo/client/react";
import { useCallback, useState } from "react";

import { apolloClient } from "@/lib/apollo/client";

const HELLO_QUERY = gql`
  query Hello {
    hello
    simulationStatus
  }
`;

type HelloQueryResponse = {
  hello: string;
  simulationStatus: string;
};

type SimulatorStatusResponse = {
  running: boolean;
};

const simulatorBaseUrl = process.env.NEXT_PUBLIC_SIMULATOR_URL ?? "http://localhost:8000";

const HomeContent = () => {
  const { data, loading, error, refetch } = useQuery<HelloQueryResponse>(HELLO_QUERY);
  const [localSimulatorStatus, setLocalSimulatorStatus] = useState<string>("unknown");
  const [pendingAction, setPendingAction] = useState<boolean>(false);

  const refreshSimulatorStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${simulatorBaseUrl}/status`);
      if (!response.ok) {
        setLocalSimulatorStatus("unknown");
        return;
      }

      const payload = (await response.json()) as SimulatorStatusResponse;
      setLocalSimulatorStatus(payload.running ? "running" : "stopped");
    } catch {
      setLocalSimulatorStatus("unknown");
    }
  }, []);

  const callSimulationEndpoint = useCallback(
    async (action: "start" | "stop"): Promise<void> => {
      setPendingAction(true);
      try {
        await fetch(`${simulatorBaseUrl}/${action}`, { method: "POST" });
        await Promise.all([refreshSimulatorStatus(), refetch()]);
      } finally {
        setPendingAction(false);
      }
    },
    [refetch, refreshSimulatorStatus]
  );

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
        <p>Frontend sees simulator as: {localSimulatorStatus}</p>
        <button disabled={pendingAction} onClick={() => void callSimulationEndpoint("start")} type="button">
          Start simulation
        </button>
        <button disabled={pendingAction} onClick={() => void callSimulationEndpoint("stop")} type="button">
          Stop simulation
        </button>
        <button disabled={pendingAction} onClick={() => void refreshSimulatorStatus()} type="button">
          Refresh simulator status
        </button>
      </section>
    </main>
  );
};

export default function Home() {
  return (
    <ApolloProvider client={apolloClient}>
      <HomeContent />
    </ApolloProvider>
  );
}
