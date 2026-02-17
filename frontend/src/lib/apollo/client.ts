import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

import { config } from "@/lib/config/env";

export const apolloClient = new ApolloClient({
  cache: new InMemoryCache(),
  link: new HttpLink({
    uri: config.graphqlUrl
  })
});
