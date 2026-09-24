import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FormEditor } from '../pages/FormEditor';
import { fieldFixture, formFixture } from './fixtures';

const service = vi.hoisted(() => ({
  getFormById: vi.fn(), createForm: vi.fn(), updateForm: vi.fn(),
}));
vi.mock('../components/AppHeader', () => ({ AppHeader: () => null }));
vi.mock('../services/ServiceContainer', () => ({
  ServiceContainer: { getInstance: () => ({ formService: service }) },
}));

function show(edit = false) {
  return render(
    <MemoryRouter initialEntries={[edit ? '/forms/form-1/edit' : '/forms/new']}>
      <Routes>
        <Route path="/forms/new" element={<FormEditor />} />
        <Route path="/forms/:id/edit" element={<FormEditor />} />
        <Route path="/" element={<p>Saved form</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  service.getFormById.mockResolvedValue({ form: formFixture(), fields: [fieldFixture()] });
  service.createForm.mockResolvedValue(formFixture());
  service.updateForm.mockResolvedValue(formFixture());
});

describe('FormEditor numeric settings', () => {
  it('creates a rating with defaults and endpoint text', async () => {
    const user = userEvent.setup();
    show();
    await user.type(screen.getByLabelText('Title'), 'Feedback');
    await user.type(screen.getByLabelText('Question'), 'Usefulness');
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Rating' }));
    expect(screen.getByLabelText('Minimum')).toHaveValue(1);
    expect(screen.getByLabelText('Maximum')).toHaveValue(5);
    expect(screen.getByLabelText('Interval')).toHaveValue(1);
    await user.type(screen.getByLabelText('Minimum help text (optional)'), 'Not useful');
    await user.click(screen.getByRole('button', { name: 'Save form' }));
    expect(service.createForm).toHaveBeenCalledWith(expect.objectContaining({
      fields: [expect.objectContaining({
        kind: 'rating',
        numericSettings: { min: 1, max: 5, interval: 1, minLabel: 'Not useful' },
      })],
    }));
  });

  it('loads saved settings and blocks incomplete or unreachable scales', async () => {
    const user = userEvent.setup();
    service.getFormById.mockResolvedValue({
      form: formFixture(),
      fields: [fieldFixture({ numericSettings: '{"min":10,"max":50,"interval":10,"maxLabel":"Great"}' })],
    });
    show(true);
    expect(await screen.findByLabelText('Minimum')).toHaveValue(10);
    expect(screen.getByLabelText('Maximum help text (optional)')).toHaveValue('Great');
    const interval = screen.getByLabelText('Interval');
    await user.clear(interval);
    await user.click(screen.getByRole('button', { name: 'Save form' }));
    expect(service.updateForm).not.toHaveBeenCalled();
    expect(screen.getByText(/requires a minimum, maximum, and interval/)).toBeInTheDocument();
    fireEvent.change(interval, { target: { value: '3' } });
    await user.click(screen.getByRole('button', { name: 'Save form' }));
    expect(service.updateForm).not.toHaveBeenCalled();
    expect(screen.getByText(/divide the range exactly/)).toBeInTheDocument();
    fireEvent.change(interval, { target: { value: '10' } });
    await user.click(screen.getByRole('button', { name: 'Save form' }));
    expect(service.updateForm).toHaveBeenCalledWith('form-1', expect.objectContaining({
      fields: [expect.objectContaining({ id: 'field-1', numericSettings: {
        min: 10, max: 50, interval: 10, maxLabel: 'Great',
      } })],
    }));
  });

  it('clears settings on kind changes and allows empty Number bounds', async () => {
    const user = userEvent.setup();
    show(true);
    await screen.findByLabelText('Minimum');
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Number' }));
    expect(screen.getByLabelText('Minimum (optional)')).toHaveValue(null);
    expect(screen.queryByLabelText('Interval')).toBeNull();
    fireEvent.change(screen.getByLabelText('Maximum (optional)'), { target: { value: '3.5' } });
    await user.clear(screen.getByLabelText('Maximum (optional)'));
    await user.click(screen.getByRole('button', { name: 'Save form' }));
    expect(service.updateForm).toHaveBeenCalledWith('form-1', expect.objectContaining({
      fields: [expect.objectContaining({ kind: 'number', numericSettings: { max: undefined } })],
    }));
  });
});
