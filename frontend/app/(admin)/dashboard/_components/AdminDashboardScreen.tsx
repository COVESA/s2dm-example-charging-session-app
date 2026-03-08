"use client";

import {
  AreaChart,
  BarChart,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow
} from "@tremor/react";

import type { AdminDashboardQuery } from "@/graphql/generated/graphql";
import { UserRole } from "@/graphql/generated/graphql";
import { useRoleRouteGuard } from "@/hooks/useRoleRouteGuard";
import { useAdminDashboardQuery } from "../_hooks/useAdminDashboardQuery";
import {
  formatCompactNumber,
  formatCount,
  formatCurrencyCents,
  formatEnergyKwh,
  formatPercent,
  formatPowerKw,
  formatTariffCentsPerKwh,
  formatTimestamp
} from "./formatters";

type DashboardData = NonNullable<AdminDashboardQuery["adminDashboard"]>;

function formatLabel(label: string): string {
  return label
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSessionStatusClasses(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "ACTIVE":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    case "BOOKED":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "CANCELED":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
    default:
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  }
}

function getIncidentStatusClasses(status: string): string {
  switch (status) {
    case "OPEN":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    case "ACKNOWLEDGED":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    default:
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }
}

function KpiCard({
  title,
  value,
  helper
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <Card className="rounded-2xl border border-slate-200 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </Card>
  );
}

