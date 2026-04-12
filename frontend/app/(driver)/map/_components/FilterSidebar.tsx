"use client";

import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import { ConnectorType } from "@/graphql/generated/graphql";
import { useChargingStationFacets } from "../_hooks/useChargingStationFacets";

export interface FilterState {
  connectorTypes: ConnectorType[];
  minPowerKw: number | null;
  maxPowerKw: number | null;
  minPriceCentsPerKwh: number | null;
  maxPriceCentsPerKwh: number | null;
  availableNow: boolean;
  fastCharging: boolean;
  tethered: boolean;
}

const POWER_FALLBACK = { min: 0, max: 350 };
const PRICE_FALLBACK = { min: 0, max: 100 };
const CONNECTOR_TYPE_OPTIONS = Object.values(ConnectorType) as ConnectorType[];

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

interface FilterSidebarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  open: boolean;
  onToggle: () => void;
}

export function FilterSidebar({
  filters,
  onFiltersChange,
  open,
  onToggle,
}: FilterSidebarProps) {
  const { facets } = useChargingStationFacets();

  const powerRange = facets?.powerRange ?? POWER_FALLBACK;
  const priceRange = facets?.priceRange ?? PRICE_FALLBACK;
  const connectorTypes = CONNECTOR_TYPE_OPTIONS;

  const toggleConnector = (connector: ConnectorType) => {
    const next = filters.connectorTypes.includes(connector)
      ? filters.connectorTypes.filter((c) => c !== connector)
      : [...filters.connectorTypes, connector];
    onFiltersChange({ ...filters, connectorTypes: next });
  };

  const setPowerRange = (values: [number, number]) => {
    const [min, max] = values;
    const isFullRange =
      min <= powerRange.min && max >= powerRange.max;
    onFiltersChange({
      ...filters,
      minPowerKw: isFullRange ? null : min,
      maxPowerKw: isFullRange ? null : max,
    });
  };

  const setPriceRange = (values: [number, number]) => {
    const [min, max] = values;
    const isFullRange =
      min <= priceRange.min && max >= priceRange.max;
    onFiltersChange({
      ...filters,
      minPriceCentsPerKwh: isFullRange ? null : min,
      maxPriceCentsPerKwh: isFullRange ? null : max,
    });
  };

  const setAvailableNow = (availableNow: boolean) => {
    onFiltersChange({ ...filters, availableNow });
  };

  const setFastCharging = (fastCharging: boolean) => {
    onFiltersChange({ ...filters, fastCharging });
  };

  const setTethered = (tethered: boolean) => {
    onFiltersChange({ ...filters, tethered });
  };

  const powerValue: [number, number] = [
    filters.minPowerKw ?? powerRange.min,
    filters.maxPowerKw ?? powerRange.max,
  ];
  const priceValue: [number, number] = [
    filters.minPriceCentsPerKwh ?? priceRange.min,
    filters.maxPriceCentsPerKwh ?? priceRange.max,
  ];
  const powerStep = powerRange.max - powerRange.min <= 50 ? 1 : 10;
  const priceStep = priceRange.max - priceRange.min <= 50 ? 1 : 5;

  if (!open) {
    return (
      <aside
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
        className="flex h-full w-full cursor-pointer flex-col items-center pt-7"
        aria-label="Open filters"
      >
        <FilterIcon className="h-5 w-5 text-slate-600" />
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col gap-4 overflow-y-auto px-4 py-4">
      <div className="flex items-center gap-2 pt-3">
        <FilterIcon className="h-5 w-5 shrink-0 text-slate-600" />
        <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
      </div>

      <div className="px-2">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          Connector type
        </h3>
        {connectorTypes.length === 0 ? (
          <div className="text-sm text-slate-400">No connector types</div>
        ) : (
          <div className="flex flex-col gap-2">
            {connectorTypes.map((connectorType) => (
              <label key={connectorType} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.connectorTypes.includes(connectorType)}
                  onChange={() => toggleConnector(connectorType)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">{connectorType}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="px-2">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          Power: {powerValue[0]} – {powerValue[1]} kW
        </h3>
        <Slider.Root
          className="relative flex w-full touch-none select-none items-center"
          value={powerValue}
          onValueChange={(values: number[]) =>
            setPowerRange([values[0] ?? powerRange.min, values[1] ?? powerRange.max])
          }
          min={powerRange.min}
          max={powerRange.max}
          step={powerStep}
          minStepsBetweenThumbs={1}
        >
          <Slider.Track className="relative h-2 w-full grow rounded-full bg-slate-200">
            <Slider.Range className="absolute h-full rounded-full bg-green-600" />
          </Slider.Track>
          <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-green-600 bg-white shadow focus:outline-none focus:ring-2 focus:ring-green-500" />
          <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-green-600 bg-white shadow focus:outline-none focus:ring-2 focus:ring-green-500" />
        </Slider.Root>
      </div>

      <div className="px-2">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          Price: {(priceValue[0] / 100).toFixed(2)} – {(priceValue[1] / 100).toFixed(2)} €/kWh
        </h3>
        <Slider.Root
          className="relative flex w-full touch-none select-none items-center"
          value={priceValue}
          onValueChange={(values: number[]) =>
            setPriceRange([values[0] ?? priceRange.min, values[1] ?? priceRange.max])
          }
          min={priceRange.min}
          max={priceRange.max}
          step={priceStep}
          minStepsBetweenThumbs={1}
        >
          <Slider.Track className="relative h-2 w-full grow rounded-full bg-slate-200">
            <Slider.Range className="absolute h-full rounded-full bg-green-600" />
          </Slider.Track>
          <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-green-600 bg-white shadow focus:outline-none focus:ring-2 focus:ring-green-500" />
          <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-green-600 bg-white shadow focus:outline-none focus:ring-2 focus:ring-green-500" />
        </Slider.Root>
      </div>

      <div className="px-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-700">Available now</span>
          <Switch.Root
            checked={filters.availableNow}
            onCheckedChange={setAvailableNow}
            className="inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-slate-200 bg-slate-200 p-0.5 outline-none transition-colors data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          >
            <Switch.Thumb className="block h-4 w-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
          </Switch.Root>
        </div>
      </div>

      <div className="px-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-700">Fast charging</span>
          <Switch.Root
            checked={filters.fastCharging}
            onCheckedChange={setFastCharging}
            className="inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-slate-200 bg-slate-200 p-0.5 outline-none transition-colors data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          >
            <Switch.Thumb className="block h-4 w-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
          </Switch.Root>
        </div>
      </div>

      <div className="px-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-700">Cable included</span>
          <Switch.Root
            checked={filters.tethered}
            onCheckedChange={setTethered}
            className="inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-slate-200 bg-slate-200 p-0.5 outline-none transition-colors data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          >
            <Switch.Thumb className="block h-4 w-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
          </Switch.Root>
        </div>
      </div>
    </aside>
  );
}

export const DEFAULT_FILTERS: FilterState = {
  connectorTypes: [],
  minPowerKw: null,
  maxPowerKw: null,
  minPriceCentsPerKwh: null,
  maxPriceCentsPerKwh: null,
  availableNow: false,
  fastCharging: false,
  tethered: false,
};
