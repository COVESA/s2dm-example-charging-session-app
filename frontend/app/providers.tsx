"use client";

import { ApolloProvider } from "@apollo/client/react";

import { UserProvider } from "@/contexts/UserContext";
import { apolloClient } from "@/lib/apollo/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ApolloProvider client={apolloClient}>
      <UserProvider>{children}</UserProvider>
    </ApolloProvider>
  );
}
