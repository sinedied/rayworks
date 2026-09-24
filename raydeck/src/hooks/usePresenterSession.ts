import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DeckSlide } from '@/deck/sampleDeck';
import {
  audienceSlides, belongsToSession, CONNECTION_TIMEOUT_MS, HEARTBEAT_MS, isSessionMessage, message,
  type Navigation, type SessionBody,
} from '@/presentation/session';

type Pair = {
  id: string; window: Window; lastSeen: number; revision: number; acknowledged: number;
  clientId: string; commandId: number;
};
export type AudienceConnection = 'connecting' | 'connected' | 'disconnected' | 'closed';

function closeAudience(audience: Window) {
  try { audience.close(); }
  catch (cause) { console.error('Could not close the ended audience window:', cause); }
}

export function usePresenterSession(slides: DeckSlide[], activeId: string, navigate: (command: Navigation) => void) {
  const [active, setActive] = useState(false);
  const [connection, setConnection] = useState<AudienceConnection>('closed');
  const [error, setError] = useState('');
  const pair = useRef<Pair | null>(null);
  const latest = useRef({ slides, activeId, navigate });
  latest.current = { slides, activeId, navigate };
  const publicState = useMemo(() => JSON.stringify({ slides: audienceSlides(slides), activeId }), [slides, activeId]);

  const send = useCallback((body: SessionBody) => {
    const current = pair.current;
    if (!current || current.window.closed) return;
    try {
      current.window.postMessage(message(current.id, body), window.location.origin);
    } catch (cause) {
      console.error('Could not send audience state:', cause);
      setError('Could not reach the audience window. Reopen it or end presenter mode.');
      setConnection('disconnected');
    }
  }, []);

  const sendState = useCallback(() => {
    const current = pair.current;
    if (!current) return;
    current.revision += 1;
    send({ type: 'state', revision: current.revision, slides: audienceSlides(latest.current.slides), activeId: latest.current.activeId });
  }, [send]);

  useEffect(() => { if (active) sendState(); }, [publicState, active, sendState]);

  const end = useCallback(() => {
    const current = pair.current;
    send({ type: 'end' });
    pair.current = null;
    if (current && !current.window.closed) closeAudience(current.window);
    setActive(false);
    setConnection('closed');
    setError('');
  }, [send]);

  const open = useCallback(() => {
    const previous = pair.current;
    if (previous && !previous.window.closed && connection !== 'disconnected') {
      previous.window.focus();
      previous.lastSeen = performance.now();
      setConnection('connecting');
      setError('');
      sendState();
      return;
    }
    const id = crypto.randomUUID();
    const url = new URL(window.location.href);
    url.hash = new URLSearchParams({ audience: id }).toString();
    try {
      const audience = window.open(url, `raydeck-audience-${id}`, 'popup,width=1280,height=720');
      if (!audience || audience.closed) {
        setError('The audience window was blocked. Allow popups for this site and try Enter presenter mode again.');
        return;
      }
      if (previous && previous.window !== audience && !previous.window.closed) {
        send({ type: 'end' });
        closeAudience(previous.window);
      }
      pair.current = { id, window: audience, lastSeen: performance.now(), revision: 0, acknowledged: -1, clientId: '', commandId: 0 };
      setError('');
      setConnection('connecting');
      setActive(true);
    } catch (cause) {
      console.error('Could not open the audience window:', cause);
      setError('The browser prevented the audience window from opening. Allow popups or use Start presentation.');
    }
  }, [connection, send, sendState]);

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      const current = pair.current;
      if (!current || event.source !== current.window || event.origin !== window.location.origin
        || !belongsToSession(event.data, current.id)) return;
      if (!isSessionMessage(event.data)) {
        console.error('Invalid message from the paired audience window.');
        setError('The audience window sent an invalid message. Reload it to reconnect.');
        setConnection('disconnected');
        return;
      }
      const data = event.data;
      current.lastSeen = performance.now();
      if (data.type === 'ready') {
        if (data.clientId !== current.clientId) { current.clientId = data.clientId; current.commandId = 0; }
        setConnection('connecting');
        sendState();
      } else if (data.type === 'ack' && data.revision === current.revision) {
        current.acknowledged = data.revision;
        setConnection('connected');
        setError('');
      } else if (data.type === 'navigate' && data.clientId === current.clientId
        && data.commandId > current.commandId) {
        current.commandId = data.commandId;
        latest.current.navigate(data.command);
      } else if (data.type === 'ping' || data.type === 'pong') {
        if (data.type === 'ping') send({ type: 'pong' });
        if (current.acknowledged !== current.revision) sendState();
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [send, sendState]);

  useEffect(() => {
    if (!active) return;
    const check = () => {
      const current = pair.current;
      if (!current) return;
      if (current.window.closed) {
        setConnection('closed');
        return;
      }
      if (performance.now() - current.lastSeen > CONNECTION_TIMEOUT_MS) {
        setConnection('disconnected');
        current.acknowledged = -1;
      }
      send({ type: 'ping' });
    };
    const interval = window.setInterval(check, HEARTBEAT_MS);
    window.addEventListener('focus', check);
    return () => { clearInterval(interval); window.removeEventListener('focus', check); };
  }, [active, send]);

  useEffect(() => {
    const notifyEnd = () => {
      const current = pair.current;
      if (current && !current.window.closed) {
        try { current.window.postMessage(message(current.id, { type: 'end' }), window.location.origin); }
        catch (cause) { console.error('Could not notify the audience that the presenter closed:', cause); }
      }
    };
    window.addEventListener('pagehide', notifyEnd);
    const restore = (event: PageTransitionEvent) => { if (event.persisted) end(); };
    window.addEventListener('pageshow', restore);
    return () => {
      notifyEnd();
      pair.current = null;
      window.removeEventListener('pagehide', notifyEnd);
      window.removeEventListener('pageshow', restore);
    };
  }, [end]);

  return { active, connection, error, open, end };
}
