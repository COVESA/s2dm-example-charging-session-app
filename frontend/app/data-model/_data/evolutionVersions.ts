import { CHARGING_SESSION_VALIDATORS } from "./chargingSessionEvolution";

export type VersionKey = "v3" | "v4" | "v5" | "v6" | "v7";

export type EvolutionVersion = {
  key: VersionKey;
  label: string;
  title: string;
  tagline: string;
  appGraphql: string;
  appNarrative: string[];
  dbJsonSchema: string;
  dbFilename: string;
  dbNarrative: string[];
  highlightsAdded: string[];
  highlightsDeprecated: string[];
};

export const VERSIONS: EvolutionVersion[] = [
  {
    key: "v3",
    label: "v3",
    title: "Minimal baseline",
    tagline: "Only the fields every consumer needs.",
    appGraphql: `type ChargingStation {
  id: ID!
  name: String!
  chargingPoints: [ChargingPointInfo!]!
}

type ChargingPointInfo {
  id: ID!
  availableNow: Boolean!
  connectors: [ConnectorInfo!]!
}

type ConnectorInfo {
  type: ConnectorType!
}`,
    appNarrative: [
      "First cut of the shared model: just the concepts two consumers must agree on.",
      "Purely descriptive \u2014 no API decisions baked in yet."
    ],
    dbJsonSchema: `{
  "bsonType": "object",
  "required": ["id", "name", "chargingPoints"],
  "properties": {
    "id": { "bsonType": "objectId" },
    "name": { "bsonType": "string" },
    "chargingPoints": {
      "bsonType": "array",
      "items": {
        "bsonType": "object",
        "required": ["id", "availableNow", "connectors"],
        "properties": {
          "id": { "bsonType": "objectId" },
          "availableNow": { "bsonType": "bool" },
          "connectors": {
            "bsonType": "array",
            "items": {
              "bsonType": "object",
              "required": ["type"],
              "properties": {
                "type": {
                  "bsonType": "string",
                  "enum": ["CCS", "CHAdeMO", "SCHUKO", "TYPE1", "TYPE2"]
                }
              }
            }
          }
        }
      }
    }
  }
}`,
    dbFilename: "chargingStations.json",
    dbNarrative: [
      "Validator starts permissive: additionalProperties allowed so we can grow without breaking writes.",
      "Applied at validationLevel: moderate + validationAction: warn while data is still shifting."
    ],
    highlightsAdded: ["ChargingStation", "ChargingPointInfo", "ConnectorInfo"],
    highlightsDeprecated: []
  },
  {
    key: "v4",
    label: "v4",
    title: "Richer domain + geospatial",
    tagline: "New fields, new directive, old type gracefully deprecated.",
    appGraphql: `directive @geoPoint(shape: GeoPointShape!) on FIELD_DEFINITION

scalar GeoJSON @specifiedBy(url: "https://the-guild.dev/graphql/scalars/docs/scalars/geo-json")

type ChargingStation {
  id: ID!
  name: String!
  operator: String!
  stationCode: String!
  location: GeoJSON! @geoPoint(shape: POINT)
  address: Address
  availability: StationAvailability!
  chargingPoints: [ChargingPointInfo!]!
}

type ChargingPointInfo {
  id: ID!
  availableNow: Boolean!
  outOfService: Boolean!
  connectors: [ConnectorInfo!]!
}

type ConnectorInfo {
  type: ConnectorType!
  powerKw: Float!
  tethered: Boolean
}

"""
This type is deprecated and will be removed in a future version.
Use the scalar 'GeoJSON' with the directive @geoPoint instead.
"""
type GeoPoint {
  lat: Float! @deprecated(reason: "Use GeoJSON with @geoPoint(shape: POINT)")
  lng: Float! @deprecated(reason: "Use GeoJSON with @geoPoint(shape: POINT)")
}`,
    appNarrative: [
      "ChargingStation grows: operator, stationCode, address, availability, location.",
      "location switches from a bespoke GeoPoint to the GeoJSON scalar \u2014 interoperable and Mongo 2dsphere-ready.",
      "Old GeoPoint stays around with @deprecated(reason: ...) so existing clients keep working during the rollout."
    ],
    dbJsonSchema: `{
  "bsonType": "object",
  "required": ["id", "name", "operator", "stationCode", "location", "availability", "chargingPoints"],
  "properties": {
    "id": { "bsonType": "objectId" },
    "name": { "bsonType": "string" },
    "operator": { "bsonType": "string" },
    "stationCode": { "bsonType": "string" },
    "location": {
      "bsonType": "object",
      "required": ["type", "coordinates"],
      "properties": {
        "type": { "bsonType": "string" },
        "coordinates": { "bsonType": "array" }
      }
    },
    "availability": {
      "bsonType": "object",
      "required": ["totalPoints", "availableNowPoints", "operationalPoints"],
      "properties": {
        "totalPoints": { "bsonType": "int" },
        "availableNowPoints": { "bsonType": "int" },
        "operationalPoints": { "bsonType": "int" }
      }
    },
    "chargingPoints": { "bsonType": "array" }
  }
}`,
    dbFilename: "chargingStations.json",
    dbNarrative: [
      "New required fields added at the validator level. Raise them in two steps so existing docs aren\u2019t rejected mid-rollout.",
      "Step 1 \u2014 add fields as optional, start writing v4 docs. Step 2 \u2014 backfill v3 docs, then add the new names to required.",
      "A schemaVersion field on each document makes the versioning pattern explicit; queries can filter by version during the transition."
    ],
    highlightsAdded: [
      "operator",
      "stationCode",
      "location: GeoJSON",
      "address",
      "availability",
      "outOfService",
      "powerKw",
      "tethered"
    ],
    highlightsDeprecated: ["GeoPoint.lat", "GeoPoint.lng"]
  },
  {
    key: "v5",
    label: "v5",
    title: "Reuse of external vocabularies",
    tagline: "Same app schema, plus QUDT units pulled in by @reference.",
    appGraphql: `directive @reference(uri: String!) on FIELD_DEFINITION | OBJECT | ENUM | ENUM_VALUE | SCALAR

# The curated app model stays the same as v4.
type ChargingPointInfo {
  id: ID!
  availableNow: Boolean!
  outOfService: Boolean!
  connectors: [ConnectorInfo!]!
}

type ConnectorInfo {
  type: ConnectorType!
  powerKw: Float!
    @reference(uri: "http://qudt.org/vocab/quantitykind/Power")
  tethered: Boolean
}

# QUDT power-unit enum reused as-is from the COVESA vocabulary.
enum PowerUnit @reference(uri: "http://qudt.org/vocab/quantitykind/Power") {
  """Kilowatt | UCUM: kW"""
  KILOWATT @reference(uri: "http://qudt.org/vocab/unit/KILOWATT")

  """Megawatt | UCUM: MW"""
  MEGAWATT @reference(uri: "http://qudt.org/vocab/unit/MEGAWATT")
  # ... thousands more unit enums pulled in from the shared vocabulary
}`,
    appNarrative: [
      "The composed GraphQL artifact grows ~500\u00d7 because we now import the QUDT unit vocabulary via @reference.",
      "The curated app schema doesn\u2019t change \u2014 the new types/enums live alongside, available for resolvers and clients that need them.",
      "Every concept now carries a URI pointing at an authoritative external definition: shared meaning across organisations, not just within this demo."
    ],
    dbJsonSchema: `{
  "bsonType": "object",
  "properties": {
    "connectors": {
      "bsonType": "array",
      "items": {
        "bsonType": "object",
        "required": ["type", "powerKw"],
        "properties": {
          "type": { "bsonType": "string" },
          "powerKw": {
            "bsonType": "double",
            "description": "Power in kilowatts. See http://qudt.org/vocab/unit/KILOWATT"
          },
          "tethered": { "bsonType": ["bool", "null"] }
        }
      }
    }
  }
}`,
    dbFilename: "chargingStations.json",
    dbNarrative: [
      "Storage stays lean: we don\u2019t materialise thousands of unit enums in Mongo.",
      "Descriptions on the validator carry the reference URIs so operators can see the authoritative units.",
      "Values continue to be stored in a single canonical unit (kW); conversions happen at the edges."
    ],
    highlightsAdded: ["PowerUnit (QUDT)", "@reference on fields", "vocabulary URIs"],
    highlightsDeprecated: []
  },
  {
    key: "v6",
    label: "v6",
    title: "Unit-aware API contract",
    tagline: "Canonical storage, with units selected explicitly at the API edge.",
    appGraphql: `directive @range(min: Float, max: Float) on FIELD_DEFINITION

type Vehicle {
  id: ID!
  year: Int! @range(min: 1886)
  batteryCapacityKwh(unit: EnergyUnit = KILOW_HR): Float!
  maxChargePowerKw(unit: ElectricPowerUnit = KILOW): Float!
}

type ChargingDetails {
  meterStartKwh(unit: EnergyUnit = KILOW_HR): Float
  meterStopKwh(unit: EnergyUnit = KILOW_HR): Float
  energyDeliveredKwh(unit: EnergyUnit = KILOW_HR): Float
  socStartPercent(unit: DimensionlessRatioUnit = PERCENT): Float
  socStopPercent(unit: DimensionlessRatioUnit = PERCENT): Float
}

type ConnectorInfo {
  type: ConnectorType!
  powerKw(unit: ElectricPowerUnit = KILOW): Float!
  tethered: Boolean
}

# EnergyUnit, ElectricPowerUnit and DimensionlessRatioUnit
# are composed from the referenced QUDT vocabulary.`,
    appNarrative: [
      "Unit enums move from descriptive vocabulary to field arguments with defaults matching the existing kWh, kW and percent contract.",
      "Existing clients omit the new arguments and keep receiving canonical values; supporting other units requires conversion at the resolver boundary.",
      "The legacy GeoPoint type is removed. Governed and app-specific locations now use the same GeoJSON Point representation."
    ],
    dbJsonSchema: CHARGING_SESSION_VALIDATORS.v6,
    dbFilename: "chargingSessions.v6.json",
    dbNarrative: [
      "The full v6 validator preserves meterStartKwh and meterStopKwh as nullable doubles stored in kWh.",
      "State of charge remains a nullable double, so fractional percentages are accepted.",
      "Snapshots, booking, pricing, cost, feedback, timestamps, and all top-level references are represented instead of being elided."
    ],
    highlightsAdded: [
      "EnergyUnit field arguments",
      "ElectricPowerUnit field arguments",
      "DimensionlessRatioUnit field arguments",
      "@range(min: 1886)"
    ],
    highlightsDeprecated: ["GeoPoint removed"]
  },
  {
    key: "v7",
    label: "v7",
    title: "Ledger-backed contract adaptation",
    tagline: "Stable concepts make renames, unit changes, and narrowing explicit.",
    appGraphql: `type ChargingDetails {
  startedAt: String
  endedAt: String
  connectorUsed: SessionConnectorUsed

  # Same meter concepts, renamed and now exposed in Wh by default.
  meterStart(unit: EnergyUnit = W_HR): Float
  meterStop(unit: EnergyUnit = W_HR): Float

  energyDeliveredKwh(unit: EnergyUnit = KILOW_HR): Float

  # A narrowing contract change: fractional percentages need a policy.
  socStartPercent(unit: DimensionlessRatioUnit = PERCENT): Int
  socStopPercent(unit: DimensionlessRatioUnit = PERCENT): Int
}`,
    appNarrative: [
      "meterStartKwh and meterStopKwh keep their stable ModL concept identities while their contract names and default units change.",
      "The meter transformation is deterministic: rename and scale kWh to Wh. ModL classifies it as lossless.",
      "State of charge narrows from Float to Int. ModL marks this policy-required and potentially lossy instead of silently coercing it."
    ],
    dbJsonSchema: CHARGING_SESSION_VALIDATORS.v7,
    dbFilename: "chargingSessions.v7.json",
    dbNarrative: [
      "The complete v7 validator accepts meterStart and meterStop in canonical Wh and rejects the removed Kwh-suffixed fields.",
      "State-of-charge fields are bounded integer percentages from 0 through 100.",
      "The adapted payload is accepted only after the generated rename, scale, and rounding steps have run."
    ],
    highlightsAdded: [
      "meterStart (Wh)",
      "meterStop (Wh)",
      "SOC integer bounds",
      "ModL adaptation report"
    ],
    highlightsDeprecated: ["meterStartKwh", "meterStopKwh", "SOC Float contract"]
  }
];

export const ROLLOUT_STEPS = [
  {
    step: "01",
    title: "Ship additive changes",
    detail:
      "New fields as optional. validationLevel: moderate + validationAction: warn \u2014 old docs keep writing without rejection."
  },
  {
    step: "02",
    title: "Start producing v(n+1)",
    detail: "Write side emits new shape. schemaVersion on each doc disambiguates readers."
  },
  {
    step: "03",
    title: "Backfill + deprecate",
    detail:
      "Migrate old docs; mark old GraphQL fields @deprecated(reason: \u2026) so clients migrate in their own time."
  },
  {
    step: "04",
    title: "Tighten the contract",
    detail: "Promote to required, drop deprecated fields, raise to validationAction: error when confident."
  }
];
