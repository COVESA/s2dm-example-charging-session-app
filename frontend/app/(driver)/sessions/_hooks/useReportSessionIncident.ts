"use client";

import { useCallback, useState } from "react";
import { useMutation } from "@apollo/client/react";

import {
  IncidentSeverity,
  ReportSessionIncidentDocument
} from "@/graphql/generated/graphql";

type SubmitSessionIncidentInput = {
  severity: IncidentSeverity;
  description: string;
};

type UseReportSessionIncidentOptions = {
  sessionId: string;
};

export function useReportSessionIncident({
  sessionId
}: UseReportSessionIncidentOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reportSessionIncidentMutation] = useMutation(ReportSessionIncidentDocument);

  const submitIncident = useCallback(
    async ({ severity, description }: SubmitSessionIncidentInput) => {
      if (isSubmitting) {
        return null;
      }

      setError(null);
      setIsSubmitting(true);

      try {
        const result = await reportSessionIncidentMutation({
          variables: {
            input: {
              sessionId,
              severity,
              description
            }
          }
        });

        return result.data?.reportSessionIncident.incidentId ?? null;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to report incident");
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, reportSessionIncidentMutation, sessionId]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { submitIncident, isSubmitting, error, clearError };
}
