import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RatingInput } from '../components/RatingInput';
import type { NumericFieldSettings } from '../lib/numericFields';

function RatingHarness({ settings, required = false }: {
  settings: NumericFieldSettings; required?: boolean;
}) {
  const [value, setValue] = useState('');
  return (
    <>
      <RatingInput id="rating" label="Usefulness" settings={settings} value={value}
        required={required} onChange={setValue} />
      <output data-testid="answer">{value}</output>
    </>
  );
}

describe('RatingInput', () => {
  it.each([[1, 5, 1], [0, 4, 1], [10, 50, 10]])(
    'uses five buttons for %s/%s/%s', (min, max, interval) => {
      render(<RatingHarness settings={{ min, max, interval }} />);
      expect(screen.getAllByRole('radio')).toHaveLength(5);
      expect(screen.queryByRole('slider')).toBeNull();
      expect(screen.getByTestId('answer')).toBeEmptyDOMElement();
      expect(screen.queryByRole('radio', { checked: true })).toBeNull();
    }
  );

  it('chooses zero and clears optional ratings', async () => {
    const user = userEvent.setup();
    render(<RatingHarness settings={{ min: 0, max: 4, interval: 1 }} />);
    await user.click(screen.getByRole('radio', { name: '0' }));
    expect(screen.getByTestId('answer')).toHaveTextContent('0');
    await user.click(screen.getByRole('button', { name: 'Clear rating' }));
    expect(screen.getByTestId('answer')).toBeEmptyDOMElement();
  });

  it('does not select a required rating just by rendering', () => {
    const onChange = vi.fn();
    render(<RatingInput id="rating" label="Usefulness" settings={{ min: 0, max: 5, interval: 1 }}
      value="" required onChange={onChange} />);
    expect(screen.getAllByRole('slider')).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'No rating selected');
  });

  it('supports deliberate minimum selection and stepped keyboard movement', async () => {
    const user = userEvent.setup();
    render(<RatingHarness settings={{ min: 1, max: 11, interval: 2, minLabel: 'Low', maxLabel: 'High' }} />);
    const slider = screen.getByRole('slider', { name: 'Usefulness' });
    slider.focus();
    expect(screen.getByTestId('answer')).toBeEmptyDOMElement();
    await user.keyboard('{Home}');
    expect(screen.getByTestId('answer')).toHaveTextContent('1');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('answer')).toHaveTextContent('3');
    await user.keyboard('{End}');
    expect(screen.getByTestId('answer')).toHaveTextContent('11');
    expect(slider).toHaveAccessibleDescription('1 - Low 11 - High');
    await user.click(screen.getByRole('button', { name: 'Clear rating' }));
    expect(screen.getByTestId('answer')).toBeEmptyDOMElement();
    fireEvent.pointerUp(slider);
    expect(screen.getByTestId('answer')).toHaveTextContent('1');
  });

  it('supports keyboard-operated numbered choices', async () => {
    const user = userEvent.setup();
    render(<RatingHarness settings={{ min: 1, max: 5, interval: 1 }} required />);
    await user.tab();
    await user.keyboard(' ');
    expect(screen.getByTestId('answer')).toHaveTextContent('1');
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByTestId('answer')).toHaveTextContent('2'));
    expect(screen.queryByRole('button', { name: 'Clear rating' })).toBeNull();
  });
});
