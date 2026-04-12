"use client";

import { useState } from "react";
import type { GeocodeResult } from "../_hooks/useGeocode";

interface SearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onSelectResult: (result: GeocodeResult) => void;
  results: GeocodeResult[];
  loading?: boolean;
  error?: string | null;
}

export function SearchBar({
  query,
  onQueryChange,
  onSubmit,
  onSelectResult,
  results,
  loading,
  error
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const isExpanded = focused || query.trim().length > 0;
  const showResults = isExpanded && query.trim().length > 0 && results.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div
      className={`relative max-w-[calc(100vw-2rem)] transition-all duration-300 ease-out ${
        isExpanded ? "w-[28rem]" : "w-52"
      }`}
    >
      <form
        onSubmit={handleSubmit}
        className="flex items-center rounded-full border border-white/55 bg-white/30 shadow-lg backdrop-blur-xl transition-all duration-300 ease-out"
      >
        <div className="flex flex-1 items-center gap-2 px-4 py-2.5">
          {loading ? (
            <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-700/30 border-t-slate-700/75" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0 text-slate-700/75"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={isExpanded ? "Search for city, address, or place" : "Search"}
            className="min-w-0 flex-1 border-0 bg-transparent py-1 text-slate-900 placeholder-slate-700/70 focus:outline-none focus:ring-0"
          />
        </div>
      </form>

      {showResults && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-white/60 bg-white/55 shadow-lg backdrop-blur-xl">
          {results.map((result, index) => (
            <button
              key={`${result.lat}-${result.lng}-${index}`}
              type="button"
              onClick={() => onSelectResult(result)}
              className="block w-full border-b border-slate-200/60 px-4 py-2.5 text-left text-sm text-slate-800 transition hover:bg-white/70 last:border-b-0"
            >
              <span className="block truncate">{result.displayName}</span>
            </button>
          ))}
        </div>
      )}
      {!showResults && error && (
        <div className="mt-1 px-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
