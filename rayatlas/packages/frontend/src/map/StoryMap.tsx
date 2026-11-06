import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { RefreshCw } from 'lucide-react';
import type { NetworkData } from '@rayfin-app/shared';

import type { StoryScene } from '@/story/scenes';
import type { StoryCamera } from '@/story/types';

import { atlasMapPalette, resolveAtlasStyle } from './atlas-style';
import type { CameraPadding } from './camera';
import type { StoryMapEngine } from './story-map-engine';
import { supportsWebGL } from './webgl';

export interface StoryMapHandle {
  /** The live camera, rounded for storage; `null` until the map is ready. */
  getCamera(): StoryCamera | null;
  /** Fly back to the current scene's saved view. */
  returnToScene(): void;
}

export interface StoryMapProps {
  network: NetworkData;
  scene: StoryScene;
  padding: CameraPadding;
  /** Free camera control (edit mode). */
  interactive: boolean;
  reducedMotion: boolean;
  ref?: Ref<StoryMapHandle>;
}

type MapStatus =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'degraded'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'unsupported' };

const LOAD_FAILED = 'The map could not start. Check your connection, then try again.';

/**
 * One lazily loaded MapLibre globe shared by the reader, presentation, and editor. The map is
 * decorative support for the story: every fact it shows is also in the chapter text, so failures
 * stay contained here and the story remains readable.
 */
export function StoryMap({ network, scene, padding, interactive, reducedMotion, ref }: StoryMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<StoryMapEngine | null>(null);
  const [webgl] = useState(supportsWebGL);
  const [status, setStatus] = useState<MapStatus>(() => (webgl ? { kind: 'loading' } : { kind: 'unsupported' }));
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({ network, scene, padding, interactive, reducedMotion });
  useEffect(() => {
    latest.current = { network, scene, padding, interactive, reducedMotion };
  });

  useEffect(() => {
    if (!webgl) return;
    let cancelled = false;
    let instance: StoryMapEngine | null = null;
    import('./story-map-engine')
      .then(({ StoryMapEngine }) => {
        if (cancelled || !container.current) return;
        try {
          instance = new StoryMapEngine({
            ...latest.current,
            container: container.current,
            style: resolveAtlasStyle(import.meta.env),
            palette: atlasMapPalette,
            onStatus: (next) => {
              if (cancelled) return;
              if (next.kind === 'ready') setStatus({ kind: 'ready' });
              else if (next.fatal) setStatus({ kind: 'error', message: next.message });
              else setStatus({ kind: 'degraded', message: next.message });
            },
          });
          engine.current = instance;
        } catch (error) {
          console.error('Could not create the Ray|Atlas map:', error);
          setStatus({ kind: 'error', message: LOAD_FAILED });
        }
      })
      .catch((error: unknown) => {
        console.error('Could not load the Ray|Atlas map:', error);
        if (!cancelled) setStatus({ kind: 'error', message: LOAD_FAILED });
      });
    return () => {
      cancelled = true;
      instance?.destroy();
      engine.current = null;
    };
  }, [webgl, attempt]);

  useEffect(() => {
    engine.current?.setNetwork(network);
  }, [network]);

  useEffect(() => {
    engine.current?.setScene(scene, padding, reducedMotion);
  }, [scene, padding, reducedMotion, status.kind]);

  useEffect(() => {
    engine.current?.setInteractive(interactive);
  }, [interactive, status.kind]);

  useImperativeHandle(ref, () => ({
    getCamera: () => engine.current?.getCamera() ?? null,
    returnToScene: () => engine.current?.returnToScene(),
  }), []);

  const retry = () => {
    setStatus({ kind: 'loading' });
    setAttempt((value) => value + 1);
  };

  return (
    <div className="story-map" data-status={status.kind} data-interactive={interactive || undefined}>
      <div ref={container} className="story-map-canvas" />
      {status.kind === 'loading' && (
        <p className="story-map-loading" role="status">
          <span className="story-map-loading-mark" aria-hidden />
          Loading the map…
        </p>
      )}
      {status.kind === 'error' && (
        <div className="story-map-notice" role="alert">
          <p>{status.message}</p>
          <button type="button" className="stage-button" onClick={retry}>
            <RefreshCw className="icon-size-200" aria-hidden />
            Try again
          </button>
        </div>
      )}
      {status.kind === 'degraded' && (
        <div className="story-map-toast" role="status">
          <p>{status.message}</p>
          <button type="button" className="stage-link" onClick={retry}>Reload map</button>
        </div>
      )}
      {status.kind === 'unsupported' && (
        <div className="story-map-fallback" role="note">
          <svg viewBox="0 0 200 200" aria-hidden className="story-map-fallback-globe">
            <circle cx="100" cy="100" r="88" />
            <ellipse cx="100" cy="100" rx="88" ry="30" />
            <ellipse cx="100" cy="100" rx="40" ry="88" />
            <line x1="12" y1="100" x2="188" y2="100" />
          </svg>
          <p>
            This browser can’t draw the 3D map because WebGL is turned off or unavailable. Every chapter,
            figure, and route is still in the story.
          </p>
        </div>
      )}
    </div>
  );
}
