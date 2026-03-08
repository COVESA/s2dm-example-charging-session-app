export function formatSessionDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatCurrency(cents: number | null | undefined, currency = "EUR"): string {
  if (cents == null) return "--";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2
  }).format(cents / 100);
}

export function formatEnergy(kwh: number | null | undefined): string {
  if (kwh == null) return "--";
  return `${kwh.toFixed(2)} kWh`;
}

export function formatSessionDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(new Date(value));
}

export function formatDuration(startIso: string | null | undefined, endIso: string | null | undefined): string {
  if (!startIso) return "--";
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

export function formatConnector(
  connectorUsed: { type?: string | null; power?: number | null; tethered?: boolean | null } | null | undefined
): string {
  if (!connectorUsed) return "--";
  const type = connectorUsed.type ?? "--";
  const power = connectorUsed.power != null ? `${Math.round(connectorUsed.power)} kW` : "--";
  return `${type} · ${power}`;
}

export function formatSocCurrent(
  startPercent: number | null | undefined,
  stopPercent: number | null | undefined
): string {
  const value = stopPercent ?? startPercent;
  if (value == null) return "--";
  return `${Math.round(value)}%`;
}

export function formatSocRange(
  startPercent: number | null | undefined,
  stopPercent: number | null | undefined
): string {
  if (startPercent == null && stopPercent == null) return "--";
  if (startPercent != null && stopPercent != null) {
    return `${Math.round(startPercent)}% → ${Math.round(stopPercent)}%`;
  }
  if (startPercent != null) return `${Math.round(startPercent)}%`;
  return `${Math.round(stopPercent!)}%`;
}

export function formatRate(centsPerKwh: number | null | undefined, currency = "EUR"): string {
  if (centsPerKwh == null) return "--";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2
  }).format(centsPerKwh / 100) + "/kWh";
}

export function formatIdleFeePolicy(
  idleFee: { priceCentsPerMinute: number; afterMinutes: number } | null | undefined,
  currency = "EUR"
): string {
  if (!idleFee) return "--";
  const price = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2
  }).format(idleFee.priceCentsPerMinute / 100);
  return `${price}/min after ${idleFee.afterMinutes} min`;
}
