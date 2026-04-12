"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

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

function getIncidentBorderClass(status: string): string {
  switch (status) {
    case "OPEN":
      return "border-l-rose-400";
    case "ACKNOWLEDGED":
      return "border-l-amber-400";
    default:
      return "border-l-emerald-400";
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

const KPI_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  "Network footprint": { icon: "ev_station", bg: "bg-emerald-100", color: "text-emerald-600" },
  "Live availability": { icon: "bolt", bg: "bg-cyan-100", color: "text-cyan-600" },
  "Commercial output": { icon: "payments", bg: "bg-amber-100", color: "text-amber-600" },
  "Open issues": { icon: "warning", bg: "bg-rose-100", color: "text-rose-600" }
};

function KpiCard({
  title,
  value,
  helper
}: {
  title: string;
  value: string;
  helper: string;
}) {
  const style = KPI_ICONS[title] ?? { icon: "info", bg: "bg-slate-100", color: "text-slate-600" };

  return (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.bg}`}>
        <span className={`material-symbols-outlined text-lg ${style.color}`}>{style.icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        <p className="mt-1 text-2xl font-semibold leading-tight text-slate-900">{value}</p>
        <p className="mt-1.5 text-xs text-slate-500">{helper}</p>
      </div>
    </div>
  );
}

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  badge
}: {
  icon: string;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
          <span className="material-symbols-outlined text-lg text-slate-500">{icon}</span>
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      {badge}
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 text-right">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ChartTooltipContent({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
      <p className="mb-1.5 text-[11px] font-semibold text-slate-500">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-xs text-slate-600">{entry.name}</span>
          <span className="ml-auto text-xs font-semibold text-slate-900">{formatter(entry.value)}</span>
        </div>
      ))}
    </div>
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
        {/* Hero banner */}
        <section className="rounded-2xl bg-slate-900 px-6 py-7 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Admin Control Panel
              </p>
              <h1 className="mt-2 text-2xl font-bold">
                EV charging network operations
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Monitor live availability, fleet utilization, telemetry activity, and
                customer-impacting incidents from one operator-facing dashboard.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl bg-white/8 px-4 py-3 backdrop-blur">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  <span className="material-symbols-outlined text-base text-emerald-300">check_circle</span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Operational points
                  </p>
                  <p className="text-lg font-semibold">
                    {formatCompactNumber(dashboard.summary.operationalPoints)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white/8 px-4 py-3 backdrop-blur">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  <span className="material-symbols-outlined text-base text-cyan-300">ev_station</span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Completed sessions
                  </p>
                  <p className="text-lg font-semibold">
                    {formatCompactNumber(dashboard.summary.completedSessionsLast7Days)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white/8 px-4 py-3 backdrop-blur">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  <span className="material-symbols-outlined text-base text-amber-300">payments</span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Avg tariff
                  </p>
                  <p className="text-lg font-semibold">
                    {formatTariffCentsPerKwh(dashboard.summary.avgPriceCentsPerKwh)}
                    <span className="ml-1 text-xs font-medium text-slate-400">/ kWh</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* KPI cards */}
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

        {/* Session throughput + Point availability */}
        <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
          <SectionCard>
            <SectionHeader
              icon="show_chart"
              title="Session throughput"
              subtitle="Bookings and completed charging sessions over the last 7 days."
              badge={<StatBadge label="Active now" value={formatCount(dashboard.summary.activeSessions)} />}
            />
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sessionTrendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradSessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => formatCount(v)} />
                  <Tooltip content={<ChartTooltipContent formatter={formatCount} />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12, color: "#64748b", paddingTop: 8 }}
                  />
                  <Area type="monotone" dataKey="Sessions" stroke="#06b6d4" strokeWidth={2} fill="url(#gradSessions)" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#fff" }} />
                  <Area type="monotone" dataKey="Completed" stroke="#10b981" strokeWidth={2} fill="url(#gradCompleted)" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#fff" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard>
            <SectionHeader
              icon="bar_chart"
              title="Point availability mix"
              subtitle="Current fleet-wide charging point availability states."
            />
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={availabilityChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="state" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatCount(v)} />
                  <Tooltip content={<ChartTooltipContent formatter={formatCount} />} />
                  <Bar dataKey="Points" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </section>

        {/* Telemetry load + Session status */}
        <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
          <SectionCard>
            <SectionHeader
              icon="speed"
              title="Telemetry load"
              subtitle="Average and peak charging power across the last 12 hours of telemetry."
              badge={
                <StatBadge
                  label="Energy delta"
                  value={formatEnergyKwh(
                    dashboard.recentTelemetryTrend.reduce(
                      (sum, item) => sum + item.energyDeltaKwh,
                      0
                    )
                  )}
                />
              }
            />
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetryTrendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradAvgPower" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradPeakPower" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => formatPowerKw(v)} />
                  <Tooltip content={<ChartTooltipContent formatter={formatPowerKw} />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12, color: "#64748b", paddingTop: 8 }}
                  />
                  <Area type="monotone" dataKey="Average power" stroke="#6366f1" strokeWidth={2} fill="url(#gradAvgPower)" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#fff" }} />
                  <Area type="monotone" dataKey="Peak power" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradPeakPower)" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#fff" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard>
            <SectionHeader
              icon="donut_small"
              title="Session status mix"
              subtitle="Historical session lifecycle distribution in the current dataset."
            />
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionStatusChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="status" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatCount(v)} />
                  <Tooltip content={<ChartTooltipContent formatter={formatCount} />} />
                  <Bar dataKey="Sessions" fill="#0ea5e9" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </section>

        {/* Operator leaderboard + Operational health */}
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <SectionCard>
            <SectionHeader
              icon="leaderboard"
              title="Operator leaderboard"
              subtitle="Largest operators by installed footprint, with a quick utilization snapshot."
            />

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Operator</th>
                    <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Stations</th>
                    <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Points</th>
                    <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Available</th>
                    <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.topOperators.map((operator) => (
                    <tr key={operator.operator} className="border-b border-slate-100 last:border-0">
                      <td className="max-w-[18rem] py-3 pr-4">
                        <p className="text-sm font-medium text-slate-900">{operator.operator}</p>
                        <p className="text-[11px] text-slate-500">
                          Avg tariff {formatTariffCentsPerKwh(operator.avgPriceCentsPerKwh)} / kWh
                        </p>
                      </td>
                      <td className="py-3 text-right text-slate-700">
                        {formatCompactNumber(operator.stations)}
                      </td>
                      <td className="py-3 text-right text-slate-700">
                        {formatCompactNumber(operator.chargingPoints)}
                      </td>
                      <td className="py-3 text-right text-slate-700">
                        {formatCompactNumber(operator.availableNowPoints)}
                      </td>
                      <td className="py-3 text-right">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          {formatPercent(operator.utilizationPercent)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard>
            <SectionHeader
              icon="monitor_heart"
              title="Operational health"
              subtitle="Charger health states and the latest incident queue."
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {operationalChartData.map((item) => (
                <div
                  key={item.name}
                  className="rounded-xl bg-slate-50 px-4 py-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {item.name}
                  </p>
                  <p className="mt-1.5 text-xl font-semibold text-slate-900">
                    {formatCompactNumber(item.value)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2.5">
              {dashboard.recentIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className={`rounded-xl border-l-[3px] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] ${getIncidentBorderClass(incident.status)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getIncidentStatusClasses(incident.status)}`}
                        >
                          {formatLabel(incident.status)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                          {formatLabel(incident.type)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {incident.stationName ?? "Unknown station"}
                        {incident.chargingPointLabel
                          ? ` · ${incident.chargingPointLabel}`
                          : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {incident.description}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-slate-400">
                      <p>{formatLabel(incident.severity)}</p>
                      <p className="mt-0.5">{formatTimestamp(incident.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </section>

        {/* Latest charging sessions */}
        <SectionCard>
          <SectionHeader
            icon="history"
            title="Latest charging sessions"
            subtitle="Recent session updates with live commercial and operational context."
            badge={
              <StatBadge
                label="Session statuses"
                value={`${sessionStatusChartData.length} active categories`}
              />
            }
          />

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Station</th>
                  <th className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vehicle</th>
                  <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Energy</th>
                  <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Revenue</th>
                  <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Updated</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentSessions.map((session) => (
                  <tr key={session.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="text-sm font-medium text-slate-900">
                        {session.stationName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {session.chargingPointLabel}
                      </p>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${getSessionStatusClasses(session.status)}`}
                      >
                        {formatLabel(session.status)}
                      </span>
                    </td>
                    <td className="py-3 text-slate-700">{session.vehicleLabel}</td>
                    <td className="py-3 text-right text-slate-700">
                      {formatEnergyKwh(session.energyDeliveredKwh)}
                    </td>
                    <td className="py-3 text-right text-slate-700">
                      {formatCurrencyCents(session.totalCents)}
                    </td>
                    <td className="py-3 text-right text-slate-500">
                      {formatTimestamp(session.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
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
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-800"
            style={{ margin: 0 }}
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
