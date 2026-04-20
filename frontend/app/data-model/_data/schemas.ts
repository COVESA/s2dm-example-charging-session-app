export type CollectionKey =
  | "chargingStations"
  | "chargingPoints"
  | "chargingSessions"
  | "vehicles"
  | "users"
  | "incidents"
  | "telemetry";

export type CollectionMeta = {
  key: CollectionKey;
  label: string;
  description: string;
  icon: string;
  accent: {
    pill: string;
    ring: string;
    text: string;
    bg: string;
  };
};

export const COLLECTIONS: CollectionMeta[] = [
  {
    key: "chargingStations",
    label: "chargingStations",
    description:
      "Physical charging sites. Geospatial location, availability, embedded charging points.",
    icon: "ev_station",
    accent: {
      pill: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      ring: "ring-emerald-200",
      text: "text-emerald-700",
      bg: "bg-emerald-500"
    }
  },
  {
    key: "chargingPoints",
    label: "chargingPoints",
    description:
      "Individual EVSEs at a station. Operational status, connectors, pricing overrides.",
    icon: "power",
    accent: {
      pill: "bg-amber-50 text-amber-700 ring-amber-200",
      ring: "ring-amber-200",
      text: "text-amber-700",
      bg: "bg-amber-500"
    }
  },
  {
    key: "chargingSessions",
    label: "chargingSessions",
    description:
      "A booked/active/completed charge. Snapshots from station + vehicle at booking time.",
    icon: "bolt",
    accent: {
      pill: "bg-cyan-50 text-cyan-700 ring-cyan-200",
      ring: "ring-cyan-200",
      text: "text-cyan-700",
      bg: "bg-cyan-500"
    }
  },
  {
    key: "vehicles",
    label: "vehicles",
    description: "The driver's EV. Connector compatibility, battery, and charging limits.",
    icon: "directions_car",
    accent: {
      pill: "bg-sky-50 text-sky-700 ring-sky-200",
      ring: "ring-sky-200",
      text: "text-sky-700",
      bg: "bg-sky-500"
    }
  },
  {
    key: "users",
    label: "users",
    description: "Drivers and operators. Roles, preferences, login metadata.",
    icon: "person",
    accent: {
      pill: "bg-violet-50 text-violet-700 ring-violet-200",
      ring: "ring-violet-200",
      text: "text-violet-700",
      bg: "bg-violet-500"
    }
  },
  {
    key: "incidents",
    label: "incidents",
    description: "Faults or maintenance events on stations and points.",
    icon: "report",
    accent: {
      pill: "bg-rose-50 text-rose-700 ring-rose-200",
      ring: "ring-rose-200",
      text: "text-rose-700",
      bg: "bg-rose-500"
    }
  },
  {
    key: "telemetry",
    label: "telemetry",
    description:
      "High-frequency heartbeats and samples from the charging hardware (time-series).",
    icon: "timeline",
    accent: {
      pill: "bg-slate-100 text-slate-700 ring-slate-200",
      ring: "ring-slate-200",
      text: "text-slate-700",
      bg: "bg-slate-500"
    }
  }
];

