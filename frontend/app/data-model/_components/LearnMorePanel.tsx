"use client";

type Link = {
  href: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: "violet" | "emerald" | "amber" | "sky";
};

const TONES: Record<
  Link["tone"],
  { border: string; icon: string; hover: string }
> = {
  violet: {
    border: "border-violet-200",
    icon: "bg-violet-500 text-white",
    hover: "hover:border-violet-300 hover:bg-violet-50"
  },
  emerald: {
    border: "border-emerald-200",
    icon: "bg-emerald-500 text-white",
    hover: "hover:border-emerald-300 hover:bg-emerald-50"
  },
  amber: {
    border: "border-amber-200",
    icon: "bg-amber-500 text-white",
    hover: "hover:border-amber-300 hover:bg-amber-50"
  },
  sky: {
    border: "border-sky-200",
    icon: "bg-sky-500 text-white",
    hover: "hover:border-sky-300 hover:bg-sky-50"
  }
};

const LINKS: Link[] = [
  {
    href: "https://www.mongodb.com/company/blog/innovation/plugging-gap-in-automotive-data-interoperability",
    title: "Plugging the gap in automotive data interoperability",
    subtitle:
      "The original blog post — why S2DM matters, and what it unlocks across the automotive ecosystem.",
    icon: "article",
    tone: "violet"
  }
];

export function LearnMorePanel() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {LINKS.map((link) => {
        const tone = TONES[link.tone];
        return (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className={`group relative flex items-start gap-3 rounded-2xl border bg-white p-4 no-underline transition-all ${tone.border} ${tone.hover}`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {link.icon}
              </span>
            </span>
            <span className="min-w-0 flex-1 pr-6">
              <span className="block text-[13px] font-bold text-slate-900">
                {link.title}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-slate-600">
                {link.subtitle}
              </span>
            </span>
            <span className="pointer-events-none absolute right-3 top-3 text-slate-400 transition-transform group-hover:translate-x-0.5">
              <span className="material-symbols-outlined text-[16px]">
                arrow_outward
              </span>
            </span>
          </a>
        );
      })}
    </div>
  );
}
