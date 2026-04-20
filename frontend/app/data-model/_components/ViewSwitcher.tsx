"use client";

type Option<V extends string> = {
  value: V;
  label: string;
  icon?: string;
};

type Props<V extends string> = {
  options: readonly Option<V>[];
  value: V;
  onChange: (value: V) => void;
  ariaLabel?: string;
};

export function ViewSwitcher<V extends string>({
  options,
  value,
  onChange,
  ariaLabel
}: Props<V>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-all ${
              active
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
            style={{ margin: 0, border: "none" }}
          >
            {opt.icon ? (
              <span
                className={`material-symbols-outlined text-[15px] ${
                  active ? "text-white" : "text-slate-400"
                }`}
              >
                {opt.icon}
              </span>
            ) : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
