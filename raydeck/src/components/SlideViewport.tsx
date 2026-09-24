import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export function SlideViewport({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
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
    <div className={`slide-viewport ${centered ? 'slide-viewport-centered' : ''}`} ref={ref}>
      <div className="slide-canvas" style={{
        transform: `${centered ? 'translate(-50%, -50%) ' : ''}scale(${scale})`,
        visibility: scale ? 'visible' : 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}
