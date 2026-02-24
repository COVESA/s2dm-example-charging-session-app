"use client";

import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import { useChargingStationFacets } from "../_hooks/useChargingStationFacets";

export interface FilterState {
  connectorTypes: string[];
  minPowerKw: number | null;
  maxPowerKw: number | null;
  minPriceCentsPerKwh: number | null;
  maxPriceCentsPerKwh: number | null;
  availableNow: boolean;
  fastCharging: boolean;
}

const POWER_FALLBACK = { min: 0, max: 350 };
const PRICE_FALLBACK = { min: 0, max: 100 };

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
  const { facets, loading: facetsLoading } = useChargingStationFacets();

  const powerRange = facets?.powerRange ?? POWER_FALLBACK;
  const priceRange = facets?.priceRange ?? PRICE_FALLBACK;
  const connectorTypes = [...(facets?.connectorTypes ?? [])].sort((a, b) =>
    a.type.localeCompare(b.type)
  );

  const toggleConnector = (connector: string) => {
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

  const clearPowerFilter = () => {
    onFiltersChange({
      ...filters,
      minPowerKw: null,
      maxPowerKw: null,
    });
  };

  const clearPriceFilter = () => {
    onFiltersChange({
      ...filters,
      minPriceCentsPerKwh: null,
      maxPriceCentsPerKwh: null,
    });
  };

  const powerValue: [number, number] = [
    filters.minPowerKw ?? powerRange.min,
    filters.maxPowerKw ?? powerRange.max,
  ];
  const priceValue: [number, number] = [
    filters.minPriceCentsPerKwh ?? priceRange.min,
    filters.maxPriceCentsPerKwh ?? priceRange.max,
  ];
  const hasPowerFilter = filters.minPowerKw != null || filters.maxPowerKw != null;
  const hasPriceFilter =
    filters.minPriceCentsPerKwh != null || filters.maxPriceCentsPerKwh != null;

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
        {facetsLoading ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : connectorTypes.length === 0 ? (
          <div className="text-sm text-slate-400">No connector types</div>
        ) : (
          <div className="flex flex-col gap-2">
            {connectorTypes.map((c) => (
              <label key={c.type} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.connectorTypes.includes(c.type)}
                  onChange={() => toggleConnector(c.type)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">{c.type}</span>
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
          onValueChange={(v) => setPowerRange([v[0] ?? powerRange.min, v[1] ?? powerRange.max])}
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
        {hasPowerFilter && (
          <button
            type="button"
            onClick={clearPowerFilter}
            className="mt-1 text-xs text-slate-500 hover:text-slate-700"
          >
            Clear power filter
          </button>
        )}
      </div>

      <div className="px-2">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          Price: {(priceValue[0] / 100).toFixed(2)} – {(priceValue[1] / 100).toFixed(2)} €/kWh
        </h3>
        <Slider.Root
          className="relative flex w-full touch-none select-none items-center"
          value={priceValue}
          onValueChange={(v) => setPriceRange([v[0] ?? priceRange.min, v[1] ?? priceRange.max])}
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
        {hasPriceFilter && (
          <button
            type="button"
            onClick={clearPriceFilter}
            className="mt-1 text-xs text-slate-500 hover:text-slate-700"
          >
            Clear price filter
          </button>
        )}
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
};
