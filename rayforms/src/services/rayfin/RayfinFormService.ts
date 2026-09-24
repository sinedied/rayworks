import type { Form } from '../../../rayfin/data/Form';
import type { FormField } from '../../../rayfin/data/FormField';
import { serializeNumericSettings, validateNumericSettings } from '../../lib/numericFields';
import {
  CreateFormInput,
  FormFieldDraft,
  FormWithFields,
  IFormService,
} from '../interfaces/IFormService';

import { getRayfinClient } from './RayfinClientService';

const FORM_FIELDS = [
  'id',
  'title',
  'description',
  'shareToken',
  'isClosed',
  'createdAt',
  'updatedAt',
  'owner_id',
] as const;

const QUESTION_FIELDS = [
  'id',
  'label',
  'helpText',
  'kind',
  'choices',
  'numericSettings',
  'required',
  'isDeleted',
  'isClosed',
  'position',
  'form_id',
  'owner_id',
] as const;

/** Share tokens are unguessable; they are the only thing in the URL a recipient sees. */
function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

function requireUserId(): string {
  const client = getRayfinClient();
  const userId = client.auth.getSession().user?.id;
  if (!userId) {
    throw new Error('User is not authenticated');
  }
  return userId;
}

function validateFieldSettings(fields: FormFieldDraft[]): void {
  for (const [index, field] of fields.entries()) {
    const error = validateNumericSettings(field.kind, field.numericSettings);
    if (error) throw new Error(`Question ${index + 1}: ${error}`);
  }
}

export class RayfinFormService implements IFormService {
  async getMyForms(): Promise<Form[]> {
    const client = getRayfinClient();
    const ownerId = requireUserId();

    return client.data.Form.select([...FORM_FIELDS])
      .where({ owner_id: { eq: ownerId } })
      .orderBy({ createdAt: 'desc' })
      .execute();
  }

  async getFormById(
    id: string,
    includeDeletedFields = false
  ): Promise<FormWithFields | null> {
    const client = getRayfinClient();
    // `findById` only selects the primary key in this SDK version, so query explicitly.
    const matches = await client.data.Form.select([...FORM_FIELDS])
      .where({ id: { eq: id } })
      .execute();

    const form = matches[0];
    if (!form) {
      return null;
    }
    return { form, fields: await this.getFields(form.id, includeDeletedFields) };
  }

  async getFormByShareToken(shareToken: string): Promise<FormWithFields | null> {
    const client = getRayfinClient();
    const matches = await client.data.Form.select([...FORM_FIELDS])
      .where({ shareToken: { eq: shareToken } })
      .execute();

    const form = matches[0];
    if (!form) {
      return null;
    }
    return { form, fields: await this.getFields(form.id) };
  }

  async createForm(input: CreateFormInput): Promise<Form> {
    validateFieldSettings(input.fields);
    const client = getRayfinClient();
    const ownerId = requireUserId();
    const now = new Date();

    const form = await client.data.Form.create({
      title: input.title,
      description: input.description,
      shareToken: generateShareToken(),
      isClosed: false,
      createdAt: now,
      updatedAt: now,
      owner_id: ownerId,
    });

    await this.createFields(form.id, ownerId, input.fields, false);
    return form;
  }

  async updateForm(
    id: string,
    updates: { title: string; description?: string; fields: FormFieldDraft[] }
  ): Promise<Form> {
    validateFieldSettings(updates.fields);
    const client = getRayfinClient();
    const ownerId = requireUserId();

    const form = await client.data.Form.update(
      { id },
      {
        title: updates.title,
        description: updates.description,
        updatedAt: new Date(),
      }
    );

    // Questions are updated in place so `Answer.field_id` keeps resolving. Removed questions are
    // soft-deleted rather than dropped, because answers hold a foreign key to them.
    const existing = await this.getFields(id, true);
    const existingIds = new Set(existing.map((field) => field.id));
    const keptIds = new Set<string>();

    for (const [index, draft] of updates.fields.entries()) {
      const payload = {
        label: draft.label,
        helpText: draft.helpText || undefined,
        kind: draft.kind,
        numericSettings: serializeNumericSettings(draft.kind, draft.numericSettings),
        choices: draft.choices.length
          ? JSON.stringify(draft.choices)
          : undefined,
        required: draft.required,
        position: index,
        isDeleted: false,
        isClosed: form.isClosed,
      };

      if (draft.id && existingIds.has(draft.id)) {
        keptIds.add(draft.id);
        await client.data.FormField.update({ id: draft.id }, payload);
      } else {
        await client.data.FormField.create({
          ...payload,
          form_id: id,
          owner_id: ownerId,
        });
      }
    }

    for (const field of existing) {
      if (!keptIds.has(field.id) && !field.isDeleted) {
        await client.data.FormField.update(
          { id: field.id },
          { isDeleted: true }
        );
      }
    }

    return form;
  }

  async setFormClosed(id: string, isClosed: boolean): Promise<Form> {
    const client = getRayfinClient();
    const form = await client.data.Form.update(
      { id },
      { isClosed, updatedAt: new Date() }
    );

    // Keep the mirrored flag on questions in sync so their read policy matches the form's.
    for (const field of await this.getFields(id, true)) {
      if (field.isClosed !== isClosed) {
        await client.data.FormField.update({ id: field.id }, { isClosed });
      }
    }

    return form;
  }

  async deleteForm(id: string): Promise<void> {
    const client = getRayfinClient();

    // Delete children before parents: answers -> responses -> questions -> form, so the
    // foreign keys generated for each relationship stay satisfied at every step.
    const responses = await client.data.FormResponse.select(['id', 'form_id'])
      .where({ form_id: { eq: id } })
      .execute();

    if (responses.length > 0) {
      const answers = await client.data.Answer.select(['id', 'response_id'])
        .where({ response_id: { in: responses.map((r) => r.id) } })
        .execute();

      for (const answer of answers) {
        await client.data.Answer.delete({ id: answer.id });
      }
      for (const response of responses) {
        await client.data.FormResponse.delete({ id: response.id });
      }
    }

    for (const field of await this.getFields(id, true)) {
      await client.data.FormField.delete({ id: field.id });
    }

    await client.data.Form.delete({ id });
  }

  private async getFields(
    formId: string,
    includeDeleted = false
  ): Promise<FormField[]> {
    const client = getRayfinClient();
    const fields = await client.data.FormField.select([...QUESTION_FIELDS])
      .where({ form_id: { eq: formId } })
      .execute();

    return fields
      .filter((field) => includeDeleted || !field.isDeleted)
      .sort((a, b) => a.position - b.position);
  }

  private async createFields(
    formId: string,
    ownerId: string,
    drafts: FormFieldDraft[],
    isClosed: boolean
  ): Promise<void> {
    const client = getRayfinClient();

    // Sequential: preserves position order and keeps the request count predictable.
    for (const [index, draft] of drafts.entries()) {
      await client.data.FormField.create({
        label: draft.label,
        helpText: draft.helpText || undefined,
        kind: draft.kind,
        numericSettings: serializeNumericSettings(draft.kind, draft.numericSettings),
        choices: draft.choices.length ? JSON.stringify(draft.choices) : undefined,
        required: draft.required,
        isDeleted: false,
        isClosed,
        position: index,
        form_id: formId,
        owner_id: ownerId,
      });
    }
  }
}