export const COLLECTION_SCHEMAS: Record<CollectionKey, string> = {
  chargingStations: `{
  "bsonType": "object",
  "required": ["stationCode", "name", "location", "chargingPoints", "availability", "createdAt"],
  "additionalProperties": false,
  "properties": {
    "_id": { "bsonType": "objectId" },
    "stationCode": { "bsonType": "string" },
    "name": { "bsonType": "string" },
    "operator": { "bsonType": "string" },
    "location": {
      "bsonType": "object",
      "required": ["type", "coordinates"],
      "additionalProperties": false,
      "properties": {
        "type": { "bsonType": "string", "enum": ["Point"] },
        "coordinates": {
          "bsonType": "array",
          "items": { "bsonType": "double" },
          "minItems": 2,
          "maxItems": 2
        }
      }
    },
    "address": {
      "bsonType": "object",
      "additionalProperties": false,
      "properties": {
        "street": { "bsonType": "string" },
        "city": { "bsonType": "string" },
        "country": { "bsonType": "string" },
        "postalCode": { "bsonType": "string" }
      }
    },
    "availability": {
      "bsonType": "object",
      "additionalProperties": false,
      "properties": {
        "totalPoints": { "bsonType": "int" },
        "operationalPoints": { "bsonType": "int" },
        "availableNowPoints": { "bsonType": "int" },
        "lastComputedAt": { "bsonType": "date" }
      }
    },
    "chargingPoints": {
      "bsonType": "array",
      "items": {
        "bsonType": "object",
        "additionalProperties": false,
        "properties": {
          "chargingPointId": { "bsonType": "objectId" },
          "availableNow": { "bsonType": "bool" },
          "outOfService": { "bsonType": "bool" }
        }
      }
    },
    "createdAt": { "bsonType": "date" },
    "updatedAt": { "bsonType": "date" }
  }
}`,
  chargingPoints: `{
  "bsonType": "object",
  "required": ["stationId", "chargingPointCode", "connectors", "status", "createdAt"],
  "additionalProperties": false,
  "properties": {
    "_id": { "bsonType": "objectId" },
    "stationId": { "bsonType": "objectId" },
    "chargingPointCode": { "bsonType": "string" },
    "label": { "bsonType": "string" },
    "evseId": { "bsonType": "string" },
    "connectors": {
      "bsonType": "array",
      "items": {
        "bsonType": "object",
        "additionalProperties": false,
        "properties": {
          "type": { "bsonType": "string" },
          "current": { "bsonType": "string", "enum": ["AC", "DC"] },
          "power": { "bsonType": "double" },
          "tethered": { "bsonType": "bool" }
        }
      }
    },
    "status": {
      "bsonType": "object",
      "additionalProperties": false,
      "properties": {
        "operational": {
          "bsonType": "string",
          "enum": ["OPERATIONAL", "MAINTENANCE", "BROKEN", "OFFLINE"]
        },
        "availability": {
          "bsonType": "string",
          "enum": ["AVAILABLE", "RESERVED", "CHARGING", "OUT_OF_SERVICE"]
        },
        "updatedAt": { "bsonType": "date" }
      }
    },
    "createdAt": { "bsonType": "date" },
    "updatedAt": { "bsonType": "date" }
  }
}`,
  chargingSessions: `{
  "bsonType": "object",
  "required": [
    "userId", "vehicleId", "stationId", "chargingPointId",
    "stationSnapshot", "vehicleSnapshot", "status", "booking",
    "charging", "pricingSnapshot", "cost", "createdAt", "updatedAt"
  ],
  "additionalProperties": false,
  "properties": {
    "_id": { "bsonType": "objectId" },
    "userId": { "bsonType": "objectId" },
    "vehicleId": { "bsonType": "objectId" },
    "stationId": { "bsonType": "objectId" },
    "chargingPointId": { "bsonType": "objectId" },
    "status": {
      "bsonType": "string",
      "enum": ["BOOKED", "ACTIVE", "COMPLETED", "CANCELED", "NO_SHOW", "FAILED"]
    },
    "booking": {
      "bsonType": "object",
      "required": ["bookedAt", "expiresAt"],
      "additionalProperties": false,
      "properties": {
        "bookedAt": { "bsonType": "date" },
        "expiresAt": { "bsonType": "date" },
        "canceledAt": { "bsonType": ["date", "null"] },
        "cancelReason": { "bsonType": ["string", "null"] }
      }
    },
    "charging": {
      "bsonType": "object",
      "additionalProperties": false,
      "properties": {
        "startedAt": { "bsonType": ["date", "null"] },
        "endedAt": { "bsonType": ["date", "null"] },
        "energyDeliveredKwh": { "bsonType": ["double", "null"] },
        "socStartPercent": { "bsonType": ["double", "null"] },
        "socStopPercent": { "bsonType": ["double", "null"] }
      }
    },
    "createdAt": { "bsonType": "date" },
    "updatedAt": { "bsonType": "date" }
  }
}`,
  vehicles: `{
  "bsonType": "object",
  "required": [
    "userId", "vin", "make", "model", "year",
    "batteryCapacityKwh", "maxChargePowerKw", "connectorTypes", "createdAt"
  ],
  "additionalProperties": false,
  "properties": {
    "_id": { "bsonType": "objectId" },
    "userId": { "bsonType": "objectId" },
    "vin": { "bsonType": "string" },
    "make": { "bsonType": "string" },
    "model": { "bsonType": "string" },
    "year": { "bsonType": "int" },
    "batteryCapacityKwh": { "bsonType": "double" },
    "maxChargePowerKw": { "bsonType": "double" },
    "connectorTypes": {
      "bsonType": "array",
      "items": {
        "bsonType": "string",
        "enum": ["CCS", "CHAdeMO", "SCHUKO", "TYPE1", "TYPE2"]
      }
    },
    "createdAt": { "bsonType": "date" }
  }
}`,
  users: `{
  "bsonType": "object",
  "required": ["email", "displayName", "roles", "createdAt"],
  "additionalProperties": false,
  "properties": {
    "_id": { "bsonType": "objectId" },
    "email": { "bsonType": "string", "pattern": "^.+@.+$" },
    "displayName": { "bsonType": "string" },
    "roles": {
      "bsonType": "array",
      "items": { "bsonType": "string", "enum": ["USER", "ADMIN"] }
    },
    "createdAt": { "bsonType": "date" },
    "lastLoginAt": { "bsonType": ["date", "null"] }
  }
}`,
  incidents: `{
  "bsonType": "object",
  "required": ["type", "severity", "status", "stationId", "createdAt"],
  "additionalProperties": false,
  "properties": {
    "_id": { "bsonType": "objectId" },
    "type": {
      "bsonType": "string",
      "enum": ["NO_HEARTBEAT", "CONNECTOR_FAULT", "POWER_DERATE", "USER_REPORT", "MAINTENANCE"]
    },
    "severity": {
      "bsonType": "string",
      "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    },
    "status": {
      "bsonType": "string",
      "enum": ["OPEN", "ACKNOWLEDGED", "RESOLVED"]
    },
    "stationId": { "bsonType": "objectId" },
    "chargingPointId": { "bsonType": ["objectId", "null"] },
    "description": { "bsonType": "string" },
    "createdAt": { "bsonType": "date" },
    "updatedAt": { "bsonType": "date" }
  }
}`,
  telemetry: `{
  "bsonType": "object",
  "required": ["timestamp", "meta", "messageType"],
  "additionalProperties": true,
  "properties": {
    "_id": { "bsonType": "objectId" },
    "timestamp": { "bsonType": "date" },
    "meta": {
      "bsonType": "object",
      "additionalProperties": true,
      "properties": {
        "stationId": { "bsonType": "objectId" },
        "chargingPointId": { "bsonType": "objectId" }
      }
    },
    "messageType": {
      "bsonType": "string",
      "enum": ["HEARTBEAT", "SAMPLE", "SESSION_SAMPLE", "FAULT"]
    },
    "ok": { "bsonType": "bool" },
    "powerKw": { "bsonType": "double" },
    "energyKwhDelta": { "bsonType": "double" },
    "temperatureC": { "bsonType": "double" }
  }
}`
};
