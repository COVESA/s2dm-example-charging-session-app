"use client";

import { useState } from "react";

type RatingStarsProps = {
  value?: number | null;
  onChange?: (rating: number) => void;
  size?: number;
  className?: string;
  ariaLabel?: string;
};

export function RatingStars({
  value,
  onChange,
  size = 36,
  className,
  ariaLabel = "Session rating"
}: RatingStarsProps) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value || 0;
  const interactive = typeof onChange === "function";

  return (
    <div
      className={`flex items-center gap-3 ${className ?? ""}`.trim()}
      onMouseLeave={() => setHovered(0)}
      aria-label={ariaLabel}
      role={interactive ? "radiogroup" : "img"}
    >
      {[1, 2, 3, 4, 5].map((ratingValue) => {
        const filled = ratingValue <= active;
        const iconClassName = `material-symbols-outlined transition-all ${
          filled
            ? hovered
              ? "scale-110 text-amber-300"
              : "text-amber-400"
            : "text-slate-300"
        }`;

        if (!interactive) {
          return (
            <span
              key={ratingValue}
              className={iconClassName}
              style={{
                fontSize: size,
                fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0"
              }}
              aria-hidden="true"
            >
              star
            </span>
          );
        }

        const isSelected = ratingValue === (value ?? 0);

        return (
          <button
            key={ratingValue}
            type="button"
            onClick={() => onChange(ratingValue)}
            onMouseEnter={() => setHovered(ratingValue)}
            className={iconClassName}
            role="radio"
            aria-checked={isSelected}
            aria-label={`${ratingValue} star${ratingValue === 1 ? "" : "s"}`}
            style={{
              margin: 0,
              padding: 0,
              border: "none",
              background: "transparent",
              fontSize: size,
              fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0"
            }}
          >
            star
          </button>
        );
      })}
    </div>
  );
}
