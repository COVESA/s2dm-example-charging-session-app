export const config = {
  graphqlUrl: process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:4000/graphql"
} as const;
