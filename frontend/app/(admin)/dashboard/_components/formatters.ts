const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1
});

const integerFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 0
});

const energyFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1
});

const percentFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1
});

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export function formatCompactNumber(value: number): string {
  return compactNumberFormatter.format(value);
}

export function formatCount(value: number): string {
  return integerFormatter.format(value);
}

export function formatCurrencyCents(value: number | null | undefined): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format((value ?? 0) / 100);
}

export function formatTariffCentsPerKwh(value: number | null | undefined): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format((value ?? 0) / 100);
}

export function formatEnergyKwh(value: number | null | undefined): string {
  return `${energyFormatter.format(value ?? 0)} kWh`;
}

export function formatPercent(value: number | null | undefined): string {
  return `${percentFormatter.format(value ?? 0)}%`;
}

export function formatPowerKw(value: number | null | undefined): string {
  return `${energyFormatter.format(value ?? 0)} kW`;
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Not started";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return dateTimeFormatter.format(date);
}
