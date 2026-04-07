import type { Db } from "mongodb";

import type { ChargingSessionDoc } from "./chargingSessions";

const RECENT_ACTIVITY_DAYS = 7;
const RECENT_TELEMETRY_HOURS = 12;
const RECENT_SESSION_LIMIT = 6;
const RECENT_INCIDENT_LIMIT = 5;
const TOP_OPERATOR_LIMIT = 5;

const SESSION_STATUS_ORDER = [
  "ACTIVE",
  "BOOKED",
  "COMPLETED",
  "CANCELED",
  "NO_SHOW",
  "FAILED"
] as const;

const POINT_OPERATIONAL_ORDER = [
  "OPERATIONAL",
  "MAINTENANCE",
  "BROKEN",
  "OFFLINE"
] as const;

const POINT_AVAILABILITY_ORDER = [
  "AVAILABLE",
  "CHARGING",
  "RESERVED",
  "OUT_OF_SERVICE"
] as const;

type BreakdownItem = {
  label: string;
  value: number;
};

export type AdminDashboardSummarySnapshot = {
  totalStations: number;
  totalChargingPoints: number;
  operationalPoints: number;
  availableNowPoints: number;
  chargingPointsInUse: number;
  reservedPoints: number;
  outOfServicePoints: number;
  activeSessions: number;
  completedSessionsLast7Days: number;
  revenueLast7DaysCents: number;
  energyLast7DaysKwh: number;
  openIncidents: number;
  avgPriceCentsPerKwh: number;
};

export type AdminDashboardTrendPointSnapshot = {
  bucket: string;
  sessions: number;
  completedSessions: number;
  revenueCents: number;
  energyKwh: number;
};

export type AdminTelemetryTrendPointSnapshot = {
  bucket: string;
  sampleCount: number;
  avgPowerKw: number;
  maxPowerKw: number;
  energyDeltaKwh: number;
};

export type AdminOperatorPerformanceSnapshot = {
  operator: string;
  stations: number;
  chargingPoints: number;
  availableNowPoints: number;
  utilizationPercent: number;
  avgPriceCentsPerKwh: number;
};

export type AdminRecentSessionSnapshot = {
  id: string;
  stationName: string;
  chargingPointLabel: string;
  vehicleLabel: string;
  status: ChargingSessionDoc["status"];
  startedAt: string | null;
  endedAt: string | null;
  energyDeliveredKwh: number | null;
  totalCents: number | null;
  updatedAt: string;
};

export type AdminRecentIncidentSnapshot = {
  id: string;
  type:
    | "USER_REPORT"
    | "NO_HEARTBEAT"
    | "CONNECTOR_FAULT"
    | "POWER_DERATE"
    | "MAINTENANCE";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  stationName: string | null;
  chargingPointLabel: string | null;
  description: string;
  createdAt: string;
};

export type AdminDashboardSnapshot = {
  summary: AdminDashboardSummarySnapshot;
  sessionStatusBreakdown: BreakdownItem[];
  pointOperationalBreakdown: BreakdownItem[];
  pointAvailabilityBreakdown: BreakdownItem[];
  recentSessionTrend: AdminDashboardTrendPointSnapshot[];
  recentTelemetryTrend: AdminTelemetryTrendPointSnapshot[];
  topOperators: AdminOperatorPerformanceSnapshot[];
  recentSessions: AdminRecentSessionSnapshot[];
  recentIncidents: AdminRecentIncidentSnapshot[];
};

function getRecentActivityCutoff(): Date {
  return new Date(Date.now() - RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1000);
}

function getRecentTelemetryCutoff(): Date {
  return new Date(Date.now() - RECENT_TELEMETRY_HOURS * 60 * 60 * 1000);
}

