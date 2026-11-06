import { Check, ChevronDown, Clock, Copy, RotateCcw, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import type { SaveState } from '@/hooks/use-story-draft';
import type { ChangePrompt } from '@/story/draft';

type CopyState = 'idle' | 'copying' | 'copied' | 'error';

/**
 * Local save status and actions, mirroring Ray|Deck: edits autosave in this browser, and the
 * prompt export is how they reach the bundled story source.
 */
export function SaveMenu({ saveState, changes, onReset }: {
  saveState: SaveState;
  changes: ChangePrompt;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copy, setCopy] = useState<{ state: CopyState; prompt: string }>({ state: 'idle', prompt: '' });
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const manualCopy = useRef<HTMLTextAreaElement>(null);
  const copyRequest = useRef(0);
  const id = useId();
  const label = saveState.status === 'saved' ? 'Saved locally'
    : saveState.status === 'saving' ? 'Saving locally' : 'Not saved locally';
  const prompt = changes.status === 'ready' ? changes.prompt : '';
  // Copy feedback belongs to the prompt it copied; any edit returns the action to idle.
  const copyState: CopyState = copy.prompt === prompt ? copy.state : 'idle';
  const setCopyState = (state: CopyState) => setCopy({ state, prompt });

  useEffect(() => {
    copyRequest.current += 1;
    return () => { copyRequest.current += 1; };
  }, [prompt]);

  useEffect(() => {
    if (!open) return;
    action.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) {
        setOpen(false);
        setConfirmReset(false);
      }
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

  useEffect(() => {
    if (confirmReset) confirmButton.current?.focus();
  }, [confirmReset]);

  const close = () => {
    setOpen(false);
    setConfirmReset(false);
  };

  const copyPrompt = async () => {
    if (!prompt || copyState === 'copying') return;
    const request = ++copyRequest.current;
    setCopyState('copying');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API is unavailable.');
      await navigator.clipboard.writeText(prompt);
      if (request === copyRequest.current) setCopyState('copied');
    } catch (error) {
      console.error('Could not copy Ray|Atlas changes:', error);
      if (request === copyRequest.current) setCopyState('error');
    }
  };

  const StatusIcon = saveState.status === 'saved' ? Check : saveState.status === 'saving' ? Clock : TriangleAlert;

  return (
    <div className="save-menu" ref={wrapper}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
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
        aria-controls={open ? id : undefined} className={`stage-button save-state save-state-${saveState.status}`}
        ref={trigger} type="button" onClick={() => (open ? close() : setOpen(true))}>
        <StatusIcon className="icon-size-200 save-state-icon" aria-hidden />
        <span className="toolbar-label">{label}</span>
        <ChevronDown className="icon-size-200" aria-hidden />
      </button>
      {open && (
        <div className="stage-panel save-panel">
          <div id={id} role="menu" aria-label="Local changes">
            <button className="panel-action" role="menuitem" ref={action} type="button"
              aria-disabled={changes.status !== 'ready' || copyState === 'copying'}
              onClick={() => void copyPrompt()}>
              {copyState === 'copied' ? <Check className="icon-size-200" aria-hidden /> : <Copy className="icon-size-200" aria-hidden />}
              {copyState === 'copied' ? 'Prompt copied' : copyState === 'copying' ? 'Copying prompt' : 'Copy changes as prompt'}
            </button>
            {!confirmReset && (
              <button className="panel-action" role="menuitem" type="button" onClick={() => setConfirmReset(true)}>
                <RotateCcw className="icon-size-200" aria-hidden />
                Reset sample story
              </button>
            )}
          </div>
          {confirmReset && (
            <div className="panel-confirm" role="group" aria-label="Confirm reset">
              <p>Discard every local edit and restore the bundled sample story? This can’t be undone.</p>
              <div className="panel-confirm-actions">
                <button ref={confirmButton} type="button" className="stage-button stage-button-danger"
                  onClick={() => {
                    onReset();
                    close();
                    trigger.current?.focus();
                  }}>
                  Reset story
                </button>
                <button type="button" className="stage-button" onClick={() => setConfirmReset(false)}>Cancel</button>
              </div>
            </div>
          )}
          {saveState.status === 'error' && saveState.message && (
            <p className="panel-description panel-warning" role="alert">{saveState.message}</p>
          )}
          <p className="panel-description" role="status">
            {changes.status === 'unchanged' ? 'No local changes to copy.'
              : `${changes.count} edited ${changes.count === 1 ? 'field' : 'fields'}. Paste the prompt into your coding assistant to update the bundled story.`}
          </p>
          {copyState === 'copied' && <p className="panel-description panel-confirmation" role="status">Copied to clipboard. Source files have not been changed.</p>}
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
