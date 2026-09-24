import { describe, expect, it } from 'vitest';

import { createChangePrompt } from './changes';
import { SAMPLE_DECK } from './sampleDeck';

describe('createChangePrompt', () => {
  it('does not export unchanged or reverted text', () => {
    expect(createChangePrompt(SAMPLE_DECK.map((slide) => ({ ...slide })), SAMPLE_DECK))
      .toEqual({ status: 'unchanged' });
  });

  it('exports only changed fields, matched by ID, with exact original and replacement values', () => {
    const replacement = 'Quotes " and \\\\ and ```\nUnicode: \u00e9\u2764\n';
    const slides = SAMPLE_DECK.map((slide, index) => (
      index === 0 ? { ...slide, title: replacement, body: '' }
        : index === 2 ? { ...slide, eyebrow: 'Updated' } : slide
    )).reverse();
    const result = createChangePrompt(slides, SAMPLE_DECK);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected a prompt');
    expect(result.count).toBe(3);
    const data = JSON.parse(result.prompt.slice(result.prompt.indexOf('{\n')));
    expect(data).toEqual({ changes: [
      { slideId: 'opening', fields: [
        { field: 'title', original: SAMPLE_DECK[0].title, replacement },
        { field: 'body', original: SAMPLE_DECK[0].body, replacement: '' },
      ] },
      { slideId: 'trajectory', fields: [
        { field: 'eyebrow', original: SAMPLE_DECK[2].eyebrow, replacement: 'Updated' },
      ] },
    ] });
    expect(result.prompt).toContain('DESIGN.md');
    expect(result.prompt).toContain('raydeck/AGENTS.md');
    expect(result.prompt).toContain('report the conflict');
  });

  it('does not export non-editable metadata or charts', () => {
    const slides = SAMPLE_DECK.map((slide) => ({ ...slide, source: 'Different', number: '99' }));
    expect(createChangePrompt(slides, SAMPLE_DECK)).toEqual({ status: 'unchanged' });
  });

  it('exports exact speaker notes, normalizing absent notes to empty strings', () => {
    expect(createChangePrompt(SAMPLE_DECK.map((slide) => ({ ...slide, notes: '' })), SAMPLE_DECK))
      .toEqual({ status: 'unchanged' });
    const notes = 'Remember: "private"\nSecond point \u00e9';
    const result = createChangePrompt(SAMPLE_DECK.map((slide, index) => index ? slide : { ...slide, notes }), SAMPLE_DECK);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected notes prompt');
    expect(result.count).toBe(1);
    expect(JSON.parse(result.prompt.slice(result.prompt.indexOf('{\n')))).toEqual({
      changes: [{ slideId: 'opening', fields: [{ field: 'notes', original: '', replacement: notes }] }],
    });
    expect(result.prompt).toContain('Never render notes on audience slides');
  });

  it.each(['missing', 'unknown', 'duplicate'])('reports %s slide IDs', (kind) => {
    const slides = SAMPLE_DECK.map((slide) => ({ ...slide }));
    if (kind === 'missing') slides.pop();
    if (kind === 'unknown') slides[0].id = 'unknown';
    if (kind === 'duplicate') slides[0].id = slides[1].id;
    expect(createChangePrompt(slides, SAMPLE_DECK).status).toBe('invalid');
  });
});