function DashboardShell({ dashboard }: { dashboard: DashboardData }) {
  const summaryCards = [
    {
      title: "Network footprint",
      value: `${formatCompactNumber(dashboard.summary.totalStations)} stations`,
      helper: `${formatCompactNumber(dashboard.summary.totalChargingPoints)} charging points across the fleet`
    },
    {
      title: "Live availability",
      value: formatCompactNumber(dashboard.summary.availableNowPoints),
      helper: `${formatCompactNumber(dashboard.summary.chargingPointsInUse)} charging and ${formatCompactNumber(dashboard.summary.reservedPoints)} reserved right now`
    },
    {
      title: "Commercial output",
      value: formatCurrencyCents(dashboard.summary.revenueLast7DaysCents),
      helper: `${formatEnergyKwh(dashboard.summary.energyLast7DaysKwh)} delivered over the last 7 days`
    },
    {
      title: "Open issues",
      value: formatCount(dashboard.summary.openIncidents),
      helper: `${formatCount(dashboard.summary.outOfServicePoints)} points currently out of service`
    }
  ];

  const availabilityChartData = dashboard.pointAvailabilityBreakdown.map((item) => ({
    state: formatLabel(item.label),
    Points: item.value
  }));

  const sessionStatusChartData = dashboard.sessionStatusBreakdown
    .filter((item) => item.value > 0)
    .map((item) => ({
      status: formatLabel(item.label),
      Sessions: item.value
    }));

  const operationalChartData = dashboard.pointOperationalBreakdown.map((item) => ({
    name: formatLabel(item.label),
    value: item.value
  }));

  const sessionTrendData = dashboard.recentSessionTrend.map((item) => ({
    date: item.bucket,
    Sessions: item.sessions,
    Completed: item.completedSessions
  }));

  const telemetryTrendData = dashboard.recentTelemetryTrend.map((item) => ({
    hour: item.bucket,
    "Average power": item.avgPowerKw,
    "Peak power": item.maxPowerKw
  }));

  return (
    <main className="h-full w-full bg-slate-50 px-6 py-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        <section className="rounded-3xl bg-slate-900 px-6 py-7 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-200">
                Admin Control Panel
              </p>
              <h1 className="mt-2 text-3xl font-semibold">
                EV charging network operations
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300">
                Monitor live availability, fleet utilization, telemetry activity, and
                customer-impacting incidents from one operator-facing dashboard.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/8 px-4 py-3 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-slate-300">
                  Operational points
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {formatCompactNumber(dashboard.summary.operationalPoints)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/8 px-4 py-3 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-slate-300">
                  Completed sessions
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {formatCompactNumber(dashboard.summary.completedSessionsLast7Days)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/8 px-4 py-3 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-slate-300">
                  Avg tariff
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {formatTariffCentsPerKwh(dashboard.summary.avgPriceCentsPerKwh)}
                  <span className="ml-1 text-sm font-medium text-slate-300">/ kWh</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <KpiCard
              key={card.title}
              title={card.title}
              value={card.value}
              helper={card.helper}
            />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
          <Card className="rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Session throughput
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Bookings and completed charging sessions over the last 7 days.
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 px-3 py-2 text-right">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Active now
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatCount(dashboard.summary.activeSessions)}
                </p>
              </div>
            </div>

            <AreaChart
              className="mt-6 h-72"
              data={sessionTrendData}
              index="date"
              categories={["Sessions", "Completed"]}
              colors={["cyan", "emerald"]}
              valueFormatter={(value: number) => formatCount(value)}
              yAxisWidth={48}
              showAnimation
            />
          </Card>

          <Card className="rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Point availability mix
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Current fleet-wide charging point availability states.
            </p>

            <BarChart
              className="mt-6 h-72"
              data={availabilityChartData}
              index="state"
              categories={["Points"]}
              colors={["emerald"]}
              valueFormatter={(value: number) => formatCount(value)}
              yAxisWidth={96}
              showLegend={false}
              showAnimation
            />
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
          <Card className="rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Telemetry load
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Average and peak charging power across the last 12 hours of
                  telemetry.
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 px-3 py-2 text-right">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Energy delta
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatEnergyKwh(
                    dashboard.recentTelemetryTrend.reduce(
                      (sum, item) => sum + item.energyDeltaKwh,
                      0
                    )
                  )}
                </p>
              </div>
            </div>

            <AreaChart
              className="mt-6 h-72"
              data={telemetryTrendData}
              index="hour"
              categories={["Average power", "Peak power"]}
              colors={["indigo", "violet"]}
              valueFormatter={(value: number) => formatPowerKw(value)}
              yAxisWidth={56}
              showAnimation
            />
          </Card>

          <Card className="rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Session status mix
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Historical session lifecycle distribution in the current dataset.
            </p>

            <BarChart
              className="mt-6 h-72"
              data={sessionStatusChartData}
              index="status"
              categories={["Sessions"]}
              colors={["sky"]}
              valueFormatter={(value: number) => formatCount(value)}
              yAxisWidth={96}
              showLegend={false}
              showAnimation
            />
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card className="rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Operator leaderboard
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Largest operators by installed footprint, with a quick utilization
              snapshot.
            </p>

            <Table className="mt-5">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Operator</TableHeaderCell>
                  <TableHeaderCell className="text-right">Stations</TableHeaderCell>
                  <TableHeaderCell className="text-right">Points</TableHeaderCell>
                  <TableHeaderCell className="text-right">Available</TableHeaderCell>
                  <TableHeaderCell className="text-right">Utilization</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dashboard.topOperators.map((operator) => (
                  <TableRow key={operator.operator}>
                    <TableCell className="max-w-[18rem]">
                      <div>
                        <p className="font-medium text-slate-900">{operator.operator}</p>
                        <p className="text-xs text-slate-500">
                          Avg tariff {formatTariffCentsPerKwh(operator.avgPriceCentsPerKwh)} / kWh
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCompactNumber(operator.stations)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCompactNumber(operator.chargingPoints)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCompactNumber(operator.availableNowPoints)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(operator.utilizationPercent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Operational health
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Charger health states and the latest incident queue.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {operationalChartData.map((item) => (
                <div
                  key={item.name}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {item.name}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {formatCompactNumber(item.value)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              {dashboard.recentIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getIncidentStatusClasses(
                            incident.status
                          )}`}
                        >
                          {formatLabel(incident.status)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          {formatLabel(incident.type)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-medium text-slate-900">
                        {incident.stationName ?? "Unknown station"}
                        {incident.chargingPointLabel
                          ? ` · ${incident.chargingPointLabel}`
                          : ""}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {incident.description}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <p>{formatLabel(incident.severity)}</p>
                      <p className="mt-1">{formatTimestamp(incident.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card className="rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Latest charging sessions
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Recent session updates with live commercial and operational context.
              </p>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-2 text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Session statuses
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {sessionStatusChartData.length} active categories
              </p>
            </div>
          </div>

          <Table className="mt-5">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Station</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Vehicle</TableHeaderCell>
                <TableHeaderCell className="text-right">Energy</TableHeaderCell>
                <TableHeaderCell className="text-right">Revenue</TableHeaderCell>
                <TableHeaderCell className="text-right">Updated</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dashboard.recentSessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">
                        {session.stationName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {session.chargingPointLabel}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getSessionStatusClasses(
                        session.status
                      )}`}
                    >
                      {formatLabel(session.status)}
                    </span>
                  </TableCell>
                  <TableCell>{session.vehicleLabel}</TableCell>
                  <TableCell className="text-right">
                    {formatEnergyKwh(session.energyDeliveredKwh)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrencyCents(session.totalCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatTimestamp(session.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </main>
  );
}

export function AdminDashboardScreen() {
  const { isReady, isAllowed } = useRoleRouteGuard(UserRole.Admin);
  const { dashboard, loading, error, refetch } = useAdminDashboardQuery();

  if (!isReady || !isAllowed) {
    return (
      <main className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-600">Loading analytics dashboard...</p>
      </main>
    );
  }

  if (loading && !dashboard) {
    return (
      <main className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-600">Loading analytics dashboard...</p>
      </main>
    );
  }

  if (error && !dashboard) {
    return (
      <main className="flex h-full items-center justify-center">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            Admin analytics unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            The operator dashboard could not be loaded from the API.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!dashboard) {
    return (
      <main className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-600">No dashboard data available.</p>
      </main>
    );
  }

  return <DashboardShell dashboard={dashboard} />;
}
