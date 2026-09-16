import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { FieldEditor, isChoiceKind } from '../components/FieldEditor';
import type { FormFieldDraft } from '../services/interfaces/IFormService';

function draft(overrides: Partial<FormFieldDraft> = {}): FormFieldDraft {
  return {
    label: 'Favourite colour',
    helpText: '',
    kind: 'shortText',
    choices: [],
    required: false,
    ...overrides,
  };
}

function renderEditor(field: FormFieldDraft, onChange = vi.fn()) {
  render(
    <FieldEditor
      field={field}
      index={0}
      total={2}
      onChange={onChange}
      onRemove={vi.fn()}
      onMove={vi.fn()}
    />
  );
  return onChange;
}

describe('isChoiceKind', () => {
  it('identifies the kinds that need a choice list', () => {
    expect(isChoiceKind('singleChoice')).toBe(true);
    expect(isChoiceKind('multiChoice')).toBe(true);
    expect(isChoiceKind('shortText')).toBe(false);
    expect(isChoiceKind('number')).toBe(false);
  });
});

describe('FieldEditor', () => {
  it('reports label edits to the parent', async () => {
    const user = userEvent.setup();
    const onChange = renderEditor(draft({ label: '' }));

    await user.type(screen.getByLabelText('Question'), 'A');

    expect(onChange).toHaveBeenCalledWith({ label: 'A' });
  });

  it('renders choice inputs only for choice questions', () => {
    const { unmount } = render(
      <FieldEditor
        field={draft()}
        index={0}
        total={1}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        onMove={vi.fn()}
      />
    );
    expect(screen.queryByText('Choices')).toBeNull();
    unmount();

    renderEditor(draft({ kind: 'singleChoice', choices: ['Red', 'Blue'] }));
    expect(screen.getByText('Choices')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Red')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Blue')).toBeInTheDocument();
  });

  it('appends a new choice when "Add choice" is clicked', async () => {
    const user = userEvent.setup();
    const onChange = renderEditor(
      draft({ kind: 'multiChoice', choices: ['Red'] })
    );

    await user.click(screen.getByRole('button', { name: /add choice/i }));

    expect(onChange).toHaveBeenCalledWith({ choices: ['Red', 'Option 2'] });
  });

  it('toggles the required flag', async () => {
    const user = userEvent.setup();
    const onChange = renderEditor(draft());

    await user.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith({ required: true });
  });
});
