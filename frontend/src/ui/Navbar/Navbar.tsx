"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useUserContext } from "@/contexts/UserContext";
import { UserRole } from "@/graphql/generated/graphql";
import {
  ADMIN_NAV_LINKS,
  DRIVER_NAV_LINKS,
  getDefaultRouteForRole,
  isAdminRole
} from "@/lib/utils/roleNavigation";

function getAvatarBubbleClass(roles: UserRole[] | undefined): string {
  if (!roles?.length) return "bg-slate-300";
  return roles.includes(UserRole.Admin) ? "bg-amber-400" : "bg-slate-300";
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedUser, setRole } = useUserContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentUser = selectedUser;
  const isAdmin = isAdminRole(currentUser?.roles);
  const navLinks = isAdmin ? ADMIN_NAV_LINKS : DRIVER_NAV_LINKS;

  const handleRoleSelect = (role: UserRole) => {
    setRole(role);
    setIsOpen(false);
    router.replace(getDefaultRouteForRole(role));
  };

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
        {navLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-4 py-2 text-[0.9375rem] font-medium no-underline transition-colors ${
              pathname === href || pathname.startsWith(`${href}/`)
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
              <div className="absolute right-0 top-full z-[1100] mt-2 w-56 overflow-hidden rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/5">
                <div
                  role="option"
                  aria-selected={!isAdmin}
                  onClick={() => handleRoleSelect(UserRole.User)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3.5 transition-colors ${
                    !isAdmin
                      ? "bg-green-50 text-green-900"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${!isAdmin ? "bg-slate-500" : "bg-slate-300"}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>directions_car</span>
                  </div>
                  <div>
                    <span className="text-[15px] font-semibold">Driver</span>
                    {!isAdmin && <p className="text-[11px] font-medium text-green-600">Active</p>}
                  </div>
                </div>

                <div
                  role="option"
                  aria-selected={!!isAdmin}
                  onClick={() => handleRoleSelect(UserRole.Admin)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3.5 transition-colors ${
                    isAdmin
                      ? "bg-amber-50 text-amber-900"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${isAdmin ? "bg-amber-400" : "bg-amber-300"}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>admin_panel_settings</span>
                  </div>
                  <div>
                    <span className="text-[15px] font-semibold">Admin</span>
                    {isAdmin && <p className="text-[11px] font-medium text-amber-600">Active</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
