"use client";

import Image from "next/image";
import Link from "next/link";

import { useUserContext } from "@/contexts/UserContext";
import { isAdminRole, getDefaultRouteForRoles } from "@/lib/utils/roleNavigation";

const FEATURES = [
  {
    icon: "map",
    title: "Station Finder",
    description:
      "Discover available charging stations on the map. View real-time availability and book a session.",
    tag: "Map View",
    href: "/map",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  {
    icon: "ev_station",
    title: "Session Activity",
    description:
      "Track your charging sessions. Monitor status, energy delivered, and session history.",
    tag: "Sessions",
    href: "/sessions",
    iconBg: "bg-cyan-100",
    iconColor: "text-cyan-600",
  },
  {
    icon: "analytics",
    title: "Admin Dashboard",
    description:
      "Monitor network-wide operations, fleet utilization, telemetry trends, and incident management.",
    tag: "Dashboard",
    href: "/dashboard",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
];

export function HomeScreen() {
  const { selectedUser } = useUserContext();
  const isAdmin = isAdminRole(selectedUser?.roles);
  const primaryHref = getDefaultRouteForRoles(selectedUser?.roles);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="LeafyCharge"
              width={44}
              height={44}
              className="h-11 w-11 shrink-0"
            />
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              EV Charging Demo
            </h1>
          </div>

          <p className="mb-6 max-w-xl text-base text-slate-500">
            Find nearby stations, reserve a charging point, and track your
            session from start to finish — all in one place.
          </p>

          <div className="mb-7 flex flex-wrap justify-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
              MongoDB-Powered
            </span>
            <span className="rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-700 ring-1 ring-cyan-200">
              Telemetry
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
              Geospatial
            </span>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200">
              Real-Time
            </span>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet-700 ring-1 ring-violet-200">
              Analytics
            </span>
          </div>

          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-7 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            <span className="material-symbols-outlined text-lg">bolt</span>
            {isAdmin ? "Open Analytics Dashboard" : "Get Started"}
          </Link>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <Link
            key={feature.title}
            href={feature.href}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${feature.iconBg}`}>
              <span className={`material-symbols-outlined text-xl ${feature.iconColor}`}>
                {feature.icon}
              </span>
            </div>

            <h2 className="mb-1.5 text-base font-bold text-slate-900">
              {feature.title}
            </h2>

            <p className="mb-4 flex-1 text-sm leading-relaxed text-slate-500">
              {feature.description}
            </p>

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 transition-colors group-hover:text-emerald-700">
                {feature.tag}
                <span className="ml-1 inline-block translate-x-0 transition-transform group-hover:translate-x-0.5">&rarr;</span>
              </span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
