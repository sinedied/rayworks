import { useCallback, useEffect, useRef, useState } from 'react';

import {
  belongsToSession, CONNECTION_TIMEOUT_MS, HEARTBEAT_MS, isSessionMessage, message,
  type AudienceSlide, type Navigation, type SessionBody,
} from '@/presentation/session';

export function useAudienceSession(sessionId: string | null) {
  const [snapshot, setSnapshot] = useState<{ slides: AudienceSlide[]; activeId: string } | null>(null);
  const [status, setStatus] = useState<'waiting' | 'connected' | 'disconnected' | 'ended'>('waiting');
  const [error, setError] = useState('');
  const revision = useRef(-1);
  const commandId = useRef(0);
  const lastSeen = useRef(performance.now());
  const ended = useRef(false);
  const [clientId] = useState(() => crypto.randomUUID());
  const [owner] = useState<Window | null>(() => window.opener);

  const send = useCallback((body: SessionBody) => {
    if (!owner || !sessionId || owner.closed) return;
    try { owner.postMessage(message(sessionId, body), window.location.origin); }
    catch (cause) {
      console.error('Could not reach the presenter window:', cause);
      setStatus('disconnected');
      setError('Could not reach the presenter window. Return to the presenter to reconnect.');
    }
  }, [owner, sessionId]);

  useEffect(() => {
    if (!owner || !sessionId) {
      setStatus('disconnected');
      setError('No presenter is paired with this window. Open it using Enter presenter mode.');
      return;
    }
    const receive = (event: MessageEvent<unknown>) => {
      if (ended.current || event.source !== owner || event.origin !== window.location.origin
        || !belongsToSession(event.data, sessionId)) return;
      if (!isSessionMessage(event.data)) {
        console.error('Invalid message from the paired presenter window.');
        setStatus('disconnected');
        setError('The presenter sent invalid slide state. Reopen this audience window.');
        return;
      }
      lastSeen.current = performance.now();
      const data = event.data;
      if (data.type === 'state' && data.revision >= revision.current) {
        if (data.revision > revision.current) {
          revision.current = data.revision;
          setSnapshot({ slides: data.slides, activeId: data.activeId });
        }
        setStatus('connected');
        setError('');
        send({ type: 'ack', revision: data.revision });
      } else if (data.type === 'ping') {
        send({ type: 'pong' });
      } else if (data.type === 'end') {
        ended.current = true;
        setStatus('ended');
        setSnapshot(null);
        clearInterval(interval);
        window.removeEventListener('message', receive);
        window.removeEventListener('focus', check);
      }
    };
    const check = () => {
      if (ended.current) return;
      if (owner.closed || performance.now() - lastSeen.current > CONNECTION_TIMEOUT_MS) setStatus('disconnected');
      if (revision.current < 0 || performance.now() - lastSeen.current > CONNECTION_TIMEOUT_MS) {
        send({ type: 'ready', clientId });
      } else {
        send({ type: 'ping' });
      }
    };
    window.addEventListener('message', receive);
    send({ type: 'ready', clientId });
    const interval = window.setInterval(check, HEARTBEAT_MS);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(interval);
      window.removeEventListener('message', receive);
      window.removeEventListener('focus', check);
    };
  }, [owner, sessionId, clientId, send]);

  const navigate = useCallback((command: Navigation) => {
    if (status === 'connected') send({ type: 'navigate', clientId, commandId: ++commandId.current, command });
  }, [status, send, clientId]);

  return { snapshot, status, error, navigate };
}
