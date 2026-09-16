import { describe, expect, it } from 'vitest';

import {
  getVotedQuestionIds,
  getParticipantKey,
  rememberVote,
} from '@/services/identity';

describe('voter identity', () => {
  it('reuses the same voter key across calls', () => {
    const first = getParticipantKey();
    const second = getParticipantKey();

    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it('remembers which questions were upvoted', () => {
    expect(getVotedQuestionIds().size).toBe(0);

    rememberVote('question-1');
    rememberVote('question-2');
    rememberVote('question-1');

    const voted = getVotedQuestionIds();
    expect([...voted].sort()).toEqual(['question-1', 'question-2']);
  });

  it('ignores corrupted storage payloads', () => {
    window.localStorage.setItem('interask:voted', 'not json');

    expect(getVotedQuestionIds().size).toBe(0);
  });
});