function roundTo(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeBreakdown(
  rawItems: Array<{ label?: string | null; value?: number | null }>,
  order: readonly string[]
): BreakdownItem[] {
  const values = new Map(
    rawItems.map((item) => [item.label ?? "", normalizeNumber(item.value)])
  );

  return order.map((label) => ({
    label,
    value: values.get(label) ?? 0
  }));
}

async function getStationSummary(
  database: Db
): Promise<Pick<
  AdminDashboardSummarySnapshot,
  "totalStations" | "totalChargingPoints" | "operationalPoints" | "availableNowPoints" | "avgPriceCentsPerKwh"
>> {
  const [doc] = await database
    .collection("chargingStations")
    .aggregate<{
      totalStations: number;
      totalChargingPoints: number;
      operationalPoints: number;
      availableNowPoints: number;
      avgPriceCentsPerKwh: number | null;
    }>([
      {
        $group: {
          _id: null,
          totalStations: { $sum: 1 },
          totalChargingPoints: { $sum: { $ifNull: ["$availability.totalPoints", 0] } },
          operationalPoints: { $sum: { $ifNull: ["$availability.operationalPoints", 0] } },
          availableNowPoints: { $sum: { $ifNull: ["$availability.availableNowPoints", 0] } },
          avgPriceCentsPerKwh: { $avg: "$pricing.defaultTariff.priceCentsPerKwh" }
        }
      },
      {
        $project: {
          _id: 0,
          totalStations: 1,
          totalChargingPoints: 1,
          operationalPoints: 1,
          availableNowPoints: 1,
          avgPriceCentsPerKwh: 1
        }
      }
    ])
    .toArray();

  return {
    totalStations: normalizeNumber(doc?.totalStations),
    totalChargingPoints: normalizeNumber(doc?.totalChargingPoints),
    operationalPoints: normalizeNumber(doc?.operationalPoints),
    availableNowPoints: normalizeNumber(doc?.availableNowPoints),
    avgPriceCentsPerKwh: roundTo(normalizeNumber(doc?.avgPriceCentsPerKwh))
  };
}

async function getPointBreakdowns(database: Db): Promise<{
  pointOperationalBreakdown: BreakdownItem[];
  pointAvailabilityBreakdown: BreakdownItem[];
}> {
  const [doc] = await database
    .collection("chargingPoints")
    .aggregate<{
      operational: Array<{ label: string; value: number }>;
      availability: Array<{ label: string; value: number }>;
    }>([
      {
        $facet: {
          operational: [
            {
              $group: {
                _id: "$status.operational",
                value: { $sum: 1 }
              }
            },
            {
              $project: {
                _id: 0,
                label: "$_id",
                value: 1
              }
            }
          ],
          availability: [
            {
              $group: {
                _id: "$status.availability",
                value: { $sum: 1 }
              }
            },
            {
              $project: {
                _id: 0,
                label: "$_id",
                value: 1
              }
            }
          ]
        }
      }
    ])
    .toArray();

  return {
    pointOperationalBreakdown: normalizeBreakdown(
      doc?.operational ?? [],
      POINT_OPERATIONAL_ORDER
    ),
    pointAvailabilityBreakdown: normalizeBreakdown(
      doc?.availability ?? [],
      POINT_AVAILABILITY_ORDER
    )
  };
}

async function getSessionMetrics(database: Db): Promise<{
  sessionStatusBreakdown: BreakdownItem[];
  recentSessionTrend: AdminDashboardTrendPointSnapshot[];
  activeSessions: number;
  completedSessionsLast7Days: number;
  revenueLast7DaysCents: number;
  energyLast7DaysKwh: number;
}> {
  const recentCutoff = getRecentActivityCutoff();

  const [doc] = await database
    .collection<ChargingSessionDoc>("chargingSessions")
    .aggregate<{
      sessionStatusBreakdown: Array<{ label: string; value: number }>;
      summary: Array<{
        activeSessions: number;
        completedSessionsLast7Days: number;
        revenueLast7DaysCents: number;
        energyLast7DaysKwh: number;
      }>;
      recentSessionTrend: Array<{
        bucket: string;
        sessions: number;
        completedSessions: number;
        revenueCents: number;
        energyKwh: number;
      }>;
    }>([
      {
        $set: {
          activityAt: {
            $ifNull: ["$charging.endedAt", "$updatedAt"]
          }
        }
      },
      {
        $facet: {
          sessionStatusBreakdown: [
            {
              $group: {
                _id: "$status",
                value: { $sum: 1 }
              }
            },
            {
              $project: {
                _id: 0,
                label: "$_id",
                value: 1
              }
            }
          ],
          summary: [
            {
              $group: {
                _id: null,
                activeSessions: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0]
                  }
                },
                completedSessionsLast7Days: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$status", "COMPLETED"] },
                          { $gte: ["$activityAt", recentCutoff] }
                        ]
                      },
                      1,
                      0
                    ]
                  }
                },
                revenueLast7DaysCents: {
                  $sum: {
                    $cond: [
                      { $gte: ["$activityAt", recentCutoff] },
                      { $ifNull: ["$cost.totalCents", 0] },
                      0
                    ]
                  }
                },
                energyLast7DaysKwh: {
                  $sum: {
                    $cond: [
                      { $gte: ["$activityAt", recentCutoff] },
                      { $ifNull: ["$charging.energyDeliveredKwh", 0] },
                      0
                    ]
                  }
                }
              }
            }
          ],
          recentSessionTrend: [
            {
              $match: {
                activityAt: { $gte: recentCutoff }
              }
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$activityAt"
                  }
                },
                sessions: { $sum: 1 },
                completedSessions: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0]
                  }
                },
                revenueCents: { $sum: { $ifNull: ["$cost.totalCents", 0] } },
                energyKwh: { $sum: { $ifNull: ["$charging.energyDeliveredKwh", 0] } }
              }
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                bucket: "$_id",
                sessions: 1,
                completedSessions: 1,
                revenueCents: 1,
                energyKwh: 1
              }
            }
          ]
        }
      }
    ])
    .toArray();

  const summary = doc?.summary?.[0];

  return {
    sessionStatusBreakdown: normalizeBreakdown(
      doc?.sessionStatusBreakdown ?? [],
      SESSION_STATUS_ORDER
    ),
    recentSessionTrend: (doc?.recentSessionTrend ?? []).map((item) => ({
      bucket: item.bucket,
      sessions: normalizeNumber(item.sessions),
      completedSessions: normalizeNumber(item.completedSessions),
      revenueCents: normalizeNumber(item.revenueCents),
      energyKwh: roundTo(normalizeNumber(item.energyKwh), 3)
    })),
    activeSessions: normalizeNumber(summary?.activeSessions),
    completedSessionsLast7Days: normalizeNumber(summary?.completedSessionsLast7Days),
    revenueLast7DaysCents: normalizeNumber(summary?.revenueLast7DaysCents),
    energyLast7DaysKwh: roundTo(normalizeNumber(summary?.energyLast7DaysKwh), 3)
  };
}

