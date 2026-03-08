"use client";

import { Modal } from "@/ui/Modal";

import { SessionFeedbackPrompt } from "./SessionFeedbackPrompt";

type SessionFeedbackModalProps = {
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

export function SessionFeedbackModal({
  title,
  initialRating,
  initialComment,
  submitLabel,
  dismissLabel,
  onSubmit,
  onDismiss,
  isSubmitting,
  error
}: SessionFeedbackModalProps) {
  return (
    <Modal isOpen={true} onClose={onDismiss} titleId="session-feedback-dialog-title" maxWidth="md">
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
    </Modal>
  );
}
