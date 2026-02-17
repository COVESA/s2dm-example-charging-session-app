export const config = {
  graphqlUrl: process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:4000/graphql",
  simulatorUrl: process.env.NEXT_PUBLIC_SIMULATOR_URL ?? "http://localhost:8000"
} as const;
