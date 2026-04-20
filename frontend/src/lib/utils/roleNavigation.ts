"use client";

import { UserRole } from "@/graphql/generated/graphql";

export const DRIVER_HOME_ROUTE = "/map";
export const DRIVER_SESSIONS_ROUTE = "/sessions";
export const ADMIN_DASHBOARD_ROUTE = "/dashboard";

export const HOME_ROUTE = "/";

export const DRIVER_NAV_LINKS = [
  { href: HOME_ROUTE, label: "Home" },
  { href: DRIVER_HOME_ROUTE, label: "Station Finder" },
  { href: DRIVER_SESSIONS_ROUTE, label: "Session Activity" }
] as const;

export const ADMIN_NAV_LINKS = [
  { href: HOME_ROUTE, label: "Home" },
  { href: ADMIN_DASHBOARD_ROUTE, label: "Analytics Dashboard" }
] as const;

export function isAdminRole(roles: UserRole[] | undefined): boolean {
  return roles?.includes(UserRole.Admin) ?? false;
}

export function getDefaultRouteForRoles(roles: UserRole[] | undefined): string {
  return isAdminRole(roles) ? ADMIN_DASHBOARD_ROUTE : DRIVER_HOME_ROUTE;
}

export function getDefaultRouteForRole(role: UserRole): string {
  return role === UserRole.Admin ? ADMIN_DASHBOARD_ROUTE : DRIVER_HOME_ROUTE;
}
