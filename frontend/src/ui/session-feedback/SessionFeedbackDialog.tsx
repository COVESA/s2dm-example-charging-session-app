"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { SessionFeedbackPrompt } from "./SessionFeedbackPrompt";

type SessionFeedbackDialogProps = {
  title: string;
  initialRating?: number;
  initialComment?: string | null;
  submitLabel?: string;
  dismissLabel?: string;
  onSubmit: (input: { rating: number; comment: string | null }) => Promise<unknown> | unknown;
  onDismiss: () => void;
  isSubmitting?: boolean;
  error?: string | null;
};

export function SessionFeedbackDialog({
  title,
  initialRating,
  initialComment,
  submitLabel,
  dismissLabel,
  onSubmit,
  onDismiss,
  isSubmitting,
  error
}: SessionFeedbackDialogProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onDismiss]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-feedback-dialog-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onDismiss}
        aria-hidden="true"
      />
      <div
        className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <SessionFeedbackPrompt
          title={title}
          initialRating={initialRating}
          initialComment={initialComment}
          submitLabel={submitLabel}
          dismissLabel={dismissLabel}
          onSubmit={onSubmit}
          onDismiss={onDismiss}
          isSubmitting={isSubmitting}
          error={error}
          titleId="session-feedback-dialog-title"
        />
      </div>
    </div>,
    document.body
  );
}
