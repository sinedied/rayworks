import { useEffect, useRef } from 'react';

import { useAudienceSession } from '@/hooks/useAudienceSession';
import { usePresentation } from '@/hooks/usePresentation';
import { ignoresPresentationShortcut } from '@/presentation/shortcuts';

import { PresentationControls } from './PresentationControls';
import { SlideCanvas } from './SlideCanvas';
import { SlideViewport } from './SlideViewport';

export function AudienceView({ sessionId }: { sessionId: string | null }) {
  const { snapshot, status, error, navigate } = useAudienceSession(sessionId);
  const root = useRef<HTMLDivElement>(null);
  const fullscreenButton = useRef<HTMLButtonElement>(null);
  const { fullscreen, notice, enterFullscreen, exit } = usePresentation(root, fullscreenButton);
  const index = snapshot?.slides.findIndex((slide) => slide.id === snapshot.activeId) ?? 0;

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (ignoresPresentationShortcut(event)) return;
      if (event.key === 'Escape') { event.preventDefault(); void exit(); }
      else if (['ArrowRight', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); navigate({ type: 'next' }); }
      else if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); navigate({ type: 'previous' }); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [navigate, exit]);

  return (
    <div className="deck-app is-presenting audience-view" ref={root}>
      {snapshot ? (
        <>
          <div className="stage-shell"><SlideViewport>
            <SlideCanvas slide={snapshot.slides[index]} total={snapshot.slides.length} />
          </SlideViewport></div>
          <PresentationControls index={index} total={snapshot.slides.length}
            disconnected={status !== 'connected'} onPrevious={() => navigate({ type: 'previous' })}
            onNext={() => navigate({ type: 'next' })} fullscreen={fullscreen} fullscreenButton={fullscreenButton}
            onFullscreen={() => void (fullscreen ? exit() : enterFullscreen())} />
        </>
      ) : <main className="audience-waiting">
        <h1>{status === 'ended' ? 'Presentation ended' : status === 'waiting' ? 'Waiting for the presenter' : 'Presenter unavailable'}</h1>
        <p>{status === 'ended' ? 'You can close this window.' : error || 'Keep the presenter window open to connect.'}</p>
      </main>}
      {snapshot && (notice || error || status === 'disconnected') && <p className="presentation-notice" role="status">
        {status === 'disconnected' ? (error || 'Presenter disconnected. Showing the last received slide; navigation is paused.') : error || notice}
      </p>}
    </div>
  );
}
