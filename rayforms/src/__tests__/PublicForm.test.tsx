import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicForm } from '../pages/PublicForm';
import { usePublicForm } from '../hooks/usePublicForm';
import { fieldFixture, formFixture } from './fixtures';

const submitResponse = vi.hoisted(() => vi.fn());
vi.mock('../hooks/usePublicForm', () => ({ usePublicForm: vi.fn() }));
vi.mock('../components/AppHeader', () => ({ AppHeader: () => null }));
vi.mock('../services/ServiceContainer', () => ({
  ServiceContainer: { getInstance: () => ({ responseService: { submitResponse } }) },
}));

function show(fields = [fieldFixture()]) {
  vi.mocked(usePublicForm).mockReturnValue({
    data: { form: formFixture(), fields },
    loading: false, notFound: false, error: null,
  });
  return render(<MemoryRouter><PublicForm /></MemoryRouter>);
}

beforeEach(() => { submitResponse.mockReset().mockResolvedValue({}); });

describe('PublicForm numeric fields', () => {
  it('requires an explicit rating then submits the scalar value', async () => {
    const user = userEvent.setup();
    show([fieldFixture({ required: true })]);
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(submitResponse).not.toHaveBeenCalled();
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByRole('radio', { name: '4' }));
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(submitResponse).toHaveBeenCalledWith(
      { id: 'form-1', owner_id: 'owner-1' },
      [expect.objectContaining({ fieldId: 'field-1', value: '4' })]
    );
    expect(await screen.findByText('Thank you')).toBeInTheDocument();
  });

  it('submits an untouched optional slider as blank', async () => {
    const user = userEvent.setup();
    show([fieldFixture({ numericSettings: '{"min":0,"max":5,"interval":1}' })]);
    expect(screen.getByRole('slider')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(submitResponse).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({ value: '' }),
    ]);
  });

  it('validates decimal bounds before any writes and accepts endpoints', async () => {
    const user = userEvent.setup();
    show([fieldFixture({ kind: 'number', label: 'Amount', numericSettings: '{"min":-2.5,"max":3.5}' })]);
    const input = screen.getByRole('spinbutton', { name: 'Amount' });
    expect(input).toHaveAttribute('step', 'any');
    expect(input).toHaveAttribute('min', '-2.5');
    expect(input).toHaveAttribute('max', '3.5');
    fireEvent.change(input, { target: { value: '3.51' } });
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(submitResponse).not.toHaveBeenCalled();
    expect(input).toHaveAccessibleDescription('Enter a value of at most 3.5.');
    fireEvent.change(input, { target: { value: '-2.5' } });
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(submitResponse).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({ value: '-2.5' }),
    ]);
  });

  it('retains legacy unbounded numbers and optional blanks', async () => {
    const user = userEvent.setup();
    show([fieldFixture({ kind: 'number', numericSettings: undefined })]);
    const input = screen.getByRole('spinbutton');
    expect(input).not.toHaveAttribute('min');
    expect(input).not.toHaveAttribute('max');
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(submitResponse).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({ value: '' }),
    ]);
  });

  it('blocks corrupt persisted settings with an explicit error', async () => {
    const user = userEvent.setup();
    show([fieldFixture({ numericSettings: 'broken' })]);
    expect(screen.getByText('This question has invalid numeric settings.')).toBeInTheDocument();
    expect(screen.queryByRole('slider')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(submitResponse).not.toHaveBeenCalled();
  });

  it('does not treat an invalid optional numeric input as a skipped answer', async () => {
    const user = userEvent.setup();
    show([fieldFixture({ kind: 'number', numericSettings: undefined })]);
    const input = screen.getByRole('spinbutton');
    Object.defineProperty(input, 'validity', { configurable: true, value: { badInput: true } });
    fireEvent.input(input);
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(submitResponse).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a valid finite number.')).toBeInTheDocument();
  });
});
