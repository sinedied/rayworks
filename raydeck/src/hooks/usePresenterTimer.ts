import { useEffect, useState } from 'react';

export function usePresenterTimer() {
  const [clock, setClock] = useState<{ elapsed: number; startedAt: number | null }>(
    () => ({ elapsed: 0, startedAt: performance.now() }),
  );
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (clock.startedAt === null) return;
    const tick = () => setNow(performance.now());
    tick();
    const interval = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [clock.startedAt]);

  const elapsed = clock.elapsed + (clock.startedAt === null ? 0 : Math.max(0, now - clock.startedAt));
  const toggle = () => {
    const timestamp = performance.now();
    setNow(timestamp);
    setClock((current) => current.startedAt === null
      ? { ...current, startedAt: timestamp }
      : { elapsed: current.elapsed + timestamp - current.startedAt, startedAt: null });
  };
  const reset = () => {
    const timestamp = performance.now();
    setNow(timestamp);
    setClock((current) => ({ elapsed: 0, startedAt: current.startedAt === null ? null : timestamp }));
  };
  return { elapsed, paused: clock.startedAt === null, toggle, reset };
}
