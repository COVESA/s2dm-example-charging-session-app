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

function getAvatarBubbleClass(roles: UserRole[] | undefined): string {
  if (!roles?.length) return "bg-slate-300";
  return roles.includes(UserRole.Admin) ? "bg-amber-400" : "bg-slate-300";
}

function getPrimaryRole(roles: UserRole[] | undefined): string {
  if (!roles?.length) return "—";
  return roles.includes(UserRole.Admin) ? "Admin" : "Driver";
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
    <header className="sticky top-0 z-[1100] flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex-shrink-0">
        <Link
          href="/"
          className="flex cursor-pointer items-center gap-3 text-inherit no-underline"
        >
          <Image
            src="/logo.png"
            alt="LeafyCharge"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0"
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

      <div className="flex flex-shrink-0 items-center gap-6">
        <div ref={dropdownRef}>
          <div className="relative">
          <div
            role="button"
            tabIndex={0}
            onClick={() => users.length > 0 && setIsOpen((prev) => !prev)}
            onKeyDown={(e) => {
              if (users.length === 0) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsOpen((prev) => !prev);
              }
            }}
            className={
              users.length > 0
                ? "cursor-pointer"
                : "cursor-default"
            }
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-label="Select user"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${getAvatarBubbleClass(currentUser?.roles)}`}
              aria-hidden
            >
              <span
                className={`material-symbols-outlined ${loading ? "opacity-50" : ""}`}
                style={{ fontSize: 24 }}
              >
                person
              </span>
            </div>
          </div>

          {isOpen && users.length > 0 && (
            <ul
              role="listbox"
              className="absolute right-0 top-full z-[1100] mt-1 min-w-[200px] divide-y divide-slate-100 rounded-lg bg-white py-1 shadow-lg"
            >
              {users.map((user) => (
                <li
                  key={user.id}
                  role="option"
                  onClick={() => handleSelectUser(user)}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm transition-colors first:pt-2 ${
                    currentUser?.id === user.id
                      ? "bg-green-50/80 text-green-900"
                      : "text-slate-700 hover:bg-slate-50/80"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${getAvatarBubbleClass(user.roles)}`}
                    aria-hidden
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 20 }}
                    >
                      person
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium">{user.displayName}</span>
                    <span className="text-xs text-slate-500">
                      {getPrimaryRole(user.roles)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          </div>
        </div>
      </div>
    </header>
  );
}
