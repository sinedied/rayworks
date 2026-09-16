import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Answer } from '../../rayfin/data/Answer';
import type { FormResponse } from '../../rayfin/data/FormResponse';
import type { FormWithFields } from '../services/interfaces/IFormService';
import { ServiceContainer } from '../services/ServiceContainer';

export interface ResponseRow {
  response: FormResponse;
  answersByFieldId: Map<string, Answer>;
}

interface UseFormResultsResult {
  form: FormWithFields | null;
  rows: ResponseRow[];
  loading: boolean;
  error: string | null;
  deleteResponse: (responseId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/** Loads a form plus every submission, shaped as one row per respondent. */
export function useFormResults(formId: string | undefined): UseFormResultsResult {
  const [form, setForm] = useState<FormWithFields | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { formService, responseService } = ServiceContainer.getInstance();

  const refresh = useCallback(async () => {
    if (!formId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Historical columns need soft-deleted questions too, so results stay readable
      // after the form is edited.
      const [formData, responseData] = await Promise.all([
        formService.getFormById(formId, true),
        responseService.getResponsesForForm(formId),
      ]);
      const answerData = await responseService.getAnswersForResponses(
        responseData.map((response) => response.id)
      );

      setForm(formData);
      setResponses(responseData);
      setAnswers(answerData);
    } catch (err) {
      console.error('Failed to load results:', err);
      setError(err instanceof Error ? err.message : 'Failed to load results');
    } finally {
      setLoading(false);
    }
  }, [formId, formService, responseService]);

  const deleteResponse = useCallback(
    async (responseId: string) => {
      await responseService.deleteResponse(responseId);
      setResponses((prev) => prev.filter((r) => r.id !== responseId));
      setAnswers((prev) => prev.filter((a) => a.response_id !== responseId));
    },
    [responseService]
  );

  const rows = useMemo<ResponseRow[]>(() => {
    const byResponse = new Map<string, Map<string, Answer>>();
    for (const answer of answers) {
      let bucket = byResponse.get(answer.response_id);
      if (!bucket) {
        bucket = new Map();
        byResponse.set(answer.response_id, bucket);
      }
      bucket.set(answer.field_id, answer);
    }

    return responses.map((response) => ({
      response,
      answersByFieldId: byResponse.get(response.id) ?? new Map(),
    }));
  }, [responses, answers]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { form, rows, loading, error, deleteResponse, refresh };
}
