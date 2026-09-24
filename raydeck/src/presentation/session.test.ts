import { describe, expect, it } from 'vitest';

import { SAMPLE_DECK } from '@/deck/sampleDeck';
import { audienceSessionId, audienceSlides, belongsToSession, isSessionMessage, message, navigateIndex } from './session';

describe('presenter session protocol', () => {
  it('sends only public slide fields, retaining chart content but excluding notes', () => {
    const slides = audienceSlides(SAMPLE_DECK.map((slide) => ({ ...slide, notes: 'Private talking point' })));
    expect(JSON.stringify(slides)).not.toContain('Private talking point');
    expect(slides.every((slide) => !('notes' in slide))).toBe(true);
    expect(slides[2].chart).toEqual(SAMPLE_DECK[2].chart);
    expect(isSessionMessage(message('session', { type: 'state', revision: 1, activeId: 'opening', slides }))).toBe(true);
  });

  it('rejects invalid state, navigation, and private notes in snapshots', () => {
    const state = { type: 'state', revision: 1, activeId: 'opening', slides: audienceSlides(SAMPLE_DECK) } as const;
    for (const body of [
      { ...state, revision: -1 }, { ...state, slides: [] }, { ...state, activeId: 'unknown' },
      { ...state, slides: [state.slides[0], state.slides[0]] },
      { ...state, slides: [{ ...state.slides[0], notes: 'Private' }] },
      { ...state, slides: [{ ...state.slides[0], title: 12 }] },
      { type: 'navigate', clientId: 'client', commandId: 0, command: { type: 'next' } },
      { type: 'navigate', clientId: 'client', commandId: 1, command: { type: 'unexpected' } },
    ]) {
      expect(isSessionMessage({ ...body, protocol: 'raydeck.presenter.v1', sessionId: 'session' })).toBe(false);
    }
  });

  it('isolates sessions and ignores unrelated host messages', () => {
    expect(belongsToSession(message('a', { type: 'ping' }), 'b')).toBe(false);
    expect(belongsToSession({ type: 'fabric-event' }, 'a')).toBe(false);
    expect(isSessionMessage({ protocol: 'v0', sessionId: 'a', type: 'ping' })).toBe(false);
    expect(audienceSessionId('#audience=85c401a9-a23f-4516-b6ed-1fcd8b3cc260')).toBe('85c401a9-a23f-4516-b6ed-1fcd8b3cc260');
    expect(audienceSessionId('#audience=invalid')).toBeNull();
  });

  it('uses the same bounded navigation for both windows', () => {
    expect(navigateIndex(0, SAMPLE_DECK, { type: 'previous' })).toBe(0);
    expect(navigateIndex(4, SAMPLE_DECK, { type: 'next' })).toBe(4);
    expect(navigateIndex(0, SAMPLE_DECK, { type: 'goTo', slideId: 'channels' })).toBe(3);
    expect(navigateIndex(2, SAMPLE_DECK, { type: 'goTo', slideId: 'missing' })).toBe(2);
  });
});
