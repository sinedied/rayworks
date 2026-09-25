import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ResponseModeration } from '@/components/ResponseModeration';
import { ActivityResults } from '@/components/ActivityResults';
import { activity as activityRow, answer } from './helpers/roomData';

const activity = { ...activityRow, kind: 'openText' as const, startedAt: undefined };
const callbacks = () => ({
  onDeleteResponse: vi.fn().mockResolvedValue(true),
  onDeleteWord: vi.fn().mockResolvedValue(true),
});

describe('response moderation list', () => {
  it('exposes every stored response beyond the shared result limit, including hidden history', async () => {
    const actions = callbacks();
    const answers = Array.from({ length: 125 }, (_, index) => ({
      ...answer, id: `answer-${index}`, textValue: `Stored response ${index}`,
      submissionId: `s-${index}`, createdAt: new Date(index * 1000),
    }));
    render(<ResponseModeration activity={activity} answers={answers} busy={false} {...actions} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(125);
    expect(screen.getAllByText(/Earlier version/)).toHaveLength(124);
    const oldest = screen.getByText('Stored response 0').closest('li')!;
    expect(within(oldest).getByText(/Hidden/)).toBeInTheDocument();
    await userEvent.click(within(oldest).getByRole('button', { name: 'Delete response' }));
    expect(actions.onDeleteResponse).toHaveBeenCalledWith(answers[0]);
    expect(screen.getByRole('heading', { name: 'Manage responses' })).toHaveFocus();
  });

  it('groups all stored cloud occurrences with the aggregation normalization', async () => {
    const actions = callbacks();
    render(<ResponseModeration activity={{ ...activity, kind: 'wordCloud' }} answers={[
      { ...answer, id: 'one', textValue: ' Cloud ' },
      { ...answer, id: 'two', textValue: 'cloud', isHidden: false },
      { ...answer, id: 'three', textValue: 'cloud!' },
    ]} busy={false} {...actions} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const entry = screen.getByText('2 stored occurrences').closest('li')!;
    expect(within(entry).getByRole('button', { name: 'Delete all occurrences' })).toHaveAccessibleDescription('Cloud');
    await userEvent.click(within(entry).getByRole('button', { name: 'Delete all occurrences' }));
    expect(actions.onDeleteWord).toHaveBeenCalledWith(expect.objectContaining({ word: 'Cloud', count: 2 }));
    expect(actions.onDeleteResponse).not.toHaveBeenCalled();
  });

  it('disables deletion while busy and shows a useful empty state after refresh', () => {
    const actions = callbacks();
    const view = render(<ResponseModeration activity={activity}
      answers={[{ ...answer, textValue: 'Response' }]} busy {...actions} />);
    expect(screen.getByRole('button', { name: 'Delete response' })).toBeDisabled();
    view.rerender(<ResponseModeration activity={activity} answers={[]} busy={false} {...actions} />);
    expect(screen.getByText('No stored responses to manage.')).toBeInTheDocument();
  });
});

it.each(['wordCloud', 'openText'] as const)('keeps shared %s result rendering read-only', (kind) => {
  const answers = [{ ...answer, textValue: 'Visible response', isHidden: false }];
  const view = render(<ActivityResults activity={{ ...activity, kind }} answers={answers} options={[]} />);
  expect(screen.queryByRole('button', { name: /Delete|Manage responses/ })).not.toBeInTheDocument();
  view.rerender(<ActivityResults activity={{ ...activity, kind }} answers={answers} options={[]} stage />);
  expect(screen.queryByRole('button', { name: /Delete|Manage responses/ })).not.toBeInTheDocument();
  view.rerender(<ActivityResults activity={{ ...activity, kind }} answers={[]} options={[]} stage />);
  expect(screen.queryByText('Visible response')).not.toBeInTheDocument();
});
