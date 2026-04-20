"use client";

import type { CollectionKey, CollectionMeta } from "../_data/schemas";

type Props = {
  collections: CollectionMeta[];
  active: CollectionKey;
  onChange: (key: CollectionKey) => void;
};

export function CollectionTabs({ collections, active, onChange }: Props) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Collection"
    >
      {collections.map((col) => {
        const isActive = col.key === active;
        return (
          <button
            key={col.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(col.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              isActive
                ? `${col.accent.pill} ring-1 shadow-sm`
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800"
            }`}
            style={{ margin: 0, padding: "0.375rem 0.75rem" }}
          >
            <span className="material-symbols-outlined text-[14px]">
              {col.icon}
            </span>
            {col.label}
          </button>
        );
      })}
    </div>
  );
}
