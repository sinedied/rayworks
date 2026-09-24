import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FormField } from '../../rayfin/data/FormField';
import { RayfinFormService } from '../services/rayfin/RayfinFormService';
import { draftFixture, fieldFixture, formFixture } from './fixtures';

const api = vi.hoisted(() => ({
  formCreate: vi.fn(), formUpdate: vi.fn(), formSelect: vi.fn(),
  fieldCreate: vi.fn(), fieldUpdate: vi.fn(), fieldSelect: vi.fn(),
}));
vi.mock('../services/rayfin/RayfinClientService', () => ({
  getRayfinClient: () => ({
    auth: { getSession: () => ({ user: { id: 'owner-1' } }) },
    data: {
      Form: { create: api.formCreate, update: api.formUpdate, select: api.formSelect },
      FormField: { create: api.fieldCreate, update: api.fieldUpdate, select: api.fieldSelect },
    },
  }),
}));

let stored: FormField[];
beforeEach(() => {
  vi.clearAllMocks();
  stored = [];
  api.formCreate.mockResolvedValue(formFixture());
  api.formUpdate.mockResolvedValue(formFixture());
  api.formSelect.mockImplementation(() => ({
    where: () => ({ execute: async () => [formFixture()] }),
  }));
  api.fieldSelect.mockImplementation(() => ({
    where: () => ({ execute: async () => [...stored] }),
  }));
  api.fieldCreate.mockImplementation(async (payload: Partial<FormField>) => {
    const field = fieldFixture({ ...payload, id: `field-${stored.length + 1}` });
    stored.push(field);
    return field;
  });
  api.fieldUpdate.mockImplementation(async ({ id }: { id: string }, payload: Partial<FormField>) => {
    const field = stored.find((candidate) => candidate.id === id);
    if (!field) throw new Error('Missing fixture');
    Object.assign(field, Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    ));
    return field;
  });
});

describe('numeric settings persistence', () => {
  it('round-trips settings through create, edit, adding fields, and clearing', async () => {
    const service = new RayfinFormService();
    const rating = draftFixture({ numericSettings: {
      min: 1, max: 5, interval: 1, minLabel: 'Low', maxLabel: 'High',
    } });
    await service.createForm({ title: 'Test', fields: [rating] });
    expect(stored[0].numericSettings).toBe(JSON.stringify(rating.numericSettings));
    await service.updateForm('form-1', {
      title: 'Test',
      fields: [
        draftFixture({ id: stored[0].id, kind: 'number', numericSettings: { min: 0 } }),
        draftFixture(),
      ],
    });

    expect(stored[0].numericSettings).toBe('{"min":0}');
    expect(stored[1].kind).toBe('rating');
    const loaded = await service.getFormByShareToken('booth-token');
    expect(loaded?.fields[0].numericSettings).toBe('{"min":0}');
    expect(api.fieldSelect).toHaveBeenCalledWith(expect.arrayContaining(['numericSettings']));
    await service.updateForm('form-1', {
      title: 'Test',
      fields: [draftFixture({ id: stored[0].id, kind: 'number', numericSettings: {} })],
    });
    expect(stored[0].numericSettings).toBe('');
    expect(stored[1].isDeleted).toBe(true);
    expect((await service.getFormById('form-1'))?.fields).toHaveLength(1);
  });

  it('validates every draft before creating or updating any records', async () => {
    const service = new RayfinFormService();
    const input = { title: 'Test', fields: [draftFixture(), draftFixture({
      numericSettings: { min: 1, max: 5, interval: 3 },
    })] };
    await expect(service.createForm(input)).rejects.toThrow('Question 2');
    await expect(service.updateForm('form-1', input)).rejects.toThrow('Question 2');
    expect(api.formCreate).not.toHaveBeenCalled();
    expect(api.formUpdate).not.toHaveBeenCalled();
    expect(api.fieldCreate).not.toHaveBeenCalled();
    expect(api.fieldUpdate).not.toHaveBeenCalled();
  });
});

describe('question help text persistence', () => {
  it.each([undefined, '', '   '])('clears saved help text with %j', async (helpText) => {
    stored = [fieldFixture({ helpText: 'Existing guidance' })];
    const service = new RayfinFormService();
    await service.updateForm('form-1', {
      title: 'Test',
      fields: [draftFixture({ id: 'field-1', helpText })],
    });
    expect(api.fieldUpdate).toHaveBeenCalledWith(
      { id: 'field-1' },
      expect.objectContaining({ helpText: '' })
    );
    expect((await service.getFormById('form-1'))?.fields[0].helpText).toBe('');
  });

  it('preserves meaningful text and clears rating endpoint help independently', async () => {
    const service = new RayfinFormService();
    await service.createForm({
      title: 'Test',
      fields: [draftFixture({
        helpText: '  General guidance  ',
        numericSettings: { min: 1, max: 5, interval: 1, minLabel: 'Low', maxLabel: 'High' },
      })],
    });
    expect(stored[0].helpText).toBe('General guidance');
    await service.updateForm('form-1', {
      title: 'Test',
      fields: [draftFixture({
        id: 'field-1',
        helpText: 'General guidance',
        numericSettings: { min: 1, max: 5, interval: 1, minLabel: '', maxLabel: '   ' },
      })],
    });
    const saved = (await service.getFormById('form-1'))?.fields[0];
    expect(saved?.helpText).toBe('General guidance');
    expect(saved?.numericSettings).toBe('{"min":1,"max":5,"interval":1}');
  });
});
