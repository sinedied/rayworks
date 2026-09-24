import type { Form } from '../../rayfin/data/Form';
import type { FormField } from '../../rayfin/data/FormField';
import type { FormFieldDraft } from '../services/interfaces/IFormService';

export function formFixture(overrides: Partial<Form> = {}): Form {
  return {
    id: 'form-1', title: 'Booth feedback', shareToken: 'booth-token',
    isClosed: false, createdAt: new Date(), updatedAt: new Date(), owner_id: 'owner-1',
    ...overrides,
  };
}

export function fieldFixture(overrides: Partial<FormField> = {}): FormField {
  return {
    id: 'field-1', label: 'Your rating', kind: 'rating', required: false,
    numericSettings: '{"min":1,"max":5,"interval":1}',
    position: 0, isClosed: false, isDeleted: false, form_id: 'form-1', owner_id: 'owner-1',
    ...overrides,
  };
}

export function draftFixture(overrides: Partial<FormFieldDraft> = {}): FormFieldDraft {
  return {
    label: 'Your rating', kind: 'rating', required: false, choices: [],
    numericSettings: { min: 1, max: 5, interval: 1 }, ...overrides,
  };
}
