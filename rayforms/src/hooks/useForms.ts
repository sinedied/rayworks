import { useCallback, useEffect, useState } from 'react';

import type { Form } from '../../rayfin/data/Form';
import type { CreateFormInput } from '../services/interfaces/IFormService';
import { ServiceContainer } from '../services/ServiceContainer';

interface UseFormsResult {
  forms: Form[];
  loading: boolean;
  error: string | null;
  createForm: (input: CreateFormInput) => Promise<Form>;
  setFormClosed: (id: string, isClosed: boolean) => Promise<void>;
  deleteForm: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** Lists and manages the forms owned by the signed-in user. */
export function useForms(): UseFormsResult {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formService = ServiceContainer.getInstance().formService;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setForms(await formService.getMyForms());
    } catch (err) {
      console.error('Failed to fetch forms:', err);
      setError(messageOf(err, 'Failed to fetch forms'));
    } finally {
      setLoading(false);
    }
  }, [formService]);

  const createForm = useCallback(
    async (input: CreateFormInput) => {
      setError(null);
      try {
        const created = await formService.createForm(input);
        setForms((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        console.error('Failed to create form:', err);
        setError(messageOf(err, 'Failed to create form'));
        throw err;
      }
    },
    [formService]
  );

  const setFormClosed = useCallback(
    async (id: string, isClosed: boolean) => {
      setError(null);
      try {
        const updated = await formService.setFormClosed(id, isClosed);
        setForms((prev) =>
          prev.map((form) => (form.id === id ? { ...form, ...updated } : form))
        );
      } catch (err) {
        console.error('Failed to update form:', err);
        setError(messageOf(err, 'Failed to update form'));
        throw err;
      }
    },
    [formService]
  );

  const deleteForm = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await formService.deleteForm(id);
        setForms((prev) => prev.filter((form) => form.id !== id));
      } catch (err) {
        console.error('Failed to delete form:', err);
        setError(messageOf(err, 'Failed to delete form'));
        throw err;
      }
    },
    [formService]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    forms,
    loading,
    error,
    createForm,
    setFormClosed,
    deleteForm,
    refresh,
  };
}
