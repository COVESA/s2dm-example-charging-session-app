"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { UserRole, type User } from "@/graphql/generated/graphql";
import { getOrInitGuestIdentity, setGuestRole } from "@/lib/utils/guestIdentity";

type UserContextValue = {
  selectedUser: User | null;
  setSelectedUser: (user: User | null) => void;
  setRole: (role: UserRole) => void;
  toggleRole: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [selectedUser, setSelectedUserState] = useState<User | null>(null);

  useEffect(() => {
    // Initialize guest identity on client side
    const guest = getOrInitGuestIdentity();
    const frameId = window.requestAnimationFrame(() => {
      setSelectedUserState(guest);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const setSelectedUser = useCallback((user: User | null) => {
    setSelectedUserState(user);
    if (user?.roles[0]) {
      setGuestRole(user.roles[0]);
    }
  }, []);

  const setRole = useCallback((role: UserRole) => {
    setSelectedUserState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        roles: [role]
      };
    });
    setGuestRole(role);
  }, []);

  const toggleRole = useCallback(() => {
    const nextRole = selectedUser?.roles.includes(UserRole.Admin)
      ? UserRole.User
      : UserRole.Admin;

    if (!selectedUser) {
      return;
    }

    setRole(nextRole);
  }, [selectedUser, setRole]);

  const value = useMemo(
    () => ({ selectedUser, setSelectedUser, setRole, toggleRole }),
    [selectedUser, setRole, setSelectedUser, toggleRole]
  );

  return (
    <UserContext.Provider value={value}>{children}</UserContext.Provider>
  );
}

export function useUserContext(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUserContext must be used within UserProvider");
  }
  return ctx;
}
