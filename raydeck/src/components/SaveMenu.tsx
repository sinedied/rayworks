import { useEffect, useId, useRef, useState } from 'react';

import type { ChangePrompt } from '@/deck/changes';
import type { SaveState } from '@/hooks/useDeckDraft';

import { Icon } from './Icon';

export function SaveMenu({ saveState, changes, placement = 'below' }: {
  saveState: SaveState; changes: ChangePrompt; placement?: 'above' | 'below';
}) {
  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const manualCopy = useRef<HTMLTextAreaElement>(null);
  const copyRequest = useRef(0);
  const id = useId();
  const label = saveState.status === 'saved' ? 'Saved locally'
    : saveState.status === 'saving' ? 'Saving locally' : 'Not saved locally';
  const prompt = changes.status === 'ready' ? changes.prompt : '';

  useEffect(() => {
    copyRequest.current += 1;
    setCopyState('idle');
    return () => { copyRequest.current += 1; };
  }, [prompt]);

  useEffect(() => {
    if (!open) return;
    action.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  useEffect(() => {
    if (copyState === 'error') {
      manualCopy.current?.focus();
      manualCopy.current?.select();
    }
  }, [copyState]);

  const copy = async () => {
    if (!prompt || copyState === 'copying') return;
    const request = ++copyRequest.current;
    setCopyState('copying');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API is unavailable.');
      await navigator.clipboard.writeText(prompt);
      if (request === copyRequest.current) setCopyState('copied');
    } catch (error) {
      console.error('Could not copy Ray|Deck changes:', error);
      if (request === copyRequest.current) setCopyState('error');
    }
  };

  return (
    <div className={`save-menu ${placement === 'above' ? 'save-menu-above' : ''}`} ref={wrapper}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          if (event.target instanceof HTMLTextAreaElement) return;
          event.preventDefault();
          setOpen(true);
          action.current?.focus();
        }
      }}>
      <button aria-label={`${label}. Open save menu`} aria-expanded={open} aria-haspopup="menu"
        aria-controls={open ? id : undefined} className={`save-state save-state-${saveState.status}`}
        ref={trigger} type="button" onClick={() => setOpen((value) => !value)}>
        <Icon name={saveState.status === 'saved' ? 'check' : saveState.status === 'saving' ? 'clock' : 'warning'} />
        <span>{label}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open && (
        <div className="save-panel">
          <div id={id} role="menu" aria-label="Local changes">
            <button className="save-action" role="menuitem" ref={action} type="button"
              aria-disabled={changes.status !== 'ready' || copyState === 'copying'}
              onClick={() => void copy()}>
              <Icon name={copyState === 'copied' ? 'check' : 'copy'} />
              {copyState === 'copied' ? 'Prompt copied' : copyState === 'copying' ? 'Copying prompt' : 'Copy changes as prompt'}
            </button>
          </div>
          <p className="save-description" role="status">
            {changes.status === 'unchanged' ? 'No local changes to copy.'
              : changes.status === 'invalid' ? changes.error
                : `${changes.count} edited ${changes.count === 1 ? 'field' : 'fields'}. Paste the prompt into your coding assistant to update the bundled deck.`}
          </p>
          {copyState === 'copied' && <p className="save-confirmation" role="status">Copied to clipboard. Source files have not been changed.</p>}
          {copyState === 'error' && (
            <div className="manual-copy">
              <p role="alert">Clipboard access failed. Select and copy the prompt below.</p>
              <textarea ref={manualCopy} readOnly value={prompt} aria-label="Changes prompt for manual copying" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
