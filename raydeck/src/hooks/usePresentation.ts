import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

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
  const wasPresenting = useRef(false);

  useEffect(() => {
    if (wasPresenting.current && !presenting) trigger.current?.focus();
    wasPresenting.current = presenting;
  }, [presenting, trigger]);

  useEffect(() => {
    mounted.current = true;
    const fullscreenChanged = () => {
      setFullscreen(document.fullscreenElement === root.current);
      if (document.fullscreenElement === root.current) {
        owned.current = true;
      } else if (owned.current) {
        owned.current = false;
        intended.current = false;
        request.current += 1;
        setPresenting(false);
        setNotice('');
      }
    };
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () => {
      mounted.current = false;
      intended.current = false;
      request.current += 1;
      document.removeEventListener('fullscreenchange', fullscreenChanged);
    };
  }, [root]);

  const enter = useCallback(async () => {
    if (pending.current || (intended.current && document.fullscreenElement === root.current) || !root.current) return;
    intended.current = true;
    const currentRequest = ++request.current;
    const element = root.current;
    setNotice('');
    setPresenting(true);
    if (!element.requestFullscreen) {
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
      }
    } finally {
      pending.current = false;
    }
  }, [root]);

  const exit = useCallback(async () => {
    intended.current = false;
    request.current += 1;
    if (root.current && document.fullscreenElement === root.current) {
      try {
        await document.exitFullscreen();
      } catch (error) {
        console.error('Could not exit Ray|Deck fullscreen:', error);
        if (mounted.current) {
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

  return { presenting, fullscreen, notice, enter, exit };
}
