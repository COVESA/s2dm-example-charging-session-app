export type GraphQLContext = {
  simulatorBaseUrl: string;
};

export const createGraphQLContext = (): GraphQLContext => {
  return {
    simulatorBaseUrl: process.env.SIMULATOR_BASE_URL ?? "http://localhost:8000"
  };
};
