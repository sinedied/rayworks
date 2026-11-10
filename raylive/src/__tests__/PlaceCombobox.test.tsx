import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlaceCombobox, type PlaceComboboxProps } from '@/components/PlaceCombobox';
import { loadPlaces } from '@/lib/places';

vi.mock('@/lib/places', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/places')>();
  return { ...actual, loadPlaces: vi.fn(actual.loadPlaces) };
});

const HAMBURG = '2911298';
const KOELN = '2886242';

function Harness(props: Partial<PlaceComboboxProps> & { onPick?: (id: string | null) => void }) {
  const { onPick, ...rest } = props;
  const [value, setValue] = useState<string | null>(props.value ?? null);
  return (
    <PlaceCombobox
      variant="audience"
      label="Your city"
      {...rest}
      value={value}
      onChange={(id) => {
        setValue(id);
        onPick?.(id);
      }}
    />
  );
}

const combobox = () => screen.getByRole('combobox', { name: 'Your city' });

async function typeAndWait(text: string) {
  await userEvent.type(combobox(), text);
  await waitFor(() => expect(combobox()).toHaveAttribute('aria-expanded', 'true'));
}

beforeEach(() => {
  vi.mocked(loadPlaces).mockClear();
});

describe('PlaceCombobox', () => {
  it('exposes the combobox pattern and loads places only once focused', async () => {
    render(<Harness description="Only your city is shared." />);
    const input = combobox();
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAccessibleDescription('Only your city is shared.');
    const listbox = document.getElementById(input.getAttribute('aria-controls')!);
    expect(listbox).toHaveAttribute('role', 'listbox');
    expect(loadPlaces).not.toHaveBeenCalled();

    await userEvent.click(input);
    expect(loadPlaces).toHaveBeenCalledOnce();
  });

  it('selects with the keyboard: arrows wrap, Home/End jump, Enter picks', async () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    await typeAndWait('hambu');
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(1);
    expect(options[0]).toHaveTextContent('Hamburg');
    expect(options[0]).toHaveTextContent('Germany');
    expect(combobox()).not.toHaveAttribute('aria-activedescendant');

    await userEvent.keyboard('{ArrowDown}');
    expect(combobox()).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}');
    expect(combobox()).toHaveAttribute('aria-activedescendant', options.at(-1)!.id);
    await userEvent.keyboard('{ArrowDown}');
    expect(combobox()).toHaveAttribute('aria-activedescendant', options[0].id);
    await userEvent.keyboard('{End}');
    expect(combobox()).toHaveAttribute('aria-activedescendant', options.at(-1)!.id);
    await userEvent.keyboard('{Home}');
    expect(combobox()).toHaveAttribute('aria-activedescendant', options[0].id);

    await userEvent.keyboard('{Enter}');
    expect(onPick).toHaveBeenCalledWith(HAMBURG);
    expect(screen.getByRole('group', { name: 'Your city' })).toHaveTextContent('Hamburg, Germany');
    expect(screen.getByRole('status')).toHaveTextContent('Hamburg, Germany selected.');
  });

  it('closes on Escape, then clears the query on a second Escape', async () => {
    render(<Harness />);
    await typeAndWait('paris');
    await userEvent.keyboard('{Escape}');
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(combobox()).toHaveValue('paris');
    await userEvent.keyboard('{Escape}');
    expect(combobox()).toHaveValue('');
  });

  it('does not submit the surrounding form while suggestions are open', async () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<form onSubmit={submit}><Harness /></form>);
    await typeAndWait('paris');
    await userEvent.keyboard('{Enter}');
    expect(submit).not.toHaveBeenCalled();
  });

  it('picks with the pointer and shows the exonym that matched', async () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    await typeAndWait('cologne');
    const option = screen.getAllByRole('option')[0];
    expect(option).toHaveTextContent('Köln (Cologne)');
    await userEvent.click(option);
    expect(onPick).toHaveBeenCalledWith(KOELN);
  });

  it('reports no matches', async () => {
    render(<Harness />);
    await userEvent.type(combobox(), 'qqqxxzz');
    expect(await screen.findByText('No matching city. Try the nearest larger city.')).toBeInTheDocument();
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows a selected city as a chip that can be changed', async () => {
    const onPick = vi.fn();
    render(<Harness value={HAMBURG} clearLabel="Remove" onPick={onPick} />);
    expect(await screen.findByText('Hamburg, Germany')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove city: Hamburg, Germany' }));
    expect(onPick).toHaveBeenCalledWith(null);
    expect(combobox()).toHaveFocus();
  });

  it('recovers from a failed load', async () => {
    vi.mocked(loadPlaces).mockRejectedValueOnce(new Error('offline'));
    render(<Harness />);
    await userEvent.click(combobox());
    expect(await screen.findByText('The city list could not be loaded.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(screen.queryByText('The city list could not be loaded.')).not.toBeInTheDocument()
    );
    expect(loadPlaces).toHaveBeenCalledTimes(2);
    await typeAndWait('hamburg');
  });
});
