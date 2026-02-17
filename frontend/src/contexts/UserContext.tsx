"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";

import type { User } from "@/graphql/generated/graphql";

type UserContextValue = {
  selectedUser: User | null;
  setSelectedUser: (user: User | null) => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [selectedUser, setSelectedUserState] = useState<User | null>(null);

  const setSelectedUser = useCallback((user: User | null) => {
    setSelectedUserState(user);
  }, []);

  const value = useMemo(
    () => ({ selectedUser, setSelectedUser }),
    [selectedUser, setSelectedUser]
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
