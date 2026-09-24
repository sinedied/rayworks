import type { RefObject } from 'react';

import { usePresentationControls } from '@/hooks/usePresentationControls';

import { Icon } from './Icon';

export function PresentationControls({
  index, total, onPrevious, onNext, onExit, onFullscreen, fullscreen, fullscreenButton, disconnected = false,
}: {
  index: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onExit?: () => void;
  onFullscreen?: () => void;
  fullscreen?: boolean;
  fullscreenButton?: RefObject<HTMLButtonElement | null>;
  disconnected?: boolean;
}) {
  const { visible, controls, ...events } = usePresentationControls();
  return (
    <div ref={controls} {...events} role="toolbar" aria-label="Presentation controls"
      className={`presentation-controls ${visible ? '' : 'controls-hidden'}`}>
      <button aria-label="Previous slide" disabled={index === 0 || disconnected} onClick={onPrevious} type="button">
        <Icon name="chevron-left" />
      </button>
      <span>{index + 1} / {total}</span>
      <button aria-label="Next slide" disabled={index === total - 1 || disconnected} onClick={onNext} type="button">
        <Icon name="chevron-right" />
      </button>
      {onFullscreen && <button ref={fullscreenButton} onClick={onFullscreen} type="button"
        aria-label={fullscreen ? 'Leave fullscreen' : 'Enter fullscreen'}>
        <Icon name="expand" /><span className="control-action-label">{fullscreen ? 'Leave fullscreen' : 'Enter fullscreen'}</span>
      </button>}
      {onExit && <button onClick={onExit} type="button"><Icon name="expand" />Exit</button>}
    </div>
  );
}
