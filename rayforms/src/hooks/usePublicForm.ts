import { useCallback, useEffect, useState } from 'react';

import type { FormWithFields } from '../services/interfaces/IFormService';
import { ServiceContainer } from '../services/ServiceContainer';

interface UsePublicFormResult {
  data: FormWithFields | null;
  loading: boolean;
  /** Set when the token matched no readable form (bad link, or the form was closed). */
  notFound: boolean;
  error: string | null;
}

/** Resolves a share-link token to the form a recipient should fill in. */
export function usePublicForm(shareToken: string | undefined): UsePublicFormResult {
  const [data, setData] = useState<FormWithFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formService = ServiceContainer.getInstance().formService;

  const load = useCallback(async () => {
    if (!shareToken) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const result = await formService.getFormByShareToken(shareToken);
      if (!result) {
        setNotFound(true);
        setData(null);
        return;
      }
      setData(result);
    } catch (err) {
      console.error('Failed to load form:', err);
      setError(err instanceof Error ? err.message : 'Failed to load form');
    } finally {
      setLoading(false);
    }
  }, [formService, shareToken]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, notFound, error };
}
