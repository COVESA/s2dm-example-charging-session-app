import type { Db } from "mongodb";

export type GraphQLContext = {
  db: Db;
};

export const createGraphQLContext = (db: Db): GraphQLContext => {
  return {
    db
  };
};
