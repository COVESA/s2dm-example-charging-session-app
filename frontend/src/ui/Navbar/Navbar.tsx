"use client";

import { useQuery } from "@apollo/client/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useUserContext } from "@/contexts/UserContext";
import {
  UsersDocument,
  UserRole,
  type User
} from "@/graphql/generated/graphql";

const NAV_LINKS = [
  { href: "/map", label: "Station Finder" },
  { href: "/sessions", label: "Session Activity" }
] as const;

function getInitials(displayName: string): string {
  return displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getPrimaryRole(roles: UserRole[]): string {
  return roles.includes(UserRole.Admin) ? "ADMIN" : "USER";
}

export function Navbar() {
  const pathname = usePathname();
  const { data, loading } = useQuery(UsersDocument);
  const { selectedUser, setSelectedUser } = useUserContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const users = data?.users ?? [];
  const currentUser = selectedUser ?? users[0] ?? null;

  useEffect(() => {
    if (!selectedUser && users.length > 0) {
      setSelectedUser(users[0]);
    }
  }, [users, selectedUser, setSelectedUser]);

  const handleSelectUser = useCallback(
    (user: User) => {
      setSelectedUser(user);
      setIsOpen(false);
    },
    [setSelectedUser]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex-shrink-0">
        <Link
          href="/"
          className="flex items-center gap-3 text-inherit no-underline hover:opacity-85"
        >
          <Image
            src="/logo.png"
            alt="LeafyCharge"
            width={36}
            height={36}
            className="shrink-0"
          />
          <span className="text-xl font-semibold text-slate-900">
            LeafyCharge
          </span>
        </Link>
      </div>

      <nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-4 py-2 text-[0.9375rem] font-medium no-underline transition-colors ${
              pathname === href
                ? "bg-green-100 text-green-800 hover:bg-green-200 hover:text-green-900"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex-shrink-0" ref={dropdownRef}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-label="Select user"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-800 to-green-500 text-sm font-semibold text-white"
              aria-hidden
            >
              {loading
                ? "…"
                : currentUser
                  ? getInitials(currentUser.displayName)
                  : "—"}
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-sm font-medium text-slate-900">
                {loading ? "Loading…" : currentUser?.displayName ?? "No user"}
              </span>
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">
                {currentUser ? getPrimaryRole(currentUser.roles) : "—"}
              </span>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-5 w-5 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {isOpen && users.length > 0 && (
            <ul
              role="listbox"
              className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              {users.map((user) => (
                <li key={user.id} role="option">
                  <button
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                      currentUser?.id === user.id
                        ? "bg-green-50 text-green-900"
                        : "text-slate-700"
                    }`}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-700 to-green-500 text-xs font-semibold text-white"
                      aria-hidden
                    >
                      {getInitials(user.displayName)}
                    </div>
                    <div className="flex flex-col gap-0">
                      <span className="font-medium">{user.displayName}</span>
                      <span className="text-xs text-slate-500">
                        {getPrimaryRole(user.roles)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  );
}
