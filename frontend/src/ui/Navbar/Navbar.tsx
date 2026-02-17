"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/map", label: "Station Finder" },
  { href: "/sessions", label: "Session Activity" }
] as const;

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex-shrink-0">
        <Link href="/" className="flex items-center gap-3 text-inherit no-underline hover:opacity-85">
          <Image
            src="/logo.png"
            alt="LeafyCharge"
            width={36}
            height={36}
            className="shrink-0"
          />
          <span className="text-xl font-semibold text-slate-900">LeafyCharge</span>
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

      <div className="flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-800 to-green-500 text-sm font-semibold text-white"
            aria-hidden
          >
            JD
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-sm font-medium text-slate-900">Jane Driver</span>
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">
              DRIVER
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
