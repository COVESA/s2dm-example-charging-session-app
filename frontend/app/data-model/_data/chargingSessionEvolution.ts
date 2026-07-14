const sharedProperties = {
  _id: { bsonType: "objectId" },
  userId: { bsonType: "objectId" },
  vehicleId: { bsonType: "objectId" },
  stationId: { bsonType: "objectId" },
  chargingPointId: { bsonType: "objectId" },
  stationSnapshot: {
    bsonType: "object",
    required: ["name", "location", "addressShort", "chargingPointLabel"],
    additionalProperties: false,
    properties: {
      name: { bsonType: "string" },
      location: {
        bsonType: "object",
        required: ["type", "coordinates"],
        additionalProperties: false,
        properties: {
          type: { bsonType: "string", enum: ["Point"] },
          coordinates: {
            bsonType: "array",
            items: { bsonType: "double" },
            minItems: 2,
            maxItems: 2
          }
        }
      },
      addressShort: { bsonType: "string" },
      chargingPointLabel: { bsonType: "string" }
    }
  },
  vehicleSnapshot: {
    bsonType: "object",
    required: ["vinLast6", "make", "model"],
    additionalProperties: false,
    properties: {
      vinLast6: { bsonType: "string" },
      make: { bsonType: "string" },
      model: { bsonType: "string" }
    }
  },
  status: {
    bsonType: "string",
    enum: ["BOOKED", "ACTIVE", "COMPLETED", "CANCELED", "NO_SHOW", "FAILED"]
  },
  booking: {
    bsonType: "object",
    required: ["bookedAt", "expiresAt", "canceledAt", "cancelReason"],
    additionalProperties: false,
    properties: {
      bookedAt: { bsonType: "date" },
      expiresAt: { bsonType: "date" },
      canceledAt: { bsonType: ["date", "null"] },
      cancelReason: { bsonType: ["string", "null"] }
    }
  },
  feedback: {
    bsonType: ["object", "null"],
    required: ["rating", "createdAt"],
    additionalProperties: false,
    properties: {
      rating: { bsonType: "int", minimum: 1, maximum: 5 },
      comment: { bsonType: ["string", "null"] },
      createdAt: { bsonType: "date" }
    }
  },
  pricingSnapshot: {
    bsonType: "object",
    required: ["currency", "priceCentsPerKwh", "idleFee"],
    additionalProperties: false,
    properties: {
      currency: { bsonType: "string" },
      priceCentsPerKwh: { bsonType: "int" },
      idleFee: {
        bsonType: "object",
        required: ["priceCentsPerMinute", "afterMinutes"],
        additionalProperties: false,
        properties: {
          priceCentsPerMinute: { bsonType: "int" },
          afterMinutes: { bsonType: "int" }
        }
      }
    }
  },
  cost: {
    bsonType: "object",
    required: ["totalCents", "energyCents", "idleCents"],
    additionalProperties: false,
    properties: {
      totalCents: { bsonType: ["int", "null"] },
      energyCents: { bsonType: ["int", "null"] },
      idleCents: { bsonType: ["int", "null"] }
    }
  },
  createdAt: { bsonType: "date" },
  updatedAt: { bsonType: "date" }
};

const connectorUsed = {
  bsonType: ["object", "null"],
  additionalProperties: false,
  properties: {
    type: { bsonType: ["string", "null"] },
    power: { bsonType: ["double", "int", "long", "decimal", "null"] },
    tethered: { bsonType: ["bool", "null"] }
  }
};

const requiredSessionFields = [
  "userId",
  "vehicleId",
  "stationId",
  "chargingPointId",
  "stationSnapshot",
  "vehicleSnapshot",
  "status",
  "booking",
  "charging",
  "pricingSnapshot",
  "cost",
  "createdAt",
  "updatedAt"
];

const v6Validator = {
  bsonType: "object",
  required: requiredSessionFields,
  additionalProperties: false,
  properties: {
    ...sharedProperties,
    schemaVersion: { bsonType: "int", enum: [6] },
    charging: {
      bsonType: "object",
      required: [
        "startedAt",
        "endedAt",
        "connectorUsed",
        "meterStartKwh",
        "meterStopKwh",
        "energyDeliveredKwh",
        "socStartPercent",
        "socStopPercent"
      ],
      additionalProperties: false,
      properties: {
        startedAt: { bsonType: ["date", "null"] },
        endedAt: { bsonType: ["date", "null"] },
        connectorUsed,
        meterStartKwh: { bsonType: ["double", "int", "long", "decimal", "null"] },
        meterStopKwh: { bsonType: ["double", "int", "long", "decimal", "null"] },
        energyDeliveredKwh: { bsonType: ["double", "int", "long", "decimal", "null"] },
        socStartPercent: { bsonType: ["double", "int", "long", "decimal", "null"] },
        socStopPercent: { bsonType: ["double", "int", "long", "decimal", "null"] }
      }
    }
  }
};

