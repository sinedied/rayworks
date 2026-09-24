import { useId } from 'react';

import type { ChangePrompt } from '@/deck/changes';
import type { DeckSlide } from '@/deck/sampleDeck';
import type { SaveState } from '@/hooks/useDeckDraft';
import type { AudienceConnection } from '@/hooks/usePresenterSession';
import { usePresenterTimer } from '@/hooks/usePresenterTimer';
import type { ViewPreferences } from '@/hooks/useViewPreferences';

import { Icon } from './Icon';
import { SaveMenu } from './SaveMenu';
import { SlideCanvas } from './SlideCanvas';
import { SlidePicker } from './SlidePicker';
import { SlideViewport } from './SlideViewport';
import { SpeakerNotes } from './SpeakerNotes';
import { PresenterPanes } from './PresenterPanes';

function PresenterTimer() {
  const timer = usePresenterTimer();
  const seconds = Math.floor(timer.elapsed / 1000);
  const display = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((value) => String(value).padStart(2, '0')).join(':');
  return (
    <div className="presenter-timer" aria-label="Presentation timer">
      <output role="timer" aria-label="Elapsed time" aria-live="off">{display}</output>
      <button className="icon-button" type="button" aria-label={timer.paused ? 'Resume timer' : 'Pause timer'}
        title={timer.paused ? 'Resume timer' : 'Pause timer'}
        onClick={timer.toggle}><Icon name={timer.paused ? 'play' : 'pause'} /></button>
      <button className="icon-button" type="button" aria-label="Reset timer" title="Reset timer" onClick={timer.reset}><Icon name="reset" /></button>
    </div>
  );
}

export function PresenterView({
  slides, index, connection, onNavigate, onNotes, onOpen, onEnd,
  saveState, changes, isDark, onTheme, error,
  preferences, preferenceNotice, onSplitRatio, onNotesSize,
}: {
  slides: DeckSlide[]; index: number; connection: AudienceConnection;
  onNavigate: (index: number) => void; onNotes: (value: string) => void;
  onOpen: () => void; onEnd: () => void;
  saveState: SaveState; changes: ChangePrompt; isDark: boolean; onTheme: () => void; error: string;
  preferences: ViewPreferences; preferenceNotice: string;
  onSplitRatio: (ratio: number) => void; onNotesSize: (size: number) => void;
}) {
  const currentId = useId();
  const sidebarId = useId();
  const slide = slides[index];
  const next = slides[index + 1];
  const audienceAction = connection === 'closed' ? 'Reopen audience window'
    : connection === 'disconnected' ? 'Reconnect audience' : 'Show audience window';
  return (
    <main className="presenter-view" aria-label="Presenter view">
      {(error || preferenceNotice || saveState.status === 'error') && <div className="presenter-notices" tabIndex={0} aria-label="Presenter notices">
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        {preferenceNotice && <p className="notice notice-warning" role="status">{preferenceNotice}</p>}
        {saveState.status === 'error' && <p className="notice notice-error" role="alert">{saveState.message}</p>}
      </div>}
      <PresenterPanes ratio={preferences.splitRatio} onRatioChange={onSplitRatio} currentId={currentId} sidebarId={sidebarId} current={
        <section className="presenter-current" aria-label="Current slide" id={currentId}>
          <div className="preview-label"><h2>Current slide</h2><span>{index + 1} of {slides.length}</span></div>
          <div className="presenter-preview">
            <SlideViewport centered><SlideCanvas slide={slide} total={slides.length} /></SlideViewport>
          </div>
        </section>
      } sidebar={
        <aside className="presenter-sidebar" aria-label="Next slide and notes" id={sidebarId}>
          <section className="presenter-next" aria-label="Next slide">
            <div className="preview-label"><h2>Next</h2>{next && <span title={next.title}>{next.title || 'Untitled slide'}</span>}</div>
            {next ? <div className="presenter-preview" aria-hidden="true" inert>
              <SlideViewport centered><SlideCanvas slide={next} total={slides.length} /></SlideViewport>
            </div> : <div className="presenter-end"><Icon name="check" />End of deck</div>}
          </section>
          <SpeakerNotes value={slide.notes ?? ''} onChange={onNotes} slideNumber={slide.number}
            fontSize={preferences.notesFontSize} onFontSizeChange={onNotesSize} />
        </aside>
      } />
      <footer className="presenter-controls" aria-label="Presenter controls">
        <div className="presenter-primary-controls">
          <div className="presenter-navigation" aria-label="Slide navigation">
            <button className="icon-button" aria-label="Previous" title="Previous slide"
              disabled={index === 0} type="button" onClick={() => onNavigate(index - 1)}><Icon name="chevron-left" /></button>
            <SlidePicker slides={slides} index={index} onNavigate={onNavigate} />
            <button className="icon-button" aria-label="Next" title="Next slide"
              disabled={!next} type="button" onClick={() => onNavigate(index + 1)}><Icon name="chevron-right" /></button>
          </div>
          <PresenterTimer />
        </div>
        <div className="presenter-utilities">
          <p className={`audience-connection connection-${connection}`} role="status">
            {connection === 'connected' ? 'Audience connected' : connection === 'connecting' ? 'Connecting to audience...'
              : connection === 'closed' ? 'Audience window closed' : 'Audience disconnected'}
          </p>
          <button className="icon-button" type="button" onClick={onOpen} aria-label={audienceAction} title={audienceAction}>
            <Icon name="presenter" />
          </button>
          <SaveMenu saveState={saveState} changes={changes} placement="above" />
          <button className="icon-button" type="button" onClick={onTheme} aria-label="Toggle theme" title="Toggle theme">
            <Icon name={isDark ? 'sun' : 'moon'} />
          </button>
          <button className="secondary-button presenter-exit" type="button" onClick={onEnd} aria-label="End presentation">
            End<span> presentation</span>
          </button>
        </div>
      </footer>
    </main>
  );
}
