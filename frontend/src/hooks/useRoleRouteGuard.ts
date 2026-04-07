"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useUserContext } from "@/contexts/UserContext";
import { UserRole } from "@/graphql/generated/graphql";
import { getDefaultRouteForRoles, isAdminRole } from "@/lib/utils/roleNavigation";

export function useRoleRouteGuard(requiredRole: UserRole) {
  const router = useRouter();
  const { selectedUser } = useUserContext();

  const isReady = selectedUser !== null;
  const isAdmin = isAdminRole(selectedUser?.roles);
  const isAllowed =
    requiredRole === UserRole.Admin ? isAdmin : selectedUser !== null && !isAdmin;

  useEffect(() => {
    if (!selectedUser || isAllowed) {
      return;
    }

    router.replace(getDefaultRouteForRoles(selectedUser.roles));
  }, [isAllowed, router, selectedUser]);

  return {
    selectedUser,
    isReady,
    isAllowed,
    isAdmin
  };
}
