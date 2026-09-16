import type { Form } from '../../../rayfin/data/Form';
import type { FormField } from '../../../rayfin/data/FormField';

/** A question as edited in the builder, before it is persisted. */
export interface FormFieldDraft {
  id?: string;
  label: string;
  helpText?: string;
  kind: FormField['kind'];
  choices: string[];
  required: boolean;
}

export interface FormWithFields {
  form: Form;
  fields: FormField[];
}

export interface CreateFormInput {
  title: string;
  description?: string;
  fields: FormFieldDraft[];
}

export interface IFormService {
  /** Forms owned by the signed-in user, newest first. */
  getMyForms(): Promise<Form[]>;
  /**
   * @param includeDeletedFields - Include soft-deleted questions, needed to render historical
   * results columns. Defaults to false.
   */
  getFormById(
    id: string,
    includeDeletedFields?: boolean
  ): Promise<FormWithFields | null>;
  /** Resolves a share link token to its form. Returns null when not found or closed. */
  getFormByShareToken(shareToken: string): Promise<FormWithFields | null>;
  createForm(input: CreateFormInput): Promise<Form>;
  updateForm(
    id: string,
    updates: { title: string; description?: string; fields: FormFieldDraft[] }
  ): Promise<Form>;
  setFormClosed(id: string, isClosed: boolean): Promise<Form>;
  deleteForm(id: string): Promise<void>;
}