async function getTopOperators(
  database: Db
): Promise<AdminOperatorPerformanceSnapshot[]> {
  const docs = await database
    .collection("chargingStations")
    .aggregate<{
      operator: string;
      stations: number;
      chargingPoints: number;
      availableNowPoints: number;
      avgPriceCentsPerKwh: number | null;
    }>([
      {
        $group: {
          _id: {
            $ifNull: ["$operator", "Independent Operator"]
          },
          stations: { $sum: 1 },
          chargingPoints: { $sum: { $ifNull: ["$availability.totalPoints", 0] } },
          availableNowPoints: { $sum: { $ifNull: ["$availability.availableNowPoints", 0] } },
          avgPriceCentsPerKwh: { $avg: "$pricing.defaultTariff.priceCentsPerKwh" }
        }
      },
      { $sort: { stations: -1, chargingPoints: -1 } },
      { $limit: TOP_OPERATOR_LIMIT },
      {
        $project: {
          _id: 0,
          operator: "$_id",
          stations: 1,
          chargingPoints: 1,
          availableNowPoints: 1,
          avgPriceCentsPerKwh: 1
        }
      }
    ])
    .toArray();

  return docs.map((doc) => {
    const chargingPoints = normalizeNumber(doc.chargingPoints);
    const availableNowPoints = normalizeNumber(doc.availableNowPoints);
    const inUseOrReservedPoints = Math.max(chargingPoints - availableNowPoints, 0);

    return {
      operator: doc.operator,
      stations: normalizeNumber(doc.stations),
      chargingPoints,
      availableNowPoints,
      utilizationPercent:
        chargingPoints > 0
          ? roundTo((inUseOrReservedPoints / chargingPoints) * 100)
          : 0,
      avgPriceCentsPerKwh: roundTo(normalizeNumber(doc.avgPriceCentsPerKwh))
    };
  });
}

async function getRecentSessions(
  database: Db
): Promise<AdminRecentSessionSnapshot[]> {
  const docs = await database
    .collection<ChargingSessionDoc>("chargingSessions")
    .find(
      {},
      {
        projection: {
          stationSnapshot: 1,
          vehicleSnapshot: 1,
          status: 1,
          charging: 1,
          cost: 1,
          updatedAt: 1
        }
      }
    )
    .sort({ updatedAt: -1, _id: -1 })
    .limit(RECENT_SESSION_LIMIT)
    .toArray();

  return docs.map((doc) => ({
    id: String(doc._id),
    stationName: doc.stationSnapshot.name,
    chargingPointLabel: doc.stationSnapshot.chargingPointLabel,
    vehicleLabel: `${doc.vehicleSnapshot.make} ${doc.vehicleSnapshot.model} · ${doc.vehicleSnapshot.vinLast6}`,
    status: doc.status,
    startedAt: doc.charging.startedAt?.toISOString() ?? null,
    endedAt: doc.charging.endedAt?.toISOString() ?? null,
    energyDeliveredKwh: doc.charging.energyDeliveredKwh ?? null,
    totalCents: doc.cost.totalCents ?? null,
    updatedAt: doc.updatedAt.toISOString()
  }));
}

