"use client";

import { useQuery } from "@apollo/client/react";

import { AdminDashboardDocument } from "@/graphql/generated/graphql";

export function useAdminDashboardQuery() {
  const { data, loading, error, refetch } = useQuery(AdminDashboardDocument, {
    fetchPolicy: "cache-and-network"
  });

  return {
    dashboard: data?.adminDashboard ?? null,
    loading,
    error,
    refetch
  };
}
