"use client";

import { useCallback, useState } from "react";
import { useMutation } from "@apollo/client/react";

import { AddSessionFeedbackDocument } from "@/graphql/generated/graphql";

type SubmitSessionFeedbackInput = {
  rating: number;
  comment?: string | null;
};

type UseSessionFeedbackOptions = {
  sessionId: string;
};

export function useSessionFeedback({ sessionId }: UseSessionFeedbackOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addSessionFeedbackMutation] = useMutation(AddSessionFeedbackDocument, {
    refetchQueries: "active"
  });

  const submitFeedback = useCallback(
    async ({ rating, comment }: SubmitSessionFeedbackInput) => {
      if (isSubmitting) {
        return null;
      }

      setError(null);
      setIsSubmitting(true);

      try {
        const result = await addSessionFeedbackMutation({
          variables: {
            input: {
              sessionId,
              rating,
              comment: comment ?? null
            }
          }
        });

        return result.data?.addSessionFeedback.session ?? null;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save rating");
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [addSessionFeedbackMutation, isSubmitting, sessionId]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { submitFeedback, isSubmitting, error, clearError };
}
