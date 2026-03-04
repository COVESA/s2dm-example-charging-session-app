import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

import { config } from "@/lib/config/env";

const httpLink = new HttpLink({
  uri: config.graphqlUrl
});

export const apolloClient = new ApolloClient({
  cache: new InMemoryCache(),
  link: httpLink
});
