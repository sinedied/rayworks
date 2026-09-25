import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ActivityKind } from '../../rayfin/data/Activity';
import { ActivityBuilder } from '@/components/ActivityBuilder';
import { activity as activityRow, option } from './helpers/roomData';

const activity = { ...activityRow, startedAt: undefined };
const options = [option, { ...option, id: 'second', label: 'Two', position: 1, isCorrect: false }];

describe('activity editor', () => {
  it('prefills fields, keeps its type fixed, and submits options by identity', async () => {
    const save = vi.fn().mockResolvedValue(true);
    render(<ActivityBuilder mode="edit" activity={activity} options={options} busy={false} onSave={save} onCancel={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Question' })).toHaveValue(activity.prompt);
    expect(screen.getByLabelText('Option 1 is correct')).toBeChecked();
    expect(screen.getByLabelText('Option 2 is correct')).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /Multiple choice/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Option 2 is correct'));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      id: activity.id, kind: 'quiz', timeLimitSeconds: 20, showResults: true,
      options: [
        { id: option.id, label: 'One', isCorrect: true },
        { id: 'second', label: 'Two', isCorrect: true },
      ],
    }));
  });

  it.each<ActivityKind>(['multipleChoice', 'wordCloud', 'rating', 'openText', 'ranking', 'quiz'])(
    'round-trips %s settings', async (kind) => {
      const save = vi.fn().mockResolvedValue(true);
      render(<ActivityBuilder mode="edit" activity={{
        ...activity, kind, maxRating: 8, timeLimitSeconds: 0,
        allowMultiple: true, allowChangeAnswer: true, showResults: false,
      }} options={options} busy={false} onSave={save} onCancel={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(save).toHaveBeenCalledWith(expect.objectContaining({
        kind, maxRating: 8, timeLimitSeconds: 0, allowMultiple: true,
        allowChangeAnswer: true, showResults: false,
      }));
    }
  );

  it('preserves unsaved input during polls and failed saves; cancel never saves', async () => {
    const save = vi.fn().mockResolvedValue(false);
    const cancel = vi.fn();
    const props = { mode: 'edit' as const, activity, options, busy: false, onSave: save, onCancel: cancel };
    const view = render(<ActivityBuilder {...props} />);
    const field = screen.getByRole('textbox', { name: 'Question' });
    await userEvent.clear(field);
    await userEvent.type(field, 'My unsaved draft');
    view.rerender(<ActivityBuilder {...props} activity={{ ...activity, prompt: 'Polled title' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(field).toHaveValue('My unsaved draft');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
  });

  it('retains a failed creation, including IDs needed to retry a partial save', async () => {
    const create = vi.fn().mockResolvedValue(false);
    render(<ActivityBuilder onCreate={create} busy={false} />);
    await userEvent.click(screen.getByRole('button', { name: '+ Add an activity' }));
    await userEvent.type(screen.getByLabelText('Question'), 'New question');
    await userEvent.type(screen.getByLabelText('Option 1'), 'One');
    await userEvent.type(screen.getByLabelText('Option 2'), 'Two');
    await userEvent.click(screen.getByRole('button', { name: 'Add multiple choice' }));
    const first = create.mock.calls[0][0];
    expect(screen.getByLabelText('Question')).toHaveValue('New question');
    await userEvent.click(screen.getByRole('button', { name: 'Add multiple choice' }));
    expect(create.mock.calls[1][0]).toEqual(first);
  });

  it('disables save but allows cancellation when an answer arrives', () => {
    render(<ActivityBuilder mode="edit" activity={activity} options={options} busy={false}
      blockedReason="Clear all responses before editing this activity." onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });
});
