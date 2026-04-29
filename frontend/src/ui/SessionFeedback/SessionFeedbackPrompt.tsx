"use client";

import { useState } from "react";

import { RatingStars } from "./RatingStars";

type SessionFeedbackPromptProps = {
  title: string;
  initialRating?: number;
  initialComment?: string | null;
  submitLabel?: string;
  dismissLabel?: string;
  onSubmit: (input: { rating: number; comment: string | null }) => Promise<unknown> | unknown;
  onDismiss: () => void;
  isSubmitting?: boolean;
  error?: string | null;
  titleId?: string;
};

export function SessionFeedbackPrompt({
  title,
  initialRating = 0,
  initialComment = "",
  submitLabel = "Save Rating",
  dismissLabel = "Maybe Later",
  onSubmit,
  onDismiss,
  isSubmitting = false,
  error,
  titleId
}: SessionFeedbackPromptProps) {
  const [prevInitialRating, setPrevInitialRating] = useState(initialRating);
  const [rating, setRating] = useState(initialRating);
  if (prevInitialRating !== initialRating) {
    setPrevInitialRating(initialRating);
    setRating(initialRating);
  }

  const [prevInitialComment, setPrevInitialComment] = useState(initialComment);
  const [comment, setComment] = useState(initialComment ?? "");
  if (prevInitialComment !== initialComment) {
    setPrevInitialComment(initialComment);
    setComment(initialComment ?? "");
  }

  const handleSubmit = async () => {
    if (!rating || isSubmitting) {
      return;
    }

    await onSubmit({
      rating,
      comment: comment.trim() || null
    });
  };

  return (
    <div className="flex flex-col">
      <div className="px-6 pt-6">
        <div className="flex items-start justify-between">
          <div className="h-8 w-8 shrink-0" aria-hidden="true" />
          <button
            type="button"
            onClick={onDismiss}
            disabled={isSubmitting}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <div className="mt-1 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
            <span className="material-symbols-outlined text-3xl text-amber-500">star</span>
          </div>
          <h2 id={titleId} className="mt-4 text-[17px] font-bold text-slate-900">
            {title}
          </h2>
        </div>
      </div>

      <div className="px-6 pb-6 pt-5">
        <div className="flex justify-center">
          <RatingStars
            value={rating}
            onChange={setRating}
            ariaLabel="Choose a session rating"
          />
        </div>

        <div className="mt-5">
          <label
            htmlFor="session-feedback-comment"
            className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400"
          >
            Comment Optional
          </label>
          <textarea
            id="session-feedback-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Share anything about the session..."
            rows={4}
            className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
          />
        </div>

        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-[13px] text-rose-600">
            <span
              className="material-symbols-outlined mt-0.5 shrink-0"
              style={{ fontSize: 16 }}
            >
              error
            </span>
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!rating || isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ margin: 0 }}
          >
            <span className="material-symbols-outlined text-xl">check_circle</span>
            {isSubmitting ? "Saving..." : submitLabel}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={isSubmitting}
            className="w-full rounded-2xl py-3 text-[14px] font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
            style={{ margin: 0, border: "none", background: "transparent" }}
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
