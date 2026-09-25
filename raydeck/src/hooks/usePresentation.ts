import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

type PresentationMode = 'idle' | 'fullscreen' | 'windowed';

export function usePresentation(
  root: RefObject<HTMLDivElement | null>,
  trigger: RefObject<HTMLButtonElement | null>,
) {
  const [presenting, setPresenting] = useState(false);
  const [notice, setNotice] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const intended = useRef(false);
  const owned = useRef(false);
  const mounted = useRef(true);
  const request = useRef(0);
  const pending = useRef(false);
  const mode = useRef<PresentationMode>('idle');
  const wasPresenting = useRef(false);

  useEffect(() => {
    if (wasPresenting.current && !presenting) trigger.current?.focus();
    wasPresenting.current = presenting;
  }, [presenting, trigger]);

  useEffect(() => {
    mounted.current = true;
    const fullscreenChanged = () => {
      if (document.fullscreenElement === root.current) {
        if (mode.current === 'fullscreen') {
          owned.current = true;
          setFullscreen(true);
        } else {
          setFullscreen(false);
          void document.exitFullscreen().catch((error) => {
            console.error('Could not exit an unexpected Ray|Deck fullscreen state:', error);
          });
        }
      } else {
        setFullscreen(false);
      }
      if (document.fullscreenElement !== root.current && owned.current) {
        owned.current = false;
        if (mode.current === 'fullscreen') {
          mode.current = 'idle';
          intended.current = false;
          request.current += 1;
          setPresenting(false);
          setNotice('');
        }
      }
    };
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () => {
      mounted.current = false;
      mode.current = 'idle';
      intended.current = false;
      request.current += 1;
      document.removeEventListener('fullscreenchange', fullscreenChanged);
    };
  }, [root]);

  const enterFullscreen = useCallback(async () => {
    if (pending.current || mode.current !== 'idle' || !root.current) return;
    mode.current = 'fullscreen';
    intended.current = true;
    const currentRequest = ++request.current;
    const element = root.current;
    setNotice('');
    setPresenting(true);
    if (!element.requestFullscreen) {
      mode.current = 'windowed';
      setNotice('Fullscreen is unavailable in this browser. Presenting in this window instead.');
      return;
    }
    pending.current = true;
    try {
      await element.requestFullscreen();
      if (!mounted.current || currentRequest !== request.current || !intended.current) {
        if (document.fullscreenElement === element) await document.exitFullscreen();
        return;
      }
      owned.current = document.fullscreenElement === element;
    } catch (error) {
      console.error('Could not enter Ray|Deck fullscreen:', error);
      if (mounted.current && currentRequest === request.current && intended.current) {
        setNotice('Fullscreen was blocked. Presenting in this window instead.');
        mode.current = 'windowed';
      }
    } finally {
      pending.current = false;
    }
  }, [root]);

  const enterWindowed = useCallback(() => {
    if (!root.current || mode.current === 'windowed') return;
    request.current += 1;
    mode.current = 'windowed';
    intended.current = true;
    owned.current = false;
    setFullscreen(false);
    setNotice('');
    setPresenting(true);
    if (document.fullscreenElement === root.current) {
      void document.exitFullscreen().catch((error) => {
        console.error('Could not leave fullscreen for windowed presentation:', error);
      });
    }
  }, [root]);

  const exit = useCallback(async () => {
    const exitingMode = mode.current;
    mode.current = 'idle';
    intended.current = false;
    request.current += 1;
    if (root.current && document.fullscreenElement === root.current) {
      try {
        await document.exitFullscreen();
      } catch (error) {
        console.error('Could not exit Ray|Deck fullscreen:', error);
        if (mounted.current) {
          mode.current = exitingMode;
          intended.current = true;
          setNotice('Could not leave fullscreen. Press Escape or use your browser fullscreen controls.');
        }
        return;
      }
    }
    if (mounted.current) {
      owned.current = false;
      setPresenting(false);
      setNotice('');
    }
  }, [root]);

  return {
    presenting,
    fullscreen,
    notice,
    enterFullscreen,
    enterWindowed,
    exit,
  };
}
