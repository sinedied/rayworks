import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuizJoin } from '@/components/QuizJoin';
import { joinQuiz } from '@/services/quizRuns';
import { getParticipantKey, setParticipantName } from '@/services/identity';
import type { QuizRunData } from '@/lib/quizRuns';
import { room } from './helpers/roomData';

vi.mock('@/services/quizRuns', () => ({ joinQuiz: vi.fn() }));

const data: QuizRunData = {
  run: { id: 'run-one', room_id: room.id, owner_id: room.owner_id, seriesKey: 'series', title: 'Quiz', state: 'lobby', createdAt: new Date() },
  questions: [], options: [], members: [], answers: [], participants: [],
};

describe('explicit quiz joining', () => {
  it('prefills a saved nickname but does not join until the attendee acts', async () => {
    setParticipantName('Ada');
    vi.mocked(joinQuiz).mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<QuizJoin quiz={data} refresh={refresh} />);
    expect(screen.getByLabelText('Your nickname')).toHaveValue('Ada');
    expect(joinQuiz).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Join quiz' }));
    expect(joinQuiz).toHaveBeenCalledWith(room.id, data.run.id, 'Ada');
    expect(refresh).toHaveBeenCalledOnce();
  });
  it('shows a real joined state, not merely a saved nickname', () => {
    render(<QuizJoin quiz={{ ...data, participants: [{
      id: 'member', run_id: data.run.id, room_id: room.id, owner_id: room.owner_id,
      participantKey: getParticipantKey(), participantName: 'Ada', joinKey: 'key', createdAt: new Date(),
    }] }} refresh={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Joined as Ada');
    expect(screen.queryByRole('button', { name: 'Join quiz' })).not.toBeInTheDocument();
  });
  it('surfaces join failures and explains the late-join boundary', async () => {
    vi.mocked(joinQuiz).mockRejectedValue(new Error('Quiz changed'));
    render(<QuizJoin quiz={{ ...data, run: { ...data.run, state: 'running' } }} refresh={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Your nickname'), 'Ben');
    await userEvent.click(screen.getByRole('button', { name: 'Join quiz' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Quiz changed');
    expect(screen.getByText('Join now to answer the next question.')).toBeInTheDocument();
  });
});
