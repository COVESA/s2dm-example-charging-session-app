import type { GraphQLContext } from "../../server/context";

type SimulationStatusResponse = {
  running: boolean;
};

const getSimulationStatus = async (simulatorBaseUrl: string): Promise<string> => {
  try {
    const response = await fetch(`${simulatorBaseUrl}/status`);
    if (!response.ok) {
      return "unknown";
    }

    const payload = (await response.json()) as SimulationStatusResponse;
    return payload.running ? "running" : "stopped";
  } catch {
    return "unknown";
  }
};

export const resolvers = {
  Query: {
    hello: () => "Hello world from GraphQL API",
    simulationStatus: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return getSimulationStatus(context.simulatorBaseUrl);
    }
  }
};
