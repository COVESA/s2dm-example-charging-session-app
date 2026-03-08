"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useUserContext } from "@/contexts/UserContext";
import { UserRole } from "@/graphql/generated/graphql";

const NAV_LINKS = [
  { href: "/map", label: "Station Finder" },
  { href: "/sessions", label: "Session Activity" }
] as const;

function getAvatarBubbleClass(roles: UserRole[] | undefined): string {
  if (!roles?.length) return "bg-slate-300";
  return roles.includes(UserRole.Admin) ? "bg-amber-400" : "bg-slate-300";
}

export function Navbar() {
  const pathname = usePathname();
  const { selectedUser, toggleRole } = useUserContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentUser = selectedUser;
  const isAdmin = currentUser?.roles.includes(UserRole.Admin);

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

  if (!currentUser) return null;

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
              onClick={() => setIsOpen((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsOpen((prev) => !prev);
                }
              }}
              className="cursor-pointer"
              aria-expanded={isOpen}
              aria-haspopup="listbox"
              aria-label="User menu"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-shadow hover:ring-2 hover:ring-offset-1 ${isAdmin ? "hover:ring-amber-300" : "hover:ring-slate-300"} ${getAvatarBubbleClass(currentUser?.roles)}`}
                aria-hidden
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 24 }}
                >
                  person
                </span>
              </div>
            </div>

            {isOpen && (
              <div className="absolute right-0 top-full z-[1100] mt-2 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5">
                <div
                  role="option"
                  aria-selected={!isAdmin}
                  onClick={() => { if (isAdmin) toggleRole(); setIsOpen(false); }}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                    !isAdmin
                      ? "bg-green-50 text-green-900"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${!isAdmin ? "bg-slate-500" : "bg-slate-300"}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>directions_car</span>
                  </div>
                  <span className="text-sm font-medium">Driver</span>
                </div>

                <div className="mx-3 border-t border-slate-100" />

                <div
                  role="option"
                  aria-selected={!!isAdmin}
                  onClick={() => { if (!isAdmin) toggleRole(); setIsOpen(false); }}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                    isAdmin
                      ? "bg-amber-50 text-amber-900"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${isAdmin ? "bg-amber-400" : "bg-amber-300"}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>admin_panel_settings</span>
                  </div>
                  <span className="text-sm font-medium">Admin</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
