export const CONNECTOR_TYPES = [
  "CCS",
  "CHAdeMO",
  "SCHUKO",
  "TYPE1",
  "TYPE2"
] as const;

export type ConnectorType = (typeof CONNECTOR_TYPES)[number];