async function getRecentIncidents(
  database: Db
): Promise<AdminRecentIncidentSnapshot[]> {
  const docs = await database
    .collection("incidents")
    .aggregate<{
      _id: unknown;
      type: AdminRecentIncidentSnapshot["type"];
      severity: AdminRecentIncidentSnapshot["severity"];
      status: AdminRecentIncidentSnapshot["status"];
      stationName?: string | null;
      chargingPointLabel?: string | null;
      description: string;
      createdAt: Date;
    }>([
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: RECENT_INCIDENT_LIMIT },
      {
        $lookup: {
          from: "chargingStations",
          localField: "stationId",
          foreignField: "_id",
          as: "station"
        }
      },
      {
        $lookup: {
          from: "chargingPoints",
          localField: "chargingPointId",
          foreignField: "_id",
          as: "chargingPoint"
        }
      },
      {
        $project: {
          type: 1,
          severity: 1,
          status: 1,
          description: 1,
          createdAt: 1,
          stationName: { $first: "$station.name" },
          chargingPointLabel: { $first: "$chargingPoint.label" }
        }
      }
    ])
    .toArray();

  return docs.map((doc) => ({
    id: String(doc._id),
    type: doc.type,
    severity: doc.severity,
    status: doc.status,
    stationName: doc.stationName ?? null,
    chargingPointLabel: doc.chargingPointLabel ?? null,
    description: doc.description,
    createdAt: doc.createdAt.toISOString()
  }));
}

async function countOpenIncidents(database: Db): Promise<number> {
  return database.collection("incidents").countDocuments({ status: "OPEN" });
}

async function getTelemetryTrend(
  database: Db
): Promise<AdminTelemetryTrendPointSnapshot[]> {
  const recentCutoff = getRecentTelemetryCutoff();

  const docs = await database
    .collection("telemetry")
    .aggregate<{
      bucket: string;
      sampleCount: number;
      avgPowerKw: number | null;
      maxPowerKw: number | null;
      energyDeltaKwh: number | null;
    }>([
      {
        $match: {
          timestamp: { $gte: recentCutoff }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d %H:00",
              date: "$timestamp"
            }
          },
          sampleCount: { $sum: 1 },
          avgPowerKw: { $avg: "$powerKw" },
          maxPowerKw: { $max: "$powerKw" },
          energyDeltaKwh: { $sum: { $ifNull: ["$energyKwhDelta", 0] } }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          bucket: "$_id",
          sampleCount: 1,
          avgPowerKw: 1,
          maxPowerKw: 1,
          energyDeltaKwh: 1
        }
      }
    ])
    .toArray();

  return docs.map((doc) => ({
    bucket: doc.bucket,
    sampleCount: normalizeNumber(doc.sampleCount),
    avgPowerKw: roundTo(normalizeNumber(doc.avgPowerKw), 2),
    maxPowerKw: roundTo(normalizeNumber(doc.maxPowerKw), 2),
    energyDeltaKwh: roundTo(normalizeNumber(doc.energyDeltaKwh), 3)
  }));
}

export async function getAdminDashboardSnapshot(
  database: Db
): Promise<AdminDashboardSnapshot> {
  const [
    stationSummary,
    pointBreakdowns,
    sessionMetrics,
    topOperators,
    recentSessions,
    recentIncidents,
    openIncidents,
    recentTelemetryTrend
  ] = await Promise.all([
    getStationSummary(database),
    getPointBreakdowns(database),
    getSessionMetrics(database),
    getTopOperators(database),
    getRecentSessions(database),
    getRecentIncidents(database),
    countOpenIncidents(database),
    getTelemetryTrend(database)
  ]);

  const chargingPointsInUse =
    pointBreakdowns.pointAvailabilityBreakdown.find((item) => item.label === "CHARGING")
      ?.value ?? 0;
  const reservedPoints =
    pointBreakdowns.pointAvailabilityBreakdown.find((item) => item.label === "RESERVED")
      ?.value ?? 0;
  const outOfServicePoints =
    pointBreakdowns.pointAvailabilityBreakdown.find(
      (item) => item.label === "OUT_OF_SERVICE"
    )?.value ?? 0;

  return {
    summary: {
      ...stationSummary,
      chargingPointsInUse,
      reservedPoints,
      outOfServicePoints,
      activeSessions: sessionMetrics.activeSessions,
      completedSessionsLast7Days: sessionMetrics.completedSessionsLast7Days,
      revenueLast7DaysCents: sessionMetrics.revenueLast7DaysCents,
      energyLast7DaysKwh: sessionMetrics.energyLast7DaysKwh,
      openIncidents
    },
    sessionStatusBreakdown: sessionMetrics.sessionStatusBreakdown,
    pointOperationalBreakdown: pointBreakdowns.pointOperationalBreakdown,
    pointAvailabilityBreakdown: pointBreakdowns.pointAvailabilityBreakdown,
    recentSessionTrend: sessionMetrics.recentSessionTrend,
    recentTelemetryTrend,
    topOperators,
    recentSessions,
    recentIncidents
  };
}
