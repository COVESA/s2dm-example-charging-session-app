import type { GraphQLContext } from "../../server/context";
import { findUsers } from "../../db/repositories/users";

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

function mapRole(role: string): "USER" | "ADMIN" {
  return role === "ADMIN" ? "ADMIN" : "USER";
}

export const resolvers = {
  Query: {
    hello: () => "Hello world from GraphQL API",
    simulationStatus: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return getSimulationStatus(context.simulatorBaseUrl);
    },
    users: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const rows = await findUsers(context.db);
      return rows.map((row) => ({
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        roles: row.roles.map(mapRole)
      }));
    }
  }
};
