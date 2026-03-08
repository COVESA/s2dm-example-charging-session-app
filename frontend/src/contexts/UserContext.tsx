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
import { getOrInitGuestIdentity } from "@/lib/utils/guestIdentity";

type UserContextValue = {
  selectedUser: User | null;
  setSelectedUser: (user: User | null) => void;
  toggleRole: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [selectedUser, setSelectedUserState] = useState<User | null>(null);

  useEffect(() => {
    // Initialize guest identity on client side
    const guest = getOrInitGuestIdentity();
    setSelectedUserState(guest);
  }, []);

  const setSelectedUser = useCallback((user: User | null) => {
    setSelectedUserState(user);
  }, []);

  const toggleRole = useCallback(() => {
    setSelectedUserState((prev) => {
      if (!prev) return null;
      
      const currentRole = prev.roles.includes(UserRole.Admin)
        ? UserRole.Admin
        : UserRole.User;
      
      const newRole = currentRole === UserRole.Admin ? UserRole.User : UserRole.Admin;
      
      return {
        ...prev,
        roles: [newRole]
      };
    });
  }, []);

  const value = useMemo(
    () => ({ selectedUser, setSelectedUser, toggleRole }),
    [selectedUser, setSelectedUser, toggleRole]
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
