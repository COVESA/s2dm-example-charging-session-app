"use client";

import Image from "next/image";
import Link from "next/link";

import { useUserContext } from "@/contexts/UserContext";
import { isAdminRole, getDefaultRouteForRoles } from "@/lib/utils/roleNavigation";

export function HomeScreen() {
  const { selectedUser } = useUserContext();
  const isAdmin = isAdminRole(selectedUser?.roles);
  const primaryHref = getDefaultRouteForRoles(selectedUser?.roles);

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      {/* Main hero card */}
      <section className="rounded-2xl bg-green-50 border border-green-100 p-8 md:p-10 mb-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-4 mb-4">
            <Image
              src="/logo.png"
              alt="LeafyCharge"
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-full"
            />
            <h1 className="text-2xl md:text-3xl font-bold text-green-900">
              EV Charging Station Demo
            </h1>
          </div>
          <p className="text-slate-600 text-lg mb-6 max-w-xl">
            Find, book, and manage EV charging sessions. Real-time telemetry and
            session simulation.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700">
              MONGODB-POWERED
            </span>
            <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-slate-700">
              REAL-TIME
            </span>
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700">
              SIMULATOR
            </span>
          </div>
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center rounded-lg bg-green-800 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
          >
            {isAdmin ? "Open Analytics Dashboard" : "Get Started"}
          </Link>
        </div>
      </section>

      {/* Three placeholder sub-cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-green-900 mb-2">
            Station Finder
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Discover available charging stations on the map. View real-time
            availability and book a session.
          </p>
          <span className="inline-block rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-800">
            MAP VIEW
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.5 8.5 0 0 0 9 18.75v.375M6 12a2.25 2.25 0 0 0 2.25 2.25h10.5A2.25 2.25 0 0 0 19 12m-6 6v.375c0-.621.504-1.125 1.125-1.125H17.25c.621 0 1.125.504 1.125 1.125V18m0 0h2.25M21 12a2.25 2.25 0 0 0-2.25-2.25H15"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-green-900 mb-2">
            Session Activity
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Track your charging sessions. Monitor status, energy delivered, and
            session history.
          </p>
          <span className="inline-block rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            SESSIONS
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-green-900 mb-2">
            Telemetry Simulator
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Start and stop the simulator to generate charging station telemetry
            and session data.
          </p>
          <span className="inline-block rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            SIMULATOR
          </span>
        </div>
      </section>
    </main>
  );
}
