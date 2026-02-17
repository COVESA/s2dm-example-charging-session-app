import type { Db } from "mongodb";

export type GraphQLContext = {
  simulatorBaseUrl: string;
  db: Db;
};

export const createGraphQLContext = (db: Db): GraphQLContext => {
  return {
    simulatorBaseUrl: process.env.SIMULATOR_URL ?? "http://localhost:8000",
    db
  };
};
