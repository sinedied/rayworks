import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export function SlideViewport({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setScale(Math.min(element.clientWidth / 1280, element.clientHeight / 720));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="slide-viewport" ref={ref}>
      <div className="slide-canvas" style={{ transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
