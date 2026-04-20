import type { CollectionKey } from "./schemas";

export type ValidationCase = {
  label: string;
  valid: boolean;
  document: string;
  errors?: string[];
  explanation: string;
};

export const VALIDATION_EXAMPLES: Record<CollectionKey, ValidationCase[]> = {
  chargingStations: [
    {
      label: "Valid document",
      valid: true,
      document: `{
  "stationCode": "ST-BER-001",
  "name": "Alexanderplatz Hub",
  "operator": "LeafyCharge",
  "location": {
    "type": "Point",
    "coordinates": [13.4132, 52.5219]
  },
  "availability": {
    "totalPoints": 4,
    "operationalPoints": 4,
    "availableNowPoints": 2
  },
  "chargingPoints": [
    { "chargingPointId": "661d...", "availableNow": true, "outOfService": false }
  ],
  "createdAt": "2026-04-12T09:00:00Z"
}`,
      explanation:
        "All required fields are present. Location is a valid GeoJSON Point ready for a 2dsphere index."
    },
    {
      label: "Invalid: missing required, extra field",
      valid: false,
      document: `{
  "stationCode": "ST-BER-002",
  "name": "Ostbahnhof",
  "location": {
    "type": "Point",
    "coordinates": [13.43, 52.51]
  },
  "chargingPoints": [],
  "createdAt": "2026-04-12T09:00:00Z",
  "marketingTag": "grand-opening"
}`,
      errors: [
        'Missing required field: "availability".',
        'Property "marketingTag" is not allowed (additionalProperties: false).'
      ],
      explanation:
        "Stricter validators catch unknown fields before they bloat the collection and flag missing required data."
    }
  ],
  chargingPoints: [
    {
      label: "Valid document",
      valid: true,
      document: `{
  "stationId": "661d2a...",
  "chargingPointCode": "CP-001",
  "connectors": [
    { "type": "CCS", "current": "DC", "power": 150.0, "tethered": true }
  ],
  "status": {
    "operational": "OPERATIONAL",
    "availability": "AVAILABLE",
    "updatedAt": "2026-04-12T09:05:00Z"
  },
  "createdAt": "2026-04-12T09:00:00Z"
}`,
      explanation:
        "Enum values and bsonTypes match the validator. additionalProperties: false means the shape is locked down."
    },
    {
      label: "Invalid: bad enum value",
      valid: false,
      document: `{
  "stationId": "661d2a...",
  "chargingPointCode": "CP-002",
  "connectors": [
    { "type": "CCS", "current": "HVDC", "power": 350.0 }
  ],
  "status": {
    "operational": "BROKEN",
    "availability": "OFFLINE"
  },
  "createdAt": "2026-04-12T09:00:00Z"
}`,
      errors: [
        'Property "connectors[0].current": "HVDC" is not in the allowed enum ["AC", "DC"].',
        'Property "status.availability": "OFFLINE" is not in the allowed enum ["AVAILABLE", "RESERVED", "CHARGING", "OUT_OF_SERVICE"].'
      ],
      explanation:
        "Enums on the conceptual model translate directly into validator enums \u2014 the domain stays consistent end-to-end."
    }
  ],
  chargingSessions: [
    {
      label: "Valid document",
      valid: true,
      document: `{
  "userId": "aaaaaaaa...",
  "vehicleId": "bbbbbbbb...",
  "stationId": "cccccccc...",
  "chargingPointId": "dddddddd...",
  "status": "ACTIVE",
  "booking": {
    "bookedAt": "2026-04-12T09:00:00Z",
    "expiresAt": "2026-04-12T09:30:00Z"
  },
  "charging": {
    "startedAt": "2026-04-12T09:05:00Z",
    "energyDeliveredKwh": 18.4,
    "socStartPercent": 22.0,
    "socStopPercent": null
  },
  "createdAt": "2026-04-12T09:00:00Z",
  "updatedAt": "2026-04-12T09:05:30Z"
}`,
      explanation:
        "Optional fields use null explicitly; status is part of the enum; the session is mid-charge."
    },
    {
      label: "Invalid: type mismatch",
      valid: false,
      document: `{
  "userId": "aaaaaaaa...",
  "vehicleId": "bbbbbbbb...",
  "stationId": "cccccccc...",
  "chargingPointId": "dddddddd...",
  "status": "completed",
  "booking": {
    "bookedAt": "2026-04-12T09:00:00Z",
    "expiresAt": "2026-04-12T09:30:00Z"
  },
  "charging": {
    "energyDeliveredKwh": "12.3"
  },
  "createdAt": "2026-04-12T09:00:00Z",
  "updatedAt": "2026-04-12T09:05:30Z"
}`,
      errors: [
        'Property "status": "completed" (lowercase) is not in the allowed enum.',
        'Property "charging.energyDeliveredKwh": string provided, expected double.'
      ],
      explanation:
        "Type coercion is an application bug, not a MongoDB feature \u2014 the validator rejects the write so the session never lands in a wrong shape."
    }
  ],
  vehicles: [
    {
      label: "Valid document",
      valid: true,
      document: `{
  "userId": "aaaaaaaa...",
  "vin": "WBA3A5C50DF123456",
  "make": "BMW",
  "model": "i5",
  "year": 2025,
  "batteryCapacityKwh": 81.2,
  "maxChargePowerKw": 205.0,
  "connectorTypes": ["CCS", "TYPE2"],
  "createdAt": "2026-03-01T12:00:00Z"
}`,
      explanation: "Connector types belong to the shared enum; batteries modelled as double kWh."
    },
    {
      label: "Invalid: unknown connector",
      valid: false,
      document: `{
  "userId": "aaaaaaaa...",
  "vin": "WBA3A5C50DF123456",
  "make": "BMW",
  "model": "i5",
  "year": 2025,
  "batteryCapacityKwh": 81.2,
  "maxChargePowerKw": 205.0,
  "connectorTypes": ["MAGIC_PLUG"],
  "createdAt": "2026-03-01T12:00:00Z"
}`,
      errors: [
        'Property "connectorTypes[0]": "MAGIC_PLUG" is not in the allowed enum ["CCS", "CHAdeMO", "SCHUKO", "TYPE1", "TYPE2"].'
      ],
      explanation:
        "The controlled vocabulary lives in one place. Adding a new connector means a model release, not a code patch in each service."
    }
  ],
  users: [
    {
      label: "Valid document",
      valid: true,
      document: `{
  "email": "rami@example.com",
  "displayName": "Rami",
  "roles": ["USER"],
  "createdAt": "2026-01-10T08:00:00Z"
}`,
      explanation: "Pattern validation on email passes; role enum respected."
    },
    {
      label: "Invalid: bad email pattern",
      valid: false,
      document: `{
  "email": "not-an-email",
  "displayName": "Rami",
  "roles": ["SUPERADMIN"],
  "createdAt": "2026-01-10T08:00:00Z"
}`,
      errors: [
        'Property "email": "not-an-email" does not match pattern "^.+@.+$".',
        'Property "roles[0]": "SUPERADMIN" is not in the allowed enum ["USER", "ADMIN"].'
      ],
      explanation:
        "Regex patterns and enums can be enforced at write time, so downstream services don\u2019t have to re-validate the same constraints."
    }
  ],
  incidents: [
    {
      label: "Valid document",
      valid: true,
      document: `{
  "type": "CONNECTOR_FAULT",
  "severity": "HIGH",
  "status": "OPEN",
  "stationId": "cccccccc...",
  "chargingPointId": "dddddddd...",
  "description": "CCS plug latch unresponsive.",
  "createdAt": "2026-04-12T10:15:00Z"
}`,
      explanation: "Clear incident modelling: type + severity + status all come from the shared enums."
    },
    {
      label: "Invalid: wrong severity",
      valid: false,
      document: `{
  "type": "CONNECTOR_FAULT",
  "severity": "MILD",
  "status": "OPEN",
  "stationId": "cccccccc...",
  "createdAt": "2026-04-12T10:15:00Z"
}`,
      errors: [
        'Property "severity": "MILD" is not in the allowed enum ["LOW", "MEDIUM", "HIGH", "CRITICAL"].'
      ],
      explanation:
        "Even casual naming drift across services gets caught at the edge of the database."
    }
  ],
  telemetry: [
    {
      label: "Valid heartbeat",
      valid: true,
      document: `{
  "timestamp": "2026-04-12T10:00:00Z",
  "meta": {
    "stationId": "cccccccc...",
    "chargingPointId": "dddddddd..."
  },
  "messageType": "HEARTBEAT",
  "ok": true,
  "temperatureC": 41.5
}`,
      explanation:
        "Telemetry allows additionalProperties: true \u2014 hardware vendors can include extra signals without breaking writes."
    },
    {
      label: "Invalid: bad messageType",
      valid: false,
      document: `{
  "timestamp": "2026-04-12T10:00:00Z",
  "meta": { "stationId": "cccccccc..." },
  "messageType": "PING",
  "powerKw": 3.2
}`,
      errors: [
        'Property "messageType": "PING" is not in the allowed enum ["HEARTBEAT", "SAMPLE", "SESSION_SAMPLE", "FAULT"].'
      ],
      explanation:
        "Even on flexible time-series collections, the validator protects the small set of fields you rely on for indexing and queries."
    }
  ]
};
