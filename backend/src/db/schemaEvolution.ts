import type { Db, Document } from "mongodb";

export const CHARGING_SESSIONS_COLLECTION = "chargingSessions";
export const CHARGING_SESSIONS_CANONICAL_VIEW =
  process.env.CHARGING_SESSIONS_CANONICAL_VIEW ?? "chargingSessions_v7";

const nullable = (bsonType: string) => ({ bsonType: [bsonType, "null"] });
const nullableNumber = () => ({
  bsonType: ["double", "int", "long", "decimal", "null"]
});

const connectorUsed = {
  bsonType: ["object", "null"],
  additionalProperties: false,
  properties: {
    type: nullable("string"),
    power: nullableNumber(),
    tethered: nullable("bool")
  }
};

const chargingV6 = {
  bsonType: "object",
  additionalProperties: false,
  properties: {
    startedAt: nullable("date"),
    endedAt: nullable("date"),
    connectorUsed,
    meterStartKwh: nullableNumber(),
    meterStopKwh: nullableNumber(),
    energyDeliveredKwh: nullableNumber(),
    socStartPercent: { ...nullableNumber(), minimum: 0, maximum: 100 },
    socStopPercent: { ...nullableNumber(), minimum: 0, maximum: 100 }
  }
};

const chargingV7 = {
  bsonType: "object",
  additionalProperties: false,
  properties: {
    startedAt: nullable("date"),
    endedAt: nullable("date"),
    connectorUsed,
    meterStart: nullableNumber(),
    meterStop: nullableNumber(),
    energyDeliveredKwh: nullableNumber(),
    socStartPercent: { ...nullable("int"), minimum: 0, maximum: 100 },
    socStopPercent: { ...nullable("int"), minimum: 0, maximum: 100 }
  }
};

export const chargingSessionsValidator: Document = {
  $jsonSchema: {
    bsonType: "object",
    required: [
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
    ],
    additionalProperties: false,
    properties: {
      _id: { bsonType: "objectId" },
      schemaVersion: {
        bsonType: "int",
        enum: [6, 7],
        description: "Missing means legacy v6."
      },
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
          canceledAt: nullable("date"),
          cancelReason: nullable("string")
        }
      },
      charging: { bsonType: "object" },
      feedback: {
        bsonType: ["object", "null"],
        additionalProperties: false,
        required: ["rating", "createdAt"],
        properties: {
          rating: { bsonType: "int", minimum: 1, maximum: 5 },
          comment: nullable("string"),
          createdAt: { bsonType: "date" }
        }
      },
      pricingSnapshot: {
        bsonType: "object",
        additionalProperties: false,
        properties: {
          currency: { bsonType: "string" },
          priceCentsPerKwh: { bsonType: "int" },
          idleFee: {
            bsonType: "object",
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
        additionalProperties: false,
        properties: {
          totalCents: nullable("int"),
          energyCents: nullable("int"),
          idleCents: nullable("int")
        }
      },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" }
    },
    oneOf: [
      {
        title: "ChargingSession v6 (schemaVersion absent or 6)",
        properties: {
          schemaVersion: { bsonType: "int", enum: [6] },
          charging: chargingV6
        }
      },
      {
        title: "ChargingSession v7",
        required: ["schemaVersion"],
        properties: {
          schemaVersion: { bsonType: "int", enum: [7] },
          charging: chargingV7
        }
      }
    ]
  }
};

const scaleKwhToWh = (field: string): Document => ({
  $cond: [
    { $isNumber: field },
    { $multiply: [field, 1000] },
    null
  ]
});

const roundSoc = (field: string): Document => ({
  $cond: [
    { $isNumber: field },
    { $round: [field, 0] },
    null
  ]
});

/**
 * Canonical v7 read projection generated from the ModL adaptation recipe:
 * rename meter fields, scale kWh to Wh, and round fractional SoC values.
 */
export const chargingSessionsV7Pipeline: Document[] = [
  {
    $set: {
      schemaVersion: 7,
      charging: {
        $cond: [
          { $eq: [{ $ifNull: ["$schemaVersion", 6] }, 7] },
          "$charging",
          {
            startedAt: "$charging.startedAt",
            endedAt: "$charging.endedAt",
            connectorUsed: "$charging.connectorUsed",
            meterStart: scaleKwhToWh("$charging.meterStartKwh"),
            meterStop: scaleKwhToWh("$charging.meterStopKwh"),
            energyDeliveredKwh: "$charging.energyDeliveredKwh",
            socStartPercent: roundSoc("$charging.socStartPercent"),
            socStopPercent: roundSoc("$charging.socStopPercent")
          }
        ]
      }
    }
  },
  {
    $unset: ["charging.meterStartKwh", "charging.meterStopKwh"]
  }
];

export async function ensureChargingSessionEvolutionArtifacts(db: Db): Promise<void> {
  const sourceCollection = await db
    .listCollections({ name: CHARGING_SESSIONS_COLLECTION }, { nameOnly: true })
    .next();

  if (sourceCollection) {
    await db.command({
      collMod: CHARGING_SESSIONS_COLLECTION,
      validator: chargingSessionsValidator,
      validationLevel: "strict",
      validationAction: "error"
    });
  } else {
    await db.createCollection(CHARGING_SESSIONS_COLLECTION, {
      validator: chargingSessionsValidator,
      validationLevel: "strict",
      validationAction: "error"
    });
  }

  const existingView = await db
    .listCollections({ name: CHARGING_SESSIONS_CANONICAL_VIEW }, { nameOnly: false })
    .next();

  if (existingView) {
    await db.command({
      collMod: CHARGING_SESSIONS_CANONICAL_VIEW,
      viewOn: CHARGING_SESSIONS_COLLECTION,
      pipeline: chargingSessionsV7Pipeline
    });
    return;
  }

  await db.createCollection(CHARGING_SESSIONS_CANONICAL_VIEW, {
    viewOn: CHARGING_SESSIONS_COLLECTION,
    pipeline: chargingSessionsV7Pipeline
  });
}