const v7Validator = {
  bsonType: "object",
  required: [...requiredSessionFields, "schemaVersion"],
  additionalProperties: false,
  properties: {
    ...sharedProperties,
    schemaVersion: { bsonType: "int", enum: [7] },
    charging: {
      bsonType: "object",
      required: [
        "startedAt",
        "endedAt",
        "connectorUsed",
        "meterStart",
        "meterStop",
        "energyDeliveredKwh",
        "socStartPercent",
        "socStopPercent"
      ],
      additionalProperties: false,
      properties: {
        startedAt: { bsonType: ["date", "null"] },
        endedAt: { bsonType: ["date", "null"] },
        connectorUsed,
        meterStart: {
          bsonType: ["double", "int", "long", "decimal", "null"],
          description: "Canonical v7 storage unit: Wh"
        },
        meterStop: {
          bsonType: ["double", "int", "long", "decimal", "null"],
          description: "Canonical v7 storage unit: Wh"
        },
        energyDeliveredKwh: {
          bsonType: ["double", "int", "long", "decimal", "null"],
          description: "Canonical storage unit: kWh"
        },
        socStartPercent: { bsonType: ["int", "null"], minimum: 0, maximum: 100 },
        socStopPercent: { bsonType: ["int", "null"], minimum: 0, maximum: 100 }
      }
    }
  }
};

export const CHARGING_SESSION_VALIDATORS = {
  v6: JSON.stringify(v6Validator, null, 2),
  v7: JSON.stringify(v7Validator, null, 2),
  combined: JSON.stringify(
    {
      bsonType: "object",
      title: "ChargingSession v6 or v7",
      oneOf: [v6Validator, v7Validator]
    },
    null,
    2
  )
} as const;

export const ADAPTATION_PAYLOADS = {
  rawV6: `{
  "charging": {
    "meterStartKwh": 10421.31,
    "meterStopKwh": 10440.03,
    "energyDeliveredKwh": 18.72,
    "socStartPercent": 19.6,
    "socStopPercent": 80.2
  }
}`,
  rawV7: `{
  "schemaVersion": 7,
  "charging": {
    "meterStart": 10421310.0,
    "meterStop": 10440030.0,
    "energyDeliveredKwh": 18.72,
    "socStartPercent": 20,
    "socStopPercent": 80
  }
}`,
  canonicalV7: `{
  "schemaVersion": 7,
  "charging": {
    "meterStart": 10421310.0,
    "meterStop": 10440030.0,
    "energyDeliveredKwh": 18.72,
    "socStartPercent": 20,
    "socStopPercent": 80
  }
}`
} as const;

export const MODL_DECISIONS = [
  {
    change: "meterStartKwh → meterStart",
    decision: "Same concept; rename then scale kWh × 1000 to canonical Wh.",
    category: "deterministic transform",
    lossiness: "none"
  },
  {
    change: "meterStopKwh → meterStop",
    decision: "Same concept; rename then scale kWh × 1000 to canonical Wh.",
    category: "deterministic transform",
    lossiness: "none"
  },
  {
    change: "soc*Percent: Float → Int",
    decision: "Contract narrows; apply the documented round policy before validation.",
    category: "policy required",
    lossiness: "possible"
  }
] as const;

export const ADAPTATION_PIPELINE = [
  "Compose the v6 and v7 modular models into released schemas.",
  "Parse both releases into the intermediate representation and diff stable concepts.",
  "Sync Concepts, Revisions, Contracts, and Bindings into the ModL ledger.",
  "Generate the adaptation report: rename → scale → round.",
  "Translate the typed steps into the target-system transformation.",
  "Validate the canonical result against chargingSessions.v7.json."
] as const;

export const MONGODB_VIEW_PIPELINE = `[
  {
    "$set": {
      "schemaVersion": 7,
      "charging": {
        "$cond": [
          { "$eq": [{ "$ifNull": ["$schemaVersion", 6] }, 7] },
          "$charging",
          {
            "startedAt": "$charging.startedAt",
            "endedAt": "$charging.endedAt",
            "connectorUsed": "$charging.connectorUsed",
            "meterStart": {
              "$cond": [
                { "$isNumber": "$charging.meterStartKwh" },
                { "$multiply": ["$charging.meterStartKwh", 1000] },
                null
              ]
            },
            "meterStop": {
              "$cond": [
                { "$isNumber": "$charging.meterStopKwh" },
                { "$multiply": ["$charging.meterStopKwh", 1000] },
                null
              ]
            },
            "energyDeliveredKwh": "$charging.energyDeliveredKwh",
            "socStartPercent": {
              "$cond": [
                { "$isNumber": "$charging.socStartPercent" },
                { "$round": ["$charging.socStartPercent", 0] },
                null
              ]
            },
            "socStopPercent": {
              "$cond": [
                { "$isNumber": "$charging.socStopPercent" },
                { "$round": ["$charging.socStopPercent", 0] },
                null
              ]
            }
          }
        ]
      }
    }
  },
  {
    "$unset": ["charging.meterStartKwh", "charging.meterStopKwh"]
  }
]`;
