import { useCallback, useEffect, useState } from 'react';

import { EDITABLE_FIELDS, type EditableField } from '@/deck/changes';
import { SAMPLE_DECK, type DeckSlide } from '@/deck/sampleDeck';

const STORAGE_KEY = 'raydeck.sample-deck.v1';

export type SaveState =
  | { status: 'saving' | 'saved' }
  | { status: 'error'; message: string };

function isStoredSlide(value: unknown): value is Pick<DeckSlide, 'id' | EditableField> {
  return typeof value === 'object' && value !== null
    && 'id' in value && typeof value.id === 'string'
    && EDITABLE_FIELDS.every((field) => field in value && typeof Reflect.get(value, field) === 'string');
}

function loadDraft() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === null) return { slides: SAMPLE_DECK, blocked: false, error: '' };
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every(isStoredSlide)) {
      throw new Error('Local draft has invalid slide text.');
    }
    const stored = new Map(parsed.map((slide) => [slide.id, slide]));
    if (parsed.length !== SAMPLE_DECK.length || stored.size !== parsed.length
      || SAMPLE_DECK.some((slide) => !stored.has(slide.id))) {
      throw new Error('Local draft slide IDs do not match the bundled deck.');
    }
    return {
      slides: SAMPLE_DECK.map((slide) => {
        const text = stored.get(slide.id)!;
        return { ...slide, eyebrow: text.eyebrow, title: text.title, body: text.body };
      }),
      blocked: false,
      error: '',
    };
  } catch (error) {
    console.error('Could not load the Ray|Deck draft:', error);
    return {
      slides: SAMPLE_DECK,
      blocked: true,
      error: 'Could not read the local draft. It has not been overwritten. New edits are not saved; copy them as a prompt, or reset the deck to replace the stored draft.',
    };
  }
}

export function useDeckDraft() {
  const [initial] = useState(loadDraft);
  const [slides, setSlides] = useState(initial.slides);
  const [blocked, setBlocked] = useState(initial.blocked);
  const [saveState, setSaveState] = useState<SaveState>(
    initial.blocked ? { status: 'error', message: initial.error } : { status: 'saving' },
  );

  useEffect(() => {
    if (blocked) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slides));
      setSaveState({ status: 'saved' });
    } catch (error) {
      console.error('Could not save the Ray|Deck draft:', error);
      setSaveState({
        status: 'error',
        message: 'Changes could not be saved locally. Keep this tab open and copy your changes as a prompt.',
      });
    }
  }, [slides, blocked]);

  const updateSlide = useCallback((id: string, field: EditableField, value: string) => {
    if (!blocked) setSaveState({ status: 'saving' });
    setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, [field]: value } : slide));
  }, [blocked]);

  const resetDeck = useCallback(() => {
    // Replace the stored draft with one write; a failed reset must not delete it first.
    setBlocked(false);
    setSaveState({ status: 'saving' });
    setSlides(SAMPLE_DECK.map((slide) => ({ ...slide })));
  }, []);

  return { slides, saveState, updateSlide, resetDeck };
}
